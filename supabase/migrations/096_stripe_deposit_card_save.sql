-- ═══════════════════════════════════════════════════════════════════════════
-- 096: Save Stripe Customer + PaymentMethod on deposit
--
-- Lets us off-session charge the remaining balance later. Without a Stripe
-- Customer attached to the deposit PaymentIntent, the card is treated as a
-- guest payment and cannot legally be re-charged. Storing both IDs on the
-- lead so the balance flow can call paymentIntents.create with
-- { customer, payment_method, off_session: true, confirm: true }.
--
-- Columns:
--   stripe_customer_id        — Customer object on the platform account
--   stripe_payment_method_id  — Saved card from the deposit, reusable off-session
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS stripe_customer_id        TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id  TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_stripe_customer_id ON leads (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
