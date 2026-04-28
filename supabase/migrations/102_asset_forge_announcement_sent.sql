-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 102: AI Asset Forge announcement dedup column
--
-- One-off field used by the manual-trigger cron at
-- /api/cron/asset-forge-announcement to track which installers have
-- already received the launch email. Lets the operator re-run the cron
-- safely (e.g. after a partial failure) without double-sending.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS asset_forge_announcement_sent_at TIMESTAMPTZ;
