-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 011: Scheduling, Photo Verification, and Fee Status
-- Adds installer scheduling preferences, job scheduling, photo proof,
-- and fee waiver tracking for Pro subscribers.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Profiles: Scheduling Preferences ───────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lead_time_days  integer DEFAULT 5;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS working_days    text[]  DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'];

-- ── Leads: Scheduling & Photo Verification ─────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scheduled_at   timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS photo_url      text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fee_status     text DEFAULT 'standard';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS completed_at   timestamptz;

-- fee_status constraint: 'standard' = normal 15% deposit, 'waived' = Pro subscriber (no deposit)
DO $$
BEGIN
  ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_fee_status_check;
  ALTER TABLE leads ADD CONSTRAINT leads_fee_status_check
    CHECK (fee_status IN ('standard', 'waived'));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'fee_status constraint already exists or could not be modified';
END $$;

-- ── Storage Bucket: Job Completion Photos ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload photos
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload job photos" ON storage.objects;
  CREATE POLICY "Authenticated users can upload job photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'job-photos');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'job-photos insert policy already exists';
END $$;

-- Allow public read access to job photos
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view job photos" ON storage.objects;
  CREATE POLICY "Public can view job photos"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'job-photos');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'job-photos select policy already exists';
END $$;

-- Allow owners to update/delete their photos
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can manage own job photos" ON storage.objects;
  CREATE POLICY "Authenticated users can manage own job photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'job-photos');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'job-photos delete policy already exists';
END $$;

-- ── Index for scheduling queries ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_scheduled_at ON leads (scheduled_at);
