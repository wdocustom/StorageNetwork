-- ═══════════════════════════════════════════════════════════════════════════
-- Add feature_email_mar2026_sent flag to profiles
-- Used by /api/cron/feature-announcement to track which installers
-- have received the March 2026 platform update email.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS feature_email_mar2026_sent boolean DEFAULT false;
