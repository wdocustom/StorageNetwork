-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 073: Add 'processing' to bounty_status constraint
--
-- The webhook handler (route.ts) atomically claims a bounty by setting
-- bounty_status = 'processing' before executing the Stripe transfer.
-- Without this value in the CHECK constraint, the claim UPDATE silently
-- fails, causing bounties to never pay out.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_bounty_status_check;

  ALTER TABLE public.leads
    ADD CONSTRAINT leads_bounty_status_check
    CHECK (bounty_status IN ('none', 'pending', 'processing', 'paid', 'forfeited'));

  RAISE NOTICE 'bounty_status constraint updated to include processing';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'bounty_status constraint update skipped: %', SQLERRM;
END $$;
