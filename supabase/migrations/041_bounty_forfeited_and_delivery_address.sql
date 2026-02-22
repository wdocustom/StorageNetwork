-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 041: Bounty Forfeited Status + Delivery Address
--
-- 1. Adds 'forfeited' to the bounty_status check constraint so that when
--    a Pro installer cancels, all their pending bounties can be marked
--    as forfeited (no payout even if deposit comes in later).
--
-- 2. Adds delivery_address_* columns to the leads table so that installers
--    can enter the customer's delivery/installation address at quote time,
--    separate from the billing address collected at payment.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Update bounty_status constraint to include 'forfeited' ──────────────
-- Drop the old constraint and add an updated one
DO $$
BEGIN
  -- Drop existing check constraint (name may vary)
  ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_bounty_status_check;
  -- Re-add with 'forfeited' included
  ALTER TABLE public.leads
    ADD CONSTRAINT leads_bounty_status_check
    CHECK (bounty_status IN ('none', 'pending', 'paid', 'forfeited'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'bounty_status constraint update skipped: %', SQLERRM;
END $$;

-- ── 2. Add delivery address columns ────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS delivery_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address_city  TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address_state TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address_zip   TEXT;

COMMENT ON COLUMN public.leads.delivery_address_line1 IS
  'Delivery/installation street address entered by installer at quote time.';
COMMENT ON COLUMN public.leads.delivery_address_city IS
  'Delivery/installation city entered by installer at quote time.';
COMMENT ON COLUMN public.leads.delivery_address_state IS
  'Delivery/installation state (2-letter) entered by installer at quote time.';
COMMENT ON COLUMN public.leads.delivery_address_zip IS
  'Delivery/installation ZIP code entered by installer at quote time.';
