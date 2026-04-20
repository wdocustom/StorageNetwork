-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 089: Weekly Digest & Engagement Fields
--
-- Adds columns to profiles for the weekly activity digest email system:
--   - weekly_digest_opted_out: allows installers to unsubscribe
--   - last_digest_sent_at: prevents duplicate sends in the same cycle
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS weekly_digest_opted_out BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

-- Index for the cron job: find installers who should receive the digest
CREATE INDEX IF NOT EXISTS idx_profiles_weekly_digest
  ON profiles (weekly_digest_opted_out, last_digest_sent_at)
  WHERE weekly_digest_opted_out = false;
