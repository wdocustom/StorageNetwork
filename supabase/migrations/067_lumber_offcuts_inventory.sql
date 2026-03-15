-- ════════════════════════════════════════════════════════════════════════
-- 067 — Lumber Offcuts & Mini Strip Inventory Tracking
--
-- Extends material_inventory JSONB to include:
--   - lumber_offcuts: leftover 2x4 pieces from previous builds
--   - plywood_strips_mini: 1"-wide mini rail strips (vs 1-7/8" standard)
--
-- Updated shape:
--   { screws_1_5_8, screws_3, screws_1, plywood_strips,
--     plywood_strips_mini, lumber_offcuts }
--
-- No schema change needed — JSONB is schema-flexible.
-- Existing rows get defaults via normalizeInventory() in the app layer.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ALTER COLUMN material_inventory
  SET DEFAULT '{"screws_1_5_8":0,"screws_3":0,"screws_1":0,"plywood_strips":0,"plywood_strips_mini":0,"lumber_offcuts":[]}';
