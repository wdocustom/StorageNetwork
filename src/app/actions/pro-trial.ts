"use server";

import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// Pro Trial — Check and manage trial periods
//
// Trial ends when EITHER condition is met:
//   1. Installer completes 3 jobs (paid status)
//   2. 45 days pass from signup (hidden — installer never sees this timer)
//
// If trial expires without a Stripe subscription:
//   → Account is suspended (is_pro = false)
//   → Portfolio page shows "inactive installer" overlay
//   → Configurator/booking links stop working
//
// If they subscribe via Stripe, trial fields are cleared and they continue
// as a paid Pro subscriber.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TRIAL_JOB_LIMIT = 3;

export interface TrialStatus {
  onTrial: boolean;
  trialExpired: boolean;
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

    // Count completed jobs for this installer
    const { count: jobsCompleted } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("installer_id", userId)
      .eq("status", "paid");

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
        jobsCompleted: completedJobs,
        jobsRemaining: Math.max(0, TRIAL_JOB_LIMIT - completedJobs),
        partnerName: profile.pro_trial_partner,
      };
    }

    // ── Trial expired — suspend account ──────────────────────────────────
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

    const reason = jobsExpired
      ? `completed ${completedJobs} jobs`
      : "45-day period elapsed";
    console.log(`[ProTrial] Trial expired for ${userId} — ${reason} — account suspended`);

    return {
      onTrial: false,
      trialExpired: true,
      jobsCompleted: completedJobs,
      jobsRemaining: 0,
      partnerName: null,
    };
  } catch {
    return noTrial;
  }
}
