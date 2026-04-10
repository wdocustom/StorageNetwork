-- ═══════════════════════════════════════════════════════════════════════════
-- 088: use_2x4_rails stored in pricing_config JSONB (no schema change needed)
--
-- The use_2x4_rails flag lives inside the pricing_config JSONB column
-- on profiles, not as a standalone column. This migration is a no-op
-- placeholder for documentation purposes.
--
-- When enabled, the installer's builds use ripped 2x4 rails (1-3/4" wide)
-- instead of plywood strips. Openings are 21" universal (tote type irrelevant).
-- Rail heights: 13-3/4", 29-1/2", 45-1/4", 61", 76-3/4" (max 5 rows).
-- 6 rails per 2x4x8' piece (ripped in half, cut to 30" depth).
-- ═══════════════════════════════════════════════════════════════════════════

-- No schema change needed. use_2x4_rails is stored as a key in
-- profiles.pricing_config JSONB alongside totes_disabled, mini_enabled, etc.
-- Example: {"use_2x4_rails": true, "totes_disabled": true, ...}
SELECT 1;
