// ═══════════════════════════════════════════════════════════════════════════
// PLAN-SALE SPLITS — who gets the installer share of a tote plan sale
//
// Every confirmed tote plan purchase (PDF or Interactive Guide — not the
// $10 upgrade, not the ladder jig) can send at most $5 to installers:
//
//   1. Referred by an installer (their designer, quote page or quote email
//      link): that installer gets the full $5, whatever is in the plan.
//   2. Otherwise, every installer who owns a bestseller in the plan shares
//      the $5 equally — per installer, so Indiana Joe + Long Ranger (both
//      Elite) + Rack City Roller is Elite $2.50 / Rack City Totes $2.50.
//   3. Neither: no split.
//
// A bestseller counts only while it's still the bestseller's sizes (see
// bestsellerInstances in tote-plans.ts). Paid out by the Stripe webhook
// (processPlanSplits) as Connect transfers, ledgered in plan_split_payouts.
// Set PLAN_SPLITS_ENABLED=false to stop all splits.
// ═══════════════════════════════════════════════════════════════════════════

import { bestsellerInstances, type TotePlanDesign } from "@/lib/tote-plans";

/**
 * Remembers the referring installer between visits. Set by /plans/checkout
 * from a hand-off link's ?ref; kept until a new referral replaces it.
 */
export const PLAN_REF_COOKIE = "sn_plans_ref";

/** The most the platform ever splits off one plan purchase, in cents. */
export const PLAN_SPLIT_TOTAL_CENTS = 500;

/** Installers (profile ids) who own each bestseller's plan share. */
export const BESTSELLER_OWNERS: Record<string, { profileId: string; name: string }> = {
  "indiana-joe": { profileId: "716416bc-2780-4b77-9350-5fe100c74d4d", name: "Elite Storage Systems" },
  "long-ranger": { profileId: "716416bc-2780-4b77-9350-5fe100c74d4d", name: "Elite Storage Systems" },
  "rack-city-roller": { profileId: "071e4146-4a6e-4df8-b753-ce5204225b39", name: "Rack City Totes" },
  "mayor-of-rack-city": { profileId: "071e4146-4a6e-4df8-b753-ce5204225b39", name: "Rack City Totes" },
  "gas-station": { profileId: "16cebbbd-1879-419b-af41-6d53079051cc", name: "Mathew Gass Woodworks" },
};

export interface PlanSplitShare {
  recipientId: string;
  cents: number;
  reason: "referral" | "bestseller";
  /** Bestseller preset ids behind a bestseller share */
  bestsellers: string[];
}

export function planSplitsEnabled(): boolean {
  return process.env.PLAN_SPLITS_ENABLED !== "false";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A referral id worth storing: an installer profile id (UUID). */
export function cleanReferralId(raw: unknown): string | null {
  return typeof raw === "string" && UUID.test(raw.trim()) ? raw.trim().toLowerCase() : null;
}

/** Who gets what from one plan sale. Shares always total 0 or exactly $5. */
export function planSplitShares({
  referralInstallerId,
  design,
}: {
  referralInstallerId?: string | null;
  design: TotePlanDesign;
}): PlanSplitShare[] {
  const referral = cleanReferralId(referralInstallerId);
  if (referral) {
    return [{ recipientId: referral, cents: PLAN_SPLIT_TOTAL_CENTS, reason: "referral", bestsellers: [] }];
  }

  // Installers in order of their first bestseller in the plan
  const owners = new Map<string, string[]>();
  for (const inst of bestsellerInstances(design.units)) {
    const owner = BESTSELLER_OWNERS[inst.presetId];
    if (!owner) continue;
    const list = owners.get(owner.profileId) ?? [];
    if (!list.includes(inst.presetId)) list.push(inst.presetId);
    owners.set(owner.profileId, list);
  }
  if (owners.size === 0) return [];

  // Equal shares; leftover cents go to the first installers so the total is exact
  const base = Math.floor(PLAN_SPLIT_TOTAL_CENTS / owners.size);
  let extra = PLAN_SPLIT_TOTAL_CENTS - base * owners.size;
  return [...owners.entries()].map(([recipientId, bestsellers]) => {
    const cents = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    return { recipientId, cents, reason: "bestseller" as const, bestsellers };
  });
}
