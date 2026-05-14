// ═══════════════════════════════════════════════════════════════════════════
// Realtor closing-gift installer-payout math.
//
// Kept in a plain `src/lib/` file (not a "use server" module) so it can be
// unit-tested without dragging `server-only` through the import graph. The
// numbers here are the canonical source of truth — the server action that
// snapshots fees onto tote_rental_gifts at assignment time imports from
// here, and so do any tests.
//
// Rate (v2, hardcoded):
//   payout = $20 base + $2/tote, ONCE per gift (delivery + pickup combined)
//
// v1 paid per leg (one delivery + one pickup), which doubled the cost and
// drove installer payouts above the realtor price on small gifts. v2 is a
// single flat payout that covers both legs.
//
// Examples (gift cost-to-network):
//   10 totes:  $40/gift
//   20 totes:  $60/gift
//   30 totes:  $80/gift
//   50 totes:  $120/gift
//
// Schema mapping: the snapshot lives in
//   tote_rental_gifts.installer_delivery_fee_cents = full payout
//   tote_rental_gifts.installer_pickup_fee_cents   = 0
// The two columns predate this consolidation (migration 110, when payouts
// were per leg). Keeping them both lets the Stripe payout code keep summing
// them — the sum is still the right amount, and renaming the columns now
// would churn already-finalized records.
//
// Update migration 110's seed comment if you change these.
// ═══════════════════════════════════════════════════════════════════════════

export const INSTALLER_FEE_BASE_CENTS = 2000;    // $20 per gift
export const INSTALLER_FEE_PER_TOTE_CENTS = 200; // $2 per tote per gift

/**
 * Total installer payout in cents for one gift (delivery + pickup combined).
 *
 * Stored on the gift row at assignment time so subsequent rate changes
 * don't rewrite history.
 */
export function calcInstallerPayoutCents(toteCount: number): number {
  if (!Number.isFinite(toteCount) || toteCount < 0) return 0;
  return INSTALLER_FEE_BASE_CENTS + INSTALLER_FEE_PER_TOTE_CENTS * Math.floor(toteCount);
}
