-- ════════════════════════════════════════════════════════════════════════
-- 067 — Lumber Offcuts Inventory Tracking
--
-- Extends material_inventory JSONB to include lumber_offcuts array.
-- Tracks leftover 2x4 pieces from previous builds so mini unit builds
-- can reuse offcuts instead of purchasing fresh stock.
--
-- Updated shape:
--   { screws_1_5_8, screws_3, screws_1, plywood_strips, lumber_offcuts }
--   where lumber_offcuts = [{ length: <inches> }, ...]
--
-- No schema change needed — JSONB is schema-flexible.
-- Existing rows will get lumber_offcuts via normalizeInventory() in the
-- application layer (defaults to [] when absent).
-- ════════════════════════════════════════════════════════════════════════

-- Update the default for new profiles to include lumber_offcuts
ALTER TABLE profiles
  ALTER COLUMN material_inventory
  SET DEFAULT '{"screws_1_5_8":0,"screws_3":0,"screws_1":0,"plywood_strips":0,"lumber_offcuts":[]}';
