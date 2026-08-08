-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 134: Saved Stripe payment method on customers (cross-quote reuse)
--
-- Previously, the Stripe Customer + saved PaymentMethod from a deposit were
-- written only onto the single `leads` row that collected them (migrations
-- 103/104), so a card saved on one quote was never reusable on another quote
-- for the same person. `customers` already carries the persistent per-person
-- identity (keyed by email + installer_id, linked from every `leads` row),
-- so mirror the Stripe columns here too. This lets both the customer-facing
-- checkout (via PaymentElement) and the installer's "Charge Card on File"
-- action reuse a card across every quote for that customer/installer pair.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS stripe_customer_id          TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_brand TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_last4 TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_stripe_customer_id ON public.customers (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
