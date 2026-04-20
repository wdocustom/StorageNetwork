-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 029: 7-Day Pro Trial for Affiliate Signups
--
-- Adds columns to support a free 7-day Pro trial when a new installer
-- signs up through an affiliate/partner link (e.g., /join/elite).
-- ═══════════════════════════════════════════════════════════════════════════

-- Trial expiry timestamp — NULL means no trial
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_trial_ends_at TIMESTAMPTZ;

-- Name of the partner who referred this installer (for attribution display)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_trial_partner TEXT;
