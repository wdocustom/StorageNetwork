-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 013: Public Installer Search & RLS Fix
--
-- Problem: Anon/unauthenticated users cannot search for installers by ZIP.
-- The profiles table may lack a public read policy, causing 500 errors.
-- Also: service_zips column from migration 001 may not exist yet.
--
-- Fix:
--   1. Ensure service columns exist (service_zip, service_zips, etc.)
--   2. Enable RLS on profiles
--   3. Add a public read policy for SELECT
--   4. Add ref_slug column for installer vanity URLs
--   5. Add indexes for search performance
-- ═══════════════════════════════════════════════════════════════════════════

-- Ensure service columns exist (migration 001 may not have been run)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS service_zip text,
  ADD COLUMN IF NOT EXISTS service_radius_miles integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS service_settings jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_zips text[] NOT NULL DEFAULT '{}';

-- Vanity slug for installer links (/design?ref=the-shelf-dude)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ref_slug text UNIQUE;

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Public read policy: anyone can see installer display info
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'public_installer_search'
  ) THEN
    CREATE POLICY public_installer_search ON public.profiles
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Indexes for search performance
CREATE INDEX IF NOT EXISTS idx_profiles_service_zip
  ON public.profiles (service_zip);

CREATE INDEX IF NOT EXISTS idx_profiles_service_zips
  ON public.profiles USING GIN (service_zips);
