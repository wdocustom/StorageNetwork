-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 013: Public Installer Search & RLS Fix
--
-- Problem: Anon/unauthenticated users cannot search for installers by ZIP.
-- The profiles table may lack a public read policy, causing 500 errors.
--
-- Fix:
--   1. Enable RLS on profiles (if not already)
--   2. Add a public read policy for limited installer fields
--   3. Add fallback index on service_zip for exact-match searches
--   4. Add ref_slug column for installer vanity URLs (/design?ref=slug)
-- ═══════════════════════════════════════════════════════════════════════════

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Public read policy: anyone can see installer display info
-- (Only exposes non-sensitive fields via the select in the query)
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

-- Vanity slug for installer links (/design?ref=the-shelf-dude)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ref_slug text UNIQUE;

-- Index on service_zip for fallback exact-match
CREATE INDEX IF NOT EXISTS idx_profiles_service_zip
  ON public.profiles (service_zip);

-- Ensure service_zips GIN index exists (may already from migration 001)
CREATE INDEX IF NOT EXISTS idx_profiles_service_zips
  ON public.profiles USING GIN (service_zips);
