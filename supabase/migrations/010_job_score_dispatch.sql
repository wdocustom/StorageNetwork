-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 010: Job Score, Dispatch, and Job Status Tracking
-- Adds merit-based dispatch fields to profiles and job tracking to leads.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Profiles: Merit / Dispatch Columns ─────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_score       integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS completed_jobs  integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier            text    DEFAULT 'rookie';

-- ── Leads: Job Tracking Columns ────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS zip_code               text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS material_cost_snapshot  numeric(10,2);

-- Ensure status supports the full lifecycle
-- (existing column, just ensure it has no constraint that blocks new values)
DO $$
BEGIN
  -- Drop old check if exists so we can add the expanded one
  ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
  ALTER TABLE leads ADD CONSTRAINT leads_status_check
    CHECK (status IN ('new', 'open', 'assigned', 'deposit_paid', 'completed', 'paid', 'cancelled'));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Status constraint already correct or could not be modified';
END $$;

-- ── Trigger: Auto-Increment Job Score on Payment ───────────────────────────
CREATE OR REPLACE FUNCTION fn_increment_job_score()
RETURNS trigger AS $$
BEGIN
  -- Only fire when status transitions TO 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    UPDATE profiles
    SET
      completed_jobs = COALESCE(completed_jobs, 0) + 1,
      job_score      = COALESCE(job_score, 0) + 1,
      tier           = CASE
                         WHEN COALESCE(job_score, 0) + 1 > 10 THEN 'pro'
                         ELSE COALESCE(tier, 'rookie')
                       END
    WHERE id = NEW.installer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_score_on_paid ON leads;

CREATE TRIGGER trg_job_score_on_paid
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_increment_job_score();

-- ── Index for zip-based dispatch queries ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_zip_code ON leads (zip_code);
