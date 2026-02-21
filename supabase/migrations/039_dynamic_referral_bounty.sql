-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 039: Dynamic Referral Bounty
--
-- Changes the referral bounty from a flat $15 to 30% of the deposit amount
-- with a $15 floor. Adds a bounty_amount column to track the actual
-- bounty paid (which varies per job based on the deposit).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS bounty_amount NUMERIC(10,2);

COMMENT ON COLUMN public.leads.bounty_amount IS
  'Actual bounty amount paid to the referrer (30% of deposit, min $15). NULL until bounty is paid.';
