-- ═══════════════════════════════════════════════════════════════════════════
-- Add overhead_email_mar2026_sent flag to profiles
-- Used by /api/cron/overhead-announcement to track which installers
-- have received the overhead ceiling storage launch email.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS overhead_email_mar2026_sent boolean DEFAULT false;
