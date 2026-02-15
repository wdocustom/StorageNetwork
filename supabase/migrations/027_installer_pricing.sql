-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 027: Installer Custom Pricing
--
-- Adds pricing_config JSONB to profiles, allowing Pro installers to set
-- their own customer-facing prices for tote slots, totes, wheels, and tops.
--
-- Schema: {
--   "standard_slot":       number,  -- per slot (default $30)
--   "mini_slot":           number,  -- per slot (default $15)
--   "standard_tote":       number,  -- per tote black (default $12)
--   "standard_tote_clear": number,  -- per tote clear (default $20)
--   "mini_tote":           number,  -- per tote mini (default $4)
--   "standard_wheels":     number,  -- flat fee (default $65)
--   "mini_wheels":         number,  -- flat fee (default $40)
--   "plywood_top":         number   -- per sheet (default $95)
-- }
--
-- NULL = use platform defaults.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pricing_config JSONB DEFAULT NULL;

-- Add a comment explaining the schema
COMMENT ON COLUMN public.profiles.pricing_config IS
  'Installer custom pricing overrides. NULL fields fall back to platform defaults. Pro-only feature.';
