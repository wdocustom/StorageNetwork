-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 098: Marketing Credits (AI Asset Forge)
--
-- Adds a per-installer credit balance used by the AI Asset Forge generator.
-- Each generated marketing asset costs 1 credit; new installers start with 10.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_credits INTEGER NOT NULL DEFAULT 10
  CHECK (marketing_credits >= 0);

-- Backfill any pre-existing rows that were added before the default kicked in.
UPDATE public.profiles
   SET marketing_credits = 10
 WHERE marketing_credits IS NULL;
