-- ═══════════════════════════════════════════════════════════════════════════
-- Add jig_email_mar2026_sent flag to profiles
-- Used by /api/cron/jig-announcement to track which installers
-- have received the jig plan + custom pricing announcement email.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS jig_email_mar2026_sent boolean DEFAULT false;
