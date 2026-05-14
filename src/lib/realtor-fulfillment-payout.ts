// ═══════════════════════════════════════════════════════════════════════════
// Realtor closing-gift installer-payout math.
//
// Kept in a plain `src/lib/` file (not a "use server" module) so it can be
// unit-tested without dragging `server-only` through the import graph. The
// numbers here are the canonical source of truth — the server action that
// snapshots fees onto tote_rental_gifts at assignment time imports from
// here, and so do any tests.
//
// Rate (v1, hardcoded):
//   per leg = $20 base + $2/tote
//   per gift total = 2 × per-leg (one delivery + one pickup)
// Examples:
//   Starter (4 totes):    $28/leg → $56/gift  (56% margin on $129)
//   Standard (8 totes):   $36/leg → $72/gift  (62% on $189)
//   Pro (12 totes):       $44/leg → $88/gift  (65% on $249)
//   Premium (20 totes):  $60/leg → $120/gift  (64% on $329)
//
// Update migration 110's seed comment if you change these.
// ═══════════════════════════════════════════════════════════════════════════

export const INSTALLER_FEE_BASE_CENTS = 2000;    // $20 per leg
export const INSTALLER_FEE_PER_TOTE_CENTS = 200; // $2 per tote per leg

/** Per-leg installer payout in cents. Each gift has two legs (delivery + pickup). */
export function calcInstallerLegFeeCents(toteCount: number): number {
  if (!Number.isFinite(toteCount) || toteCount < 0) return 0;
  return INSTALLER_FEE_BASE_CENTS + INSTALLER_FEE_PER_TOTE_CENTS * Math.floor(toteCount);
}
