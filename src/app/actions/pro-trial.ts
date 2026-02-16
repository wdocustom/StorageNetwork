"use server";

import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Pro Trial — Check and expire 7-day trial periods
//
// Called on dashboard load to check if a trial has expired.
// If expired, reverts is_pro to false and clears trial fields.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface TrialStatus {
  onTrial: boolean;
  daysRemaining: number;
  partnerName: string | null;
  trialEndsAt: string | null;
}

/**
 * Check trial status for a user. If the trial has expired and they haven't
 * subscribed to Pro (no stripe_subscription_id), reverts them to free.
 */
export async function checkProTrial(userId: string): Promise<TrialStatus> {
  const noTrial: TrialStatus = {
    onTrial: false,
    daysRemaining: 0,
    partnerName: null,
    trialEndsAt: null,
  };

  if (!userId) return noTrial;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro, pro_trial_ends_at, pro_trial_partner, stripe_subscription_id")
      .eq("id", userId)
      .single();

    if (!profile) return noTrial;

    // No trial set — they're either paid Pro or free
    if (!profile.pro_trial_ends_at) return noTrial;

    const trialEnd = new Date(profile.pro_trial_ends_at);
    const now = new Date();

    // If they've since subscribed to Pro via Stripe, the trial is irrelevant
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

    // Trial still active
    if (now < trialEnd) {
      const msRemaining = trialEnd.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      return {
        onTrial: true,
        daysRemaining,
        partnerName: profile.pro_trial_partner,
        trialEndsAt: profile.pro_trial_ends_at,
      };
    }

    // ── Trial expired — revert to free ────────────────────────────────────
    await supabase
      .from("profiles")
      .update({
        is_pro: false,
        pro_trial_ends_at: null,
        pro_trial_partner: null,
        slug: null, // Remove Pro slug
      })
      .eq("id", userId);

    console.log(`[ProTrial] Trial expired for ${userId} — reverted to free`);
    return noTrial;
  } catch {
    return noTrial;
  }
}
