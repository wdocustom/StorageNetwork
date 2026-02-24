-- ═══════════════════════════════════════════════════════════════════════════
-- 041: Delivery Fee Config & Installer Street Address
--
-- Adds:
--   delivery_fee_config JSONB — per-installer distance-based delivery tiers
--   address_line1       TEXT  — installer street address for distance calc
--
-- Schema for delivery_fee_config:
-- {
--   "enabled": true,
--   "tiers": [
--     { "max_miles": 25,  "fee": 0,    "enabled": true,  "label": "0-25 mi" },
--     { "max_miles": 50,  "fee": 25,   "enabled": true,  "label": "25-50 mi" },
--     { "max_miles": 100, "fee": 50,   "enabled": false, "label": "50-100 mi" }
--   ]
-- }
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS delivery_fee_config JSONB DEFAULT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_line1 TEXT DEFAULT NULL;

-- Also add delivery_fee column to leads table for tracking
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT NULL;
