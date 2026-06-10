-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 131: Accepting New Leads toggle
--
-- Adds accepting_new_leads to profiles so an installer can mark themselves
-- as temporarily inactive. When false:
--   - Platform ZIP searches already skip them via max_monthly_leads = 0
--     (set by admin separately in the DB).
--   - Build-page quotes are forwarded to the next available installer in
--     their area via the existing rerouteToLocalInstaller() logic.
--     The inactive installer earns the standard 30% network bounty (min $15)
--     on any forwarded quote that results in a deposit, same as the out-of-
--     area referral system.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepting_new_leads BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.accepting_new_leads IS
  'When false the installer is not taking new jobs. Build-page quotes forward to the next available local installer (referral bounty still fires). Admin sets max_monthly_leads=0 separately to stop inbound platform leads.';
