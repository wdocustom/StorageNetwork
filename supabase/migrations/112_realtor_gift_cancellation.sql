-- ═══════════════════════════════════════════════════════════════════════════
-- 112 — Realtor gift cancellation + refund audit trail
--
-- Adds the columns the cancel/refund flow needs to record what happened,
-- when, and why. Status `cancelled` already exists in the CHECK constraint
-- on tote_rental_gifts.status from migration 108; this migration just
-- attaches the audit-trail metadata the realtor + admin tooling reads.
--
--   cancelled_at        — when the cancellation was recorded. Distinct from
--                         updated_at, which moves on every column write.
--   cancelled_reason    — optional, short text the realtor supplied. Bounded
--                         to 500 chars so a malicious paste can't break the
--                         admin UI.
--   refunded_at         — when the Stripe refund succeeded. NULL when there
--                         was nothing to refund (status=pending_payment) or
--                         when the refund hasn't fired yet / failed.
--   stripe_refund_id    — `re_…` ID for reconciliation. Lives alongside the
--                         existing stripe_payment_intent_id.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tote_rental_gifts
  ADD COLUMN IF NOT EXISTS cancelled_at     timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cancelled_reason text        NULL,
  ADD COLUMN IF NOT EXISTS refunded_at      timestamptz NULL,
  ADD COLUMN IF NOT EXISTS stripe_refund_id text        NULL;

ALTER TABLE public.tote_rental_gifts
  ADD CONSTRAINT tote_rental_gifts_cancelled_reason_length
  CHECK (cancelled_reason IS NULL OR char_length(cancelled_reason) <= 500);

COMMENT ON COLUMN public.tote_rental_gifts.cancelled_at IS
  'Timestamp the gift was cancelled. NULL = not cancelled. Set in tandem with status = ''cancelled''.';
COMMENT ON COLUMN public.tote_rental_gifts.cancelled_reason IS
  'Optional realtor-supplied reason for the cancellation. Max 500 chars.';
COMMENT ON COLUMN public.tote_rental_gifts.refunded_at IS
  'Timestamp the Stripe refund succeeded. NULL when no refund was due (pending_payment) or refund has not yet been issued.';
COMMENT ON COLUMN public.tote_rental_gifts.stripe_refund_id IS
  'Stripe refund ID (re_…) for reconciliation. NULL if no refund issued.';

-- Index for ops sweeps over recently-cancelled gifts.
CREATE INDEX IF NOT EXISTS idx_tote_rental_gifts_cancelled
  ON public.tote_rental_gifts (cancelled_at DESC)
  WHERE cancelled_at IS NOT NULL;
