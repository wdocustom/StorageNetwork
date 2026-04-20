-- ═══════════════════════════════════════════════════════════════════════════
-- 024: Founder Fee Override
--
-- Adds a per-installer platform_fee_override column to profiles.
-- When set (e.g., 0), the platform uses this rate instead of the
-- default 15%/5% fee structure. NULL = use defaults.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS platform_fee_override numeric DEFAULT NULL;

COMMENT ON COLUMN profiles.platform_fee_override IS
  'Per-installer platform fee rate override (0–1 scale, e.g., 0 = no fee). NULL = use default tier rates.';
