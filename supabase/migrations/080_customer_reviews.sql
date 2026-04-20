-- ═══════════════════════════════════════════════════════════════════════════
-- 080: Customer Reviews System
--
-- Token-based review submission (no customer auth required).
-- Each lead gets a unique review_token for a one-time review.
-- Reviews are tied to a specific job and installer.
-- Installers can toggle review visibility on their portfolio page.
-- ═══════════════════════════════════════════════════════════════════════════

-- Reviews table
CREATE TABLE IF NOT EXISTS installer_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  review_token    TEXT NOT NULL UNIQUE,        -- 128-bit hex, one-time use
  customer_name   TEXT NOT NULL,
  rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  headline        TEXT,                        -- short summary line
  comment         TEXT,                        -- detailed review
  tags            TEXT[] DEFAULT '{}',         -- e.g. {'professional', 'on_time', 'clean_work'}
  is_verified     BOOLEAN DEFAULT true,        -- came from actual paid job
  is_published    BOOLEAN DEFAULT true,        -- admin can unpublish spam
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id)                              -- one review per job
);

-- Fast lookup by installer (portfolio display)
CREATE INDEX IF NOT EXISTS idx_ir_installer_created
  ON installer_reviews (installer_id, created_at DESC);

-- Token lookup for submission
CREATE INDEX IF NOT EXISTS idx_ir_token
  ON installer_reviews (review_token);

-- Profile toggle for review visibility
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_reviews BOOLEAN DEFAULT true;

-- Add review_token to leads so we can generate it at job completion
ALTER TABLE leads ADD COLUMN IF NOT EXISTS review_token TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS review_submitted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_review_token
  ON leads (review_token) WHERE review_token IS NOT NULL;

-- RLS
ALTER TABLE installer_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (token-based auth, no login)
CREATE POLICY "Anyone can insert reviews"
  ON installer_reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Public can read published reviews
CREATE POLICY "Public can read published reviews"
  ON installer_reviews FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- Service role full access
CREATE POLICY "Service role full access on reviews"
  ON installer_reviews FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
