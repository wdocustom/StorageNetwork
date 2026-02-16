-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 028: Page Views Analytics Table
--
-- Tracks visits to installer pages (design, book, etc.) for analytics.
-- Used by the installer analytics dashboard to show views, conversions,
-- traffic sources, and device breakdown.
-- ═══════════════════════════════════════════════════════════════════════════

-- Create page_views table
CREATE TABLE IF NOT EXISTS page_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  installer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  page TEXT NOT NULL DEFAULT '/design',
  referrer TEXT,
  user_agent TEXT,
  screen_width INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by installer + date range
CREATE INDEX IF NOT EXISTS idx_page_views_installer_created
  ON page_views (installer_id, created_at DESC);

-- Enable RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anyone (page views are anonymous)
CREATE POLICY "Anyone can insert page views"
  ON page_views FOR INSERT
  WITH CHECK (true);

-- Only the installer can read their own page views
CREATE POLICY "Installers can read own page views"
  ON page_views FOR SELECT
  USING (installer_id = auth.uid());

-- Service role can read all (for server actions)
CREATE POLICY "Service role can read all page views"
  ON page_views FOR SELECT
  USING (auth.role() = 'service_role');
