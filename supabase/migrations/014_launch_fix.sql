-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 014: Launch Stabilization — Bulletproof Idempotent Fix
--
-- This migration is designed to run cleanly on ANY database state, even if
-- previous migrations (001, 011, 012, 013) partially or fully failed.
-- Every statement is idempotent: ADD COLUMN IF NOT EXISTS, DO $$ blocks, etc.
-- ═══════════════════════════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ STEP 1: PROFILES — Installer Search & Public Display                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS service_zip            text,
  ADD COLUMN IF NOT EXISTS service_radius_miles   integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS service_settings       jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_zips           text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ref_slug               text,
  ADD COLUMN IF NOT EXISTS phone                  text,
  ADD COLUMN IF NOT EXISTS avatar_url             text,
  ADD COLUMN IF NOT EXISTS lead_time_days         integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS working_days           text[] NOT NULL DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  ADD COLUMN IF NOT EXISTS max_daily_capacity     integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS tier                   text NOT NULL DEFAULT 'standard';

-- Unique constraint on ref_slug (skip if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ref_slug_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_ref_slug_key UNIQUE (ref_slug);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_service_zip
  ON public.profiles (service_zip);
CREATE INDEX IF NOT EXISTS idx_profiles_service_zips
  ON public.profiles USING GIN (service_zips);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'public_installer_search'
  ) THEN
    CREATE POLICY public_installer_search ON public.profiles
      FOR SELECT USING (true);
  END IF;
END $$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ STEP 2: LEADS — Scheduling, Capacity, Address                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS scheduled_at     timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS weight           integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS address_line1    text,
  ADD COLUMN IF NOT EXISTS address_line2    text,
  ADD COLUMN IF NOT EXISTS city             text,
  ADD COLUMN IF NOT EXISTS state            text,
  ADD COLUMN IF NOT EXISTS has_wheels       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_url        text,
  ADD COLUMN IF NOT EXISTS fee_status       text NOT NULL DEFAULT 'standard';

CREATE INDEX IF NOT EXISTS idx_leads_scheduled_at
  ON public.leads (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_leads_installer_scheduled
  ON public.leads (installer_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ STEP 3: STORAGE — job-photos Bucket & RLS Policies                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'job_photos_insert'
  ) THEN
    CREATE POLICY job_photos_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'job-photos');
  END IF;
END $$;

-- Anyone can view photos (public bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'job_photos_select'
  ) THEN
    CREATE POLICY job_photos_select ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'job-photos');
  END IF;
END $$;

-- Authenticated users can delete their own photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'job_photos_delete'
  ) THEN
    CREATE POLICY job_photos_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'job-photos');
  END IF;
END $$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ STEP 4: WAITLIST — Ensure table exists for landing page                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  zip_code   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ STEP 5: COMMUNICATION LOGS — For contact tracking                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.communication_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  installer_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type          text NOT NULL CHECK (type IN ('call','text','email','reschedule','note')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
