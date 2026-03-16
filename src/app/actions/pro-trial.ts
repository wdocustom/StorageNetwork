"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { slugify } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// Pro Trial — Check and manage trial periods
//
// Trial ends when EITHER condition is met:
//   1. Installer has 3 committed jobs (deposit_paid, payment_pending,
//      completed, or paid status — counting from deposit, not just
//      final payment, to prevent gaming)
//   2. 45 days pass from signup (hidden — installer never sees this timer)
//
// If trial expires without a Stripe subscription:
//   → If installer has active jobs (deposit_paid, payment_pending, completed):
//     → Soft lock: is_pro stays true so they can finish existing work
//     → New bookings/configurator should be blocked by the UI
//     → 14-day grace window from trial end — hard suspend after that
//   → If no active jobs (or grace window passed):
//     → Hard suspend: is_pro = false
//     → Portfolio page shows "inactive installer" overlay
//     → Configurator/booking links stop working
//
// If they subscribe via Stripe, trial fields are cleared and they continue
// as a paid Pro subscriber.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

const TRIAL_JOB_LIMIT = 3;
const GRACE_PERIOD_DAYS = 14;

export interface TrialStatus {
  onTrial: boolean;
  trialExpired: boolean;
  softLocked: boolean;
  activeJobsCount: number;
  graceEndsAt: string | null;
  jobsCompleted: number;
  jobsRemaining: number;
  partnerName: string | null;
}

/**
 * Check trial status for a user.
 *
 * If the trial has expired (3 jobs completed OR 45 days elapsed) and they
 * haven't subscribed (no stripe_subscription_id), suspends the account.
 *
 * If the trial is active but is_pro is false or slug is missing,
 * auto-corrects to ensure full trial experience.
 */
