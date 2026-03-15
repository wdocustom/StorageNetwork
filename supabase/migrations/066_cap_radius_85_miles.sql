-- ════════════════════════════════════════════════════════════════════════
-- 066: Cap installer service radius at 85 miles
--
-- Reduces the max service radius from 100 → 85 miles.
-- Any installer currently at 86+ miles gets clamped to 85 and has their
-- custom delivery fee tiers reset so they don't have stale tiers
-- referencing distances beyond the new cap.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Reset delivery_fee_config for installers whose radius exceeds 85
UPDATE profiles
SET delivery_fee_config = NULL
WHERE service_radius_miles > 85
  AND delivery_fee_config IS NOT NULL;

-- 2. Clamp radius to 85 for anyone above the new cap
UPDATE profiles
SET service_radius_miles = 85
WHERE service_radius_miles > 85;

-- NOTE: service_zips arrays for affected installers still reflect the old
-- radius. They will be recomputed (via zipcodes.radius in JS) the next
-- time each installer saves their profile. Until then, matching is
-- slightly generous — a few extra ZIPs beyond 85 mi — which is harmless.
