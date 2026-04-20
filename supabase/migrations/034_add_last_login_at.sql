-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 034: Add last_login_at to profiles
-- Tracks the most recent login timestamp for each installer.
-- Displayed in the admin panel so partners can see account activity.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
