-- ═══════════════════════════════════════════════════════════════════════════
-- 064: Overhead Ceiling Storage — installer toggle + pricing columns
-- ═══════════════════════════════════════════════════════════════════════════

-- Add overhead storage toggle and pricing to the existing pricing_config JSONB,
-- keeping consistency with how other pricing overrides work in the platform.
-- No new tables needed — overhead storage pricing follows the same pattern as
-- shelving and bestseller pricing (stored in profiles.pricing_config).

-- Nothing to do here at the SQL level — overhead storage pricing fields are
-- stored in the existing profiles.pricing_config JSONB column alongside
-- existing keys like standard_slot, mini_tote, etc.
-- New keys: overhead_storage_disabled (boolean), overhead_storage_* (numeric overrides)

-- This migration is a no-op placeholder for documentation and ordering.
SELECT 1;
