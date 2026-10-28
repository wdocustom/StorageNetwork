import "server-only";

import { getServiceClient } from "@/lib/supabase-server";
import { checkProTrial, type TrialStatus } from "@/lib/server/pro-trial";
import { computeSetupStatus, type SetupStatus } from "@/lib/server/setup-status";
import { computeDashboardNudge, type DashboardNudge } from "@/lib/server/dashboard-nudge";

// ═══════════════════════════════════════════════════════════════════════════
// Today — everything the dashboard home shows, loaded in one parallel pass
// on the server so the page arrives with real numbers (no spinner, no
// client-side query waterfall). The caller verifies userId.
// ═══════════════════════════════════════════════════════════════════════════

export interface TodayProfile {
  id: string;
  email: string;
  first_name: string | null;
  business_name: string | null;
  is_pro: boolean;
  is_admin: boolean | null;
  is_realtor: boolean | null;
  stripe_account_id: string | null;
  slug: string | null;
  city: string | null;
  state: string | null;
}

/** An active job (deposit paid, not finished) — the Today list sorts these. */
export interface TodayJob {
  id: string;
  customer_name: string | null;
  status: string;
  scheduled_at: string | null;
  balance_due: number | null;
}

export interface TodayData {
  profile: TodayProfile | null;
  trial: TrialStatus;
  setup: SetupStatus | null;
  nudge: DashboardNudge | null;
  revenue: number;
  jobsDone: number;
  jobs: TodayJob[];
}

const PROFILE_COLUMNS =
  "id, email, first_name, business_name, is_pro, is_admin, is_realtor, stripe_account_id, slug, city, state";

export async function loadToday(userId: string): Promise<TodayData> {
  const db = getServiceClient();

  const [profileRes, paidRes, activeRes, trial, setup, nudge] = await Promise.all([
    db.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).single(),
    db.from("leads").select("balance_due").eq("installer_id", userId).eq("payout_status", "paid"),
    // Same "active job" set as the Jobs tab: deposit taken, not finished.
    db
      .from("leads")
      .select("id, customer_name, status, scheduled_at, balance_due")
      .eq("installer_id", userId)
      .eq("deposit_paid", true)
      .not("status", "in", '("paid","completed","cancelled","archived","pending_payment","expired")'),
    checkProTrial(userId),
    computeSetupStatus(userId).catch(() => null),
    computeDashboardNudge(userId).catch(() => null),
  ]);

  if (profileRes.error) console.error("[Today] profile:", profileRes.error.message);

  const paid = (paidRes.data ?? []) as { balance_due: number | null }[];
  const jobs = (activeRes.data ?? []) as TodayJob[];

  return {
    profile: (profileRes.data as TodayProfile | null) ?? null,
    trial,
    setup,
    nudge,
    revenue: Math.round(paid.reduce((sum, l) => sum + (l.balance_due || 0), 0)),
    jobsDone: paid.length,
    jobs,
  };
}
