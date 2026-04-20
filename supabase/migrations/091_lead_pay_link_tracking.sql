-- ═══════════════════════════════════════════════════════════════════════════
-- 091: Pay Link Tracking — Track customer engagement with /pay links
--
-- Adds columns to the leads table so installers can see whether their
-- customer has opened the quote link, how far they got, and whether
-- the quote has gone stale (abandoned after 3+ days).
--
-- Columns:
--   viewed_at          — first time customer opened the /pay link
--   view_count         — total number of times the link was opened
--   last_step_reached  — furthest checkout step: address / review / payment
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS viewed_at          TIMESTAMPTZ     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS view_count         INTEGER         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_step_reached  TEXT            DEFAULT NULL;

-- Index for dashboard queries filtering on viewed_at
CREATE INDEX IF NOT EXISTS idx_leads_viewed_at ON leads (viewed_at)
  WHERE viewed_at IS NOT NULL;
