-- ═══════════════════════════════════════════════════════════════════════════
-- 104: Stripe PaymentMethod display metadata (brand + last4)
--
-- Lets the job ticket show "Visa •••• 4242" next to the Charge-Card-on-File
-- option so the installer has visual confirmation of which card they'll be
-- charging before they tap the button. Populated best-effort by the deposit
-- webhook after the main DB update succeeds — non-critical, falls back to
-- generic "Card on file" text if missing.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS stripe_payment_method_brand TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_last4 TEXT DEFAULT NULL;