export async function checkProTrial(userId: string): Promise<TrialStatus> {
  const noTrial: TrialStatus = {
    onTrial: false,
    trialExpired: false,
    softLocked: false,
    activeJobsCount: 0,
    graceEndsAt: null,
    jobsCompleted: 0,
    jobsRemaining: 0,
    partnerName: null,
  };

  if (!userId) return noTrial;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro, pro_trial_ends_at, pro_trial_partner, stripe_subscription_id, slug, business_name, first_name")
      .eq("id", userId)
      .single();

    if (!profile) return noTrial;

    // No trial set — they're either a paid subscriber or suspended
    if (!profile.pro_trial_ends_at) return noTrial;

    // If they've subscribed to Pro via Stripe, the trial is irrelevant
    // Clear the trial fields and keep them as paid Pro
    if (profile.stripe_subscription_id) {
      await supabase
        .from("profiles")
        .update({
          pro_trial_ends_at: null,
          pro_trial_partner: null,
        })
        .eq("id", userId);
      return noTrial;
    }

    // Count committed jobs for this installer.
    // A job counts once a deposit is paid — not just when the installer
    // marks it "paid". This prevents gaming the trial by leaving jobs
    // in deposit_paid status indefinitely.
    const { count: jobsCompleted } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("installer_id", userId)
      .in("status", ["deposit_paid", "payment_pending", "completed", "paid"]);

    const completedJobs = jobsCompleted ?? 0;

    const trialEnd = new Date(profile.pro_trial_ends_at);
    const now = new Date();
    const timeExpired = now >= trialEnd;
    const jobsExpired = completedJobs >= TRIAL_JOB_LIMIT;
    const trialExpired = timeExpired || jobsExpired;

    if (!trialExpired) {
      // ── Trial still active ──────────────────────────────────────────────

      // Self-healing: auto-activate Pro if trial is valid but is_pro/slug missing
      if (!profile.is_pro || !profile.slug) {
        const updates: Record<string, unknown> = {};

        if (!profile.is_pro) {
          updates.is_pro = true;
        }

        if (!profile.slug) {
          const rawName = profile.business_name || profile.first_name || userId.slice(0, 8);
          let trialSlug = slugify(rawName);
          if (!trialSlug) trialSlug = userId.slice(0, 8);

          // Check uniqueness
          const { data: existing } = await supabase
            .from("profiles")
            .select("id")
            .eq("slug", trialSlug)
            .neq("id", userId)
            .maybeSingle();

          if (existing) {
            trialSlug = `${trialSlug}-${new Date().getFullYear()}`;
            const { data: existing2 } = await supabase
              .from("profiles")
              .select("id")
              .eq("slug", trialSlug)
              .neq("id", userId)
              .maybeSingle();
            if (existing2) {
              trialSlug = `${trialSlug}-${userId.slice(0, 4)}`;
            }
          }

          updates.slug = trialSlug;
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from("profiles")
            .update(updates)
            .eq("id", userId);
          console.log(`[ProTrial] Auto-activated trial for ${userId}:`, updates);
        }
      }

      return {
        onTrial: true,
        trialExpired: false,
        softLocked: false,
        activeJobsCount: 0,
        graceEndsAt: null,
        jobsCompleted: completedJobs,
        jobsRemaining: Math.max(0, TRIAL_JOB_LIMIT - completedJobs),
        partnerName: profile.pro_trial_partner,
      };
    }

    // ── Trial expired — check for active jobs before suspending ─────────
    //
    // If the installer has jobs in progress (deposit collected, awaiting
    // payment, or completed-but-unpaid), don't hard-lock them out.
    // Instead, soft-lock: keep is_pro true so they can finish existing
    // work, but the UI should block new bookings. This avoids stranding
    // customers who already paid deposits and burning installer trust.
    //
    // Grace window: 14 days from trial end. After that, hard suspend
    // regardless — prevents indefinite stalling.

    // Active jobs = deposit paid but not yet fully resolved
    const { count: activeJobCount } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("installer_id", userId)
      .in("status", ["deposit_paid", "payment_pending", "completed"]);

    const activeJobs = activeJobCount ?? 0;
    const graceEnd = new Date(trialEnd.getTime() + GRACE_PERIOD_DAYS * 86_400_000);
    const withinGrace = now < graceEnd;

    if (activeJobs > 0 && withinGrace) {
      // ── Soft lock: let them finish existing jobs ────────────────────
      // Keep is_pro = true so dashboard/job management still works.
      // Don't clear trial fields — we need pro_trial_ends_at to
      // calculate when the grace window ends.
      if (!profile.is_pro) {
        await supabase
          .from("profiles")
          .update({ is_pro: true })
          .eq("id", userId);
      }

      console.log(
        `[ProTrial] Trial expired for ${userId} — soft lock: ${activeJobs} active job(s), grace until ${graceEnd.toISOString()}`
      );

      return {
        onTrial: false,
        trialExpired: true,
        softLocked: true,
        activeJobsCount: activeJobs,
        graceEndsAt: graceEnd.toISOString(),
        jobsCompleted: completedJobs,
        jobsRemaining: 0,
        partnerName: profile.pro_trial_partner,
      };
    }

    // ── Hard suspend — no active jobs or grace window passed ──────────
    // Slug is preserved so the portfolio URL still resolves
    // (shows an "inactive installer" overlay instead of 404)
    await supabase
      .from("profiles")
      .update({
        is_pro: false,
        pro_trial_ends_at: null,
        pro_trial_partner: null,
      })
      .eq("id", userId);

    const reason = activeJobs > 0
      ? `grace period ended with ${activeJobs} unresolved job(s)`
      : jobsExpired
        ? `completed ${completedJobs} jobs`
        : "45-day period elapsed";
    console.log(`[ProTrial] Trial expired for ${userId} — ${reason} — account suspended`);

    return {
      onTrial: false,
      trialExpired: true,
      softLocked: false,
      activeJobsCount: 0,
      graceEndsAt: null,
      jobsCompleted: completedJobs,
      jobsRemaining: 0,
      partnerName: null,
    };
  } catch {
    return noTrial;
  }
}
