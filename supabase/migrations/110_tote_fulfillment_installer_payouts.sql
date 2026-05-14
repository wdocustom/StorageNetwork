-- ═══════════════════════════════════════════════════════════════════════════
-- 110 — Tote fulfillment installer payouts
--
-- Wires the missing payment leg of the realtor closing-gift program:
-- installers who fulfill a gift now earn a fee per delivery + per pickup,
-- transferred to their connected Stripe account when the rental completes.
--
-- Rate (v1, hardcoded in the calc helper in src/app/actions/realtor-gift-fulfillment.ts):
--   per leg = $20 base + $2/tote
--   per gift total = 2 × per-leg (one delivery + one pickup)
--   Examples:
--     Starter (4 totes): $56/gift  → 56% platform margin on $129
--     Standard (8):      $72/gift  → 62% on $189
--     Pro (12):          $88/gift  → 65% on $249
--     Premium (20):     $120/gift  → 64% on $329
--
-- Snapshot model: the fee is computed and STORED on the gift row at the
-- moment the installer is assigned. This way, later rate changes don't
-- retroactively rewrite in-flight or completed jobs — auditable history.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tote_rental_gifts
  ADD COLUMN IF NOT EXISTS installer_delivery_fee_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installer_pickup_fee_cents   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installer_paid_at            timestamptz NULL,
  ADD COLUMN IF NOT EXISTS installer_payout_id          text NULL;

COMMENT ON COLUMN public.tote_rental_gifts.installer_delivery_fee_cents IS
  'Installer earnings for the delivery leg, snapshotted at assignment time. Defaults to 0 for legacy rows.';
COMMENT ON COLUMN public.tote_rental_gifts.installer_pickup_fee_cents IS
  'Installer earnings for the pickup leg, snapshotted at assignment time. Defaults to 0 for legacy rows.';
COMMENT ON COLUMN public.tote_rental_gifts.installer_paid_at IS
  'Timestamp when the Stripe transfer for this gift was successfully created. NULL = unpaid (either not yet returned, or transfer failed and needs retry).';
COMMENT ON COLUMN public.tote_rental_gifts.installer_payout_id IS
  'Stripe transfer ID (tr_...) for reconciliation. NULL until paid.';

-- Index on installer_paid_at for "unpaid completed gifts" ops queries.
CREATE INDEX IF NOT EXISTS idx_tote_rental_gifts_unpaid_completed
  ON public.tote_rental_gifts (status, installer_paid_at)
  WHERE status = 'returned' AND installer_paid_at IS NULL;
