-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 072: ZIP-Cluster Territory System
--
-- Replaces the 85-mile distance model with a ZIP-code ownership model.
-- Each installer owns a cluster of exclusive ZIP codes. No ZIP can ever
-- belong to two installers — enforced by PRIMARY KEY constraint.
--
-- Density-aware cluster sizes:
--   Urban core (NYC, SF):  ~15 ZIPs in ~7 mile radius
--   Urban (Dallas, ATL):   ~25 ZIPs in ~12 mile radius
--   Suburban:               ~40 ZIPs in ~20 mile radius
--   Rural:                  ~60 ZIPs in ~35 mile radius
--
-- This scales to 5,000–10,000+ installers nationally.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Keep lat/lng on profiles (useful for map display)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- 2. Drop the old 85-mile haversine trigger (if it was ever applied)
DROP TRIGGER IF EXISTS trg_territory_exclusivity ON public.profiles;
DROP FUNCTION IF EXISTS enforce_territory_exclusivity();
-- Keep haversine_miles() — it's a useful utility, no harm in keeping it
-- DROP FUNCTION IF EXISTS haversine_miles(double precision, double precision, double precision, double precision);

-- 3. Create the territory_zips table
--    PRIMARY KEY on zip = absolute guarantee no ZIP belongs to two installers
CREATE TABLE IF NOT EXISTS public.territory_zips (
  zip          TEXT        PRIMARY KEY,
  installer_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_home_zip  BOOLEAN     NOT NULL DEFAULT false,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup: "which ZIPs does this installer own?"
CREATE INDEX IF NOT EXISTS idx_territory_zips_installer
  ON public.territory_zips (installer_id);

-- Fast lookup: "who owns this ZIP's home base?" (for territory map display)
CREATE INDEX IF NOT EXISTS idx_territory_zips_home
  ON public.territory_zips (installer_id)
  WHERE is_home_zip = true;

-- 4. RLS policies for territory_zips
ALTER TABLE public.territory_zips ENABLE ROW LEVEL SECURITY;

-- Service role (server actions) has full access via bypass
-- Authenticated users can read all territories (for map/search)
CREATE POLICY "Anyone can view territories"
  ON public.territory_zips
  FOR SELECT
  USING (true);

-- Only service role can INSERT/UPDATE/DELETE (server actions handle this)
CREATE POLICY "Service role manages territories"
  ON public.territory_zips
  FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Backfill: Insert home ZIPs for existing installers
--    Uses DISTINCT ON to handle any duplicate service_zips (first signup wins)
--    ON CONFLICT DO NOTHING handles edge cases safely
INSERT INTO public.territory_zips (zip, installer_id, is_home_zip)
SELECT DISTINCT ON (p.service_zip)
  p.service_zip,
  p.id,
  true
FROM public.profiles p
WHERE p.service_zip IS NOT NULL
  AND p.service_zip != ''
  AND length(p.service_zip) = 5
ORDER BY p.service_zip, p.created_at ASC  -- First to sign up wins
ON CONFLICT (zip) DO NOTHING;

-- 6. Index on profiles lat/lng (for map features)
CREATE INDEX IF NOT EXISTS idx_profiles_lat_lng
  ON public.profiles (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
