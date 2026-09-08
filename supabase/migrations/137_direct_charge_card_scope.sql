-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 137: Record which Stripe account a saved card belongs to
--
-- Customer payments moved from destination charges (created on the platform,
-- transferred out to the installer) to DIRECT charges (created on the
-- installer's connected account, which makes them — not the platform —
-- liable for disputes, dispute fees and processing fees).
--
-- Stripe Customers and PaymentMethods are scoped to exactly one account. The
-- ids in stripe_customer_id / stripe_payment_method_id were all written by
-- the old platform-side flow, and a connected account cannot charge them.
-- New rows written under direct charges hold ids belonging to the installer's
-- connected account instead — and the two are indistinguishable by shape.
--
-- So record the owning account alongside them:
--   NULL  → the card lives on the PLATFORM account (every pre-migration row).
--           Off-session charging clones it onto the connected account first.
--   acct_ → the card already lives on that connected account and is directly
--           chargeable there.
--
-- Backfill is intentionally a no-op: NULL is exactly the right value for
-- every existing row.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS stripe_customer_account_id TEXT DEFAULT NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS stripe_customer_account_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.customers.stripe_customer_account_id IS
  'Connected account owning stripe_customer_id/stripe_payment_method_id. NULL = platform account (pre-direct-charge rows).';

COMMENT ON COLUMN public.leads.stripe_customer_account_id IS
  'Connected account owning stripe_customer_id/stripe_payment_method_id. NULL = platform account (pre-direct-charge rows).';
