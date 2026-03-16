-- ════════════════════════════════════════════════════════════════════════
-- 068 — Material Pricing Config
--
-- Adds a JSONB column to profiles for installer-specific material costs
-- and custom screw packaging. Replaces the localStorage-based approach
-- previously used on the /build page.
--
-- Shape:
-- {
--   "lumber_2x4_8ft": 3.50,
--   "plywood_sheet": 30.00,
--   "tote": 7.99,
--   "wheels_4pk": 25.00,
--   "screw_1in": { "count": 90, "price": 10.99, "label": "90ct box" },
--   "screw_1_5_8in": { "count": 1000, "price": 45.00, "label": "25 lbs bucket" },
--   "screw_3in": { "count": 137, "price": 8.97, "label": "137ct box" },
--   "overhead_lag_bolt": { "count": 50, "price": 12.00, "label": "50ct box" },
--   "overhead_structural_screw": { "count": 100, "price": 8.00, "label": "100ct box" }
-- }
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS material_pricing_config JSONB DEFAULT NULL;
