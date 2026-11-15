// ═══════════════════════════════════════════════════════════════════════════
// Smart Inventory for DIY plan buyers — client-safe constants
//
// The same tote inventory installers' customers get (/rack/[token]: every
// tote on a grid, what's in it, photos, search, printable QR labels, moving
// things between totes), for racks a plan buyer builds themselves. A $5
// lifetime add-on; racks are added over time from /plans/inventory (a 4×4
// today, a 4×2 later) and all link together by the buyer's email.
// ═══════════════════════════════════════════════════════════════════════════

export const DIY_INVENTORY = {
  name: "Smart Inventory",
  /** In cents, once, lifetime */
  price: 500,
  tagline: "Know what's in every tote without opening one.",
} as const;

/** The buyer's inventory hub, reached with any of their plan links. */
export function diyInventoryHref(planToken: string): string {
  return `/plans/inventory?token=${encodeURIComponent(planToken)}`;
}

/** The hub for any way in: a plan link, a DIY rack's link, or a signed-in admin / Pro account. */
export function diyInventoryUrl(key: { token: string } | { rack: string } | { account: true }): string {
  if ("token" in key) return diyInventoryHref(key.token);
  if ("rack" in key) return `/plans/inventory?rack=${encodeURIComponent(key.rack)}`;
  return "/plans/inventory?account=1";
}

/** Limits for a rack added by hand (matches the designer's per-unit limits). */
export const DIY_RACK_LIMITS = { minCols: 1, maxCols: 24, minRows: 1, maxRows: 10, maxRacks: 30 } as const;
