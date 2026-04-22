-- ═══════════════════════════════════════════════════════════════════════════
-- 096: Sales Tax Toggle
-- Allows installers to enable/disable sales tax on customer quotes.
-- Default TRUE — existing installers continue charging tax as before.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sales_tax_enabled BOOLEAN NOT NULL DEFAULT TRUE;
