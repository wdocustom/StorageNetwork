-- ═══════════════════════════════════════════════════════════════════════════
-- Platform-wide analytics: tracks every page view across the entire site.
-- Captures device type, geo location (from Vercel headers), referrer,
-- UTM params, bot detection, and session/visitor identity.
-- Admin-only read access via service_role; anonymous insert for tracking.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.platform_page_views (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path   TEXT          NOT NULL,
  visitor_id  TEXT,                           -- persistent localStorage ID
  ip_hash     TEXT,                           -- SHA-256 of IP (privacy-safe)
  device_type TEXT          DEFAULT 'desktop', -- mobile | tablet | desktop
  user_agent  TEXT,
  screen_width INTEGER,
  city        TEXT,
  region      TEXT,                           -- state/province
  country     TEXT,
  referrer    TEXT,
  utm_source  TEXT,
  utm_medium  TEXT,
  utm_campaign TEXT,
  is_bot      BOOLEAN       DEFAULT false,
  session_id  TEXT,                           -- sessionStorage ID
  created_at  TIMESTAMPTZ   DEFAULT now()
);

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_ppv_created       ON public.platform_page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppv_page_created   ON public.platform_page_views (page_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppv_session        ON public.platform_page_views (session_id);
CREATE INDEX IF NOT EXISTS idx_ppv_visitor        ON public.platform_page_views (visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppv_bot            ON public.platform_page_views (is_bot, created_at DESC);

-- RLS
ALTER TABLE public.platform_page_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert page views (anonymous tracking from client)
CREATE POLICY "platform_page_views_insert"
  ON public.platform_page_views FOR INSERT
  WITH CHECK (true);

-- Only service_role can read (admin server actions)
CREATE POLICY "platform_page_views_service_read"
  ON public.platform_page_views FOR SELECT
  USING (auth.role() = 'service_role');
