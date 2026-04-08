-- ═══════════════════════════════════════════════════════════════════════════
-- 084: totes_disabled stored in pricing_config JSONB (no schema change needed)
--
-- The totes_disabled flag lives inside the pricing_config JSONB column
-- on profiles, not as a standalone column. This migration is a no-op
-- placeholder for documentation purposes.
-- ═══════════════════════════════════════════════════════════════════════════

-- No schema change needed. totes_disabled is stored as a key in
-- profiles.pricing_config JSONB alongside mini_enabled, open_shelving_enabled, etc.
-- Example: {"totes_disabled": true, "standard_slot": 25, ...}
SELECT 1;
