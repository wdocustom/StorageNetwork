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

-- Backfill: existing installers who already received a welcome email
-- (anyone with is_pro = true or subscription_tier = 'pro') → step 1
-- This prevents the cron from re-sending Email 1 to existing users
UPDATE profiles
  SET onboarding_step = 4
  WHERE onboarding_step = 0
    AND created_at < NOW() - INTERVAL '7 days';

UPDATE profiles
  SET onboarding_step = 1
  WHERE onboarding_step = 0
    AND created_at >= NOW() - INTERVAL '7 days';
