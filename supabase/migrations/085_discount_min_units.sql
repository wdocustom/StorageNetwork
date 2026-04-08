-- ═══════════════════════════════════════════════════════════════════════════
-- 085: Add min_units to discount codes for bundle/volume discounts
--
-- Allows installers to require a minimum number of units in the order
-- before a discount code can be applied. NULL = no minimum (any order).
-- Multi-unit bestseller presets (e.g. Indiana Joe = 3 units) count
-- as their number of sub-units toward the minimum.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS min_units integer DEFAULT NULL;

COMMENT ON COLUMN discount_codes.min_units IS 'Minimum number of units required in the order for this code to be valid. NULL = no minimum.';
