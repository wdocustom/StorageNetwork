// ═══════════════════════════════════════════════════════════════════════════
// PLAN-SALE SPLITS — who gets the installer share of a tote plan sale
//
// Every confirmed tote plan purchase (PDF or Interactive Guide — not the
// $10 upgrade, not the ladder jig) can send a share to installers:
//
//   1. Referred by an installer (their /plans/r/<slug> link, designer,
//      quote page or quote email link):
//        • the referrer gets $5
//        • installers who own a named bestseller in the plan share $2.50
//          (so a referred Indiana Joe plan pays $5 + $2.50 = $7.50)
//        • when the referrer owns a bestseller in the plan, it's one
//          payment of $6.50 to them (other owners still share the $2.50)
//   2. No referral: every installer who owns a bestseller in the plan
//      shares $5 equally — per installer, so Indiana Joe + Long Ranger
//      (both Elite) + Rack City Roller is Elite $2.50 / Rack City Totes $2.50.
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

/** Bestseller owners' pool on a plan sale with no referral, in cents. */
export const PLAN_SPLIT_TOTAL_CENTS = 500;
/** The referring installer's share, in cents. */
export const PLAN_REFERRAL_CENTS = 500;
/** Bestseller owners' pool on a referred sale, in cents. */
export const PLAN_REFERRED_BESTSELLER_CENTS = 250;
/** One payment when the referrer also owns a bestseller in the plan, in cents. */
export const PLAN_REFERRER_OWNS_BESTSELLER_CENTS = 650;

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
  /** The recipient's bestseller preset ids in the plan */
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

/** Split `total` cents equally; leftover cents go to the first recipients. */
function shareEqually(owners: [string, string[]][], total: number): PlanSplitShare[] {
  if (owners.length === 0) return [];
  const base = Math.floor(total / owners.length);
  let extra = total - base * owners.length;
  return owners.map(([recipientId, bestsellers]) => {
    const cents = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    return { recipientId, cents, reason: "bestseller" as const, bestsellers };
  });
}

/** Who gets what from one plan sale. At most one share per installer. */
export function planSplitShares({
  referralInstallerId,
  design,
}: {
  referralInstallerId?: string | null;
  design: TotePlanDesign;
}): PlanSplitShare[] {
  // Installers in order of their first bestseller in the plan
  const owners = new Map<string, string[]>();
  for (const inst of bestsellerInstances(design.units)) {
    const owner = BESTSELLER_OWNERS[inst.presetId];
    if (!owner) continue;
    const list = owners.get(owner.profileId) ?? [];
    if (!list.includes(inst.presetId)) list.push(inst.presetId);
    owners.set(owner.profileId, list);
  }

  const referral = cleanReferralId(referralInstallerId);
  if (!referral) return shareEqually([...owners.entries()], PLAN_SPLIT_TOTAL_CENTS);

  const own = owners.get(referral);
  const others = [...owners.entries()].filter(([id]) => id !== referral);
  return [
    {
      recipientId: referral,
      cents: own ? PLAN_REFERRER_OWNS_BESTSELLER_CENTS : PLAN_REFERRAL_CENTS,
      reason: "referral" as const,
      bestsellers: own ?? [],
    },
    ...shareEqually(others, PLAN_REFERRED_BESTSELLER_CENTS),
  ];
}
