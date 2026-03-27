-- ═══════════════════════════════════════════════════════════════════════════
-- 079: Installer Activity Log
-- Tracks every meaningful action an authenticated installer takes on the
-- platform — page views, lead interactions, profile edits, downloads, etc.
-- Used by platform admin to monitor installer behavior patterns.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS installer_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,           -- e.g. 'page_view', 'lead_view', 'profile_edit', 'download_qr'
  page_path     TEXT,                    -- URL path visited
  detail        JSONB DEFAULT '{}',      -- flexible metadata (lead_id, field changed, etc.)
  ip_hash       TEXT,                    -- SHA-256 hash for pattern detection
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookups by installer + time
CREATE INDEX IF NOT EXISTS idx_ial_installer_created
  ON installer_activity_log (installer_id, created_at DESC);

-- Fast lookups by action type
CREATE INDEX IF NOT EXISTS idx_ial_action_created
  ON installer_activity_log (action, created_at DESC);

-- Fast admin queries across all installers
CREATE INDEX IF NOT EXISTS idx_ial_created
  ON installer_activity_log (created_at DESC);

-- RLS
ALTER TABLE installer_activity_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own activity
CREATE POLICY "Installers can insert own activity"
  ON installer_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = installer_id);

-- Service role can insert (for server actions)
CREATE POLICY "Service role full access"
  ON installer_activity_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Only service role can read (admin dashboard)
CREATE POLICY "Service role can read all"
  ON installer_activity_log FOR SELECT
  TO service_role
  USING (true);
