-- ═══════════════════════════════════════════════════════════════════════════
-- 118 — Realtor tote-rental announcement dedup column
--
-- Tracks which installers have already received the one-off launch email
-- for the realtor closing-gift tote-rental program. Lets the cron at
-- /api/cron/tote-rental-announcement be re-run safely (after a partial
-- failure or for new installers who join the network later) without
-- double-sending to anyone already emailed.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tote_rental_announcement_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.tote_rental_announcement_sent_at IS
  'Timestamp the installer received the realtor tote-rental launch email. '
  'NULL = not yet sent. Used by the dedup query in '
  'processToteRentalAnnouncement so the cron is safe to re-run.';
