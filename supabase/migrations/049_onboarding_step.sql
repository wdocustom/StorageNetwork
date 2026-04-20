-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 049: Onboarding Email Drip Sequence Tracking
--
-- Adds onboarding_step to profiles to track which drip emails have been
-- sent to each installer:
--   0 = no emails sent
--   1 = welcome email (Day 0)
--   2 = QR code email (Day 2)
--   3 = first sale playbook (Day 4)
--   4 = scarcity reminder (Day 7) — sequence complete
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 0;

-- Index for the cron job: find installers who need drip emails
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_drip
  ON profiles (onboarding_step, created_at)
  WHERE onboarding_step < 4;

-- Backfill: all existing installers start at step 1 so they receive
-- the full drip sequence (QR code → First Sale → Scarcity emails)
UPDATE profiles
  SET onboarding_step = 1
  WHERE onboarding_step = 0;
