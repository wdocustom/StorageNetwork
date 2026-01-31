-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 012: Production Core — Weight-Based Capacity & Address Fields
-- Adds job weight for capacity scheduling, customer address for job location,
-- installer phone/avatar, and communication log support.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Leads: Weight & Address ───────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS weight         integer DEFAULT 1;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS address_line1  text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS address_line2  text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS city           text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state          text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_wheels     boolean DEFAULT false;

-- ── Profiles: Installer Contact Info ──────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone       text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url  text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_daily_capacity integer DEFAULT 3;

-- ── Communication Logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communication_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id     uuid REFERENCES leads(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('call', 'text', 'email', 'reschedule', 'note')),
  message     text,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_logs_lead ON communication_logs (lead_id, created_at DESC);

-- ── Index for capacity queries (scheduled_at + installer_id) ─────────────
CREATE INDEX IF NOT EXISTS idx_leads_installer_scheduled
  ON leads (installer_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;
