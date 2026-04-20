-- ════════════════════════════════════════════════════════════════════════
-- 045 — Material Inventory Tracking
--
-- Adds a JSONB column to profiles to track running material inventory
-- across jobs. The system tracks individual screw counts and plywood
-- strip offcuts so that the next job's material list only shows what
-- actually needs to be purchased.
--
-- Shape: { screws_1_5_8, screws_3, screws_1, plywood_strips }
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS material_inventory JSONB
  DEFAULT '{"screws_1_5_8":0,"screws_3":0,"screws_1":0,"plywood_strips":0}';
