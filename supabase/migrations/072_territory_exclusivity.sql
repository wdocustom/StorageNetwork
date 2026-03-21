-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 072: Territory Exclusivity Enforcement
--
-- Adds lat/lng columns to profiles and a database-level trigger that
-- prevents any two active installers from having their service_zip
-- within 85 miles of each other.
--
-- This is the FINAL safety net — the Node.js layer (territory.ts) does
-- the primary check, but this trigger catches race conditions where two
-- signups happen simultaneously.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add latitude/longitude columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- 2. Create haversine distance function (returns miles)
CREATE OR REPLACE FUNCTION haversine_miles(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) RETURNS double precision
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  R constant double precision := 3959.0; -- Earth radius in miles
  dlat double precision;
  dlon double precision;
  a double precision;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat / 2.0) * sin(dlat / 2.0)
     + cos(radians(lat1)) * cos(radians(lat2))
     * sin(dlon / 2.0) * sin(dlon / 2.0);
  RETURN R * 2.0 * asin(sqrt(a));
END;
$$;

-- 3. Create trigger function that enforces 85-mile territory exclusivity
CREATE OR REPLACE FUNCTION enforce_territory_exclusivity()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  min_distance constant double precision := 85.0;
  conflict RECORD;
BEGIN
  -- Only enforce if this row has coordinates set
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only enforce for non-suspended installers
  IF NEW.is_suspended = true THEN
    RETURN NEW;
  END IF;

  -- Check distance to every other active installer
  SELECT
    p.id,
    p.business_name,
    haversine_miles(NEW.latitude, NEW.longitude, p.latitude, p.longitude) AS dist
  INTO conflict
  FROM public.profiles p
  WHERE p.id != NEW.id
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND p.service_zip IS NOT NULL
    AND (p.is_suspended IS NULL OR p.is_suspended = false)
    -- Quick bounding box pre-filter: ~1.5 degrees lat ≈ ~103 miles
    -- This avoids computing haversine for distant installers
    AND abs(p.latitude - NEW.latitude) < 1.5
    AND abs(p.longitude - NEW.longitude) < 2.0
    AND haversine_miles(NEW.latitude, NEW.longitude, p.latitude, p.longitude) < min_distance
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Territory conflict: another installer (%) is within % miles (minimum % miles required)',
      COALESCE(conflict.business_name, conflict.id::text),
      round(conflict.dist::numeric, 1),
      min_distance;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Create trigger on profiles table (fires on INSERT and UPDATE of service_zip or coordinates)
DROP TRIGGER IF EXISTS trg_territory_exclusivity ON public.profiles;

CREATE TRIGGER trg_territory_exclusivity
  BEFORE INSERT OR UPDATE OF service_zip, latitude, longitude
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_territory_exclusivity();

-- 5. Add index to speed up the bounding box pre-filter
CREATE INDEX IF NOT EXISTS idx_profiles_lat_lng
  ON public.profiles (latitude, longitude)
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND (is_suspended IS NULL OR is_suspended = false);
