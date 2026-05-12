-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 107: Visitor Intelligence — raw IP capture + watchlist
--
-- 1. Add `ip` column to platform_page_views.
--    Existing analytics only stored a salted SHA-256 hash for privacy. The
--    admin needs raw IPs to identify specific suspicious visitors (e.g.
--    competitor reconnaissance). We keep ip_hash in place for backward
--    compat with existing rows; new rows populate both.
--
-- 2. analytics_watchlist — admin-curated list of IPs / visitor_ids that
--    should be highlighted in the live feed and Sessions view. Lets the
--    admin tag a known competitor or "spy" account so repeat visits are
--    surfaced immediately. Either ip OR visitor_id (or both) per row.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.platform_page_views
  ADD COLUMN IF NOT EXISTS ip TEXT;

CREATE INDEX IF NOT EXISTS idx_ppv_ip_created
  ON public.platform_page_views (ip, created_at DESC)
  WHERE ip IS NOT NULL;

-- ── Watchlist ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_watchlist (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT         NOT NULL,
  ip          TEXT,
  visitor_id  TEXT,
  note        TEXT,
  created_by  UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT  watchlist_needs_target CHECK (ip IS NOT NULL OR visitor_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_ip         ON public.analytics_watchlist (ip)         WHERE ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_watchlist_visitor    ON public.analytics_watchlist (visitor_id) WHERE visitor_id IS NOT NULL;

ALTER TABLE public.analytics_watchlist ENABLE ROW LEVEL SECURITY;

-- Service role only — the admin UI calls server actions that use the
-- service-role client. No client-side reads/writes.
DROP POLICY IF EXISTS "watchlist_service_all" ON public.analytics_watchlist;
CREATE POLICY "watchlist_service_all"
  ON public.analytics_watchlist FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
