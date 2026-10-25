// ═══════════════════════════════════════════════════════════════════════════
// LADDER JIG PLANS — retail product (client-safe constants)
//
// The ladder building jig installers buy on /dashboard/guides, sold to DIY
// customers too. The retail edition marks rail positions for 2×4-rail
// construction (the DIY plan standard). Owners of a tote organizer plan get
// it at TOTE_OWNER price; the server verifies ownership before discounting.
// ═══════════════════════════════════════════════════════════════════════════

export const LADDER_JIG_PLAN_ID = "ladder-jig";

/** Cents */
export const LADDER_JIG_PRICE = 900;
export const LADDER_JIG_OWNER_PRICE = 500;

export const LADDER_JIG_NAME = "Ladder Building Jig";
export const LADDER_JIG_TAGLINE = "Build every ladder frame square, fast, and identical.";

/** Link to the jig offer, discounted when `ownerToken` is a tote plan owner's token. */
export function ladderJigHref(ownerToken?: string | null): string {
  return ownerToken ? `/plans/jig?owner=${encodeURIComponent(ownerToken)}` : "/plans/jig";
}
