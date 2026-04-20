-- ═══════════════════════════════════════════════════════════════════════════
-- Add bounty_email_mar2026_sent flag to profiles
-- Used by /api/cron/bounty-announcement to track which installers
-- have received the referral/bounty system education email.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bounty_email_mar2026_sent boolean DEFAULT false;
