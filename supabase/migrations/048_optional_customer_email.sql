-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 048: Make customers.email nullable
--
-- Email is now optional when creating quotes — installers can create quotes
-- for customers who only provide a name and phone number.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.customers
  ALTER COLUMN email DROP NOT NULL;
