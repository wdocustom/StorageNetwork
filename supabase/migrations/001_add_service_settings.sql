-- ============================================================
-- Migration: Add service settings to profiles
-- Run this in the Supabase SQL Editor AFTER the initial schema.
-- ============================================================

-- Service configuration fields for installers
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS service_zip text,
  ADD COLUMN IF NOT EXISTS service_radius_miles integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS service_settings jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_zips text[] NOT NULL DEFAULT '{}';

-- GIN index for fast @> (contains) lookups on the zip array
CREATE INDEX IF NOT EXISTS idx_profiles_service_zips
  ON public.profiles USING GIN (service_zips);
