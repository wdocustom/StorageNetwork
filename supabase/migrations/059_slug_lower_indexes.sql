-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 059: Functional Indexes on slug / ref_slug
--
-- Queries now use exact-match (eq) with pre-lowered values. These
-- lower() indexes ensure the planner can use an index scan even if
-- an ilike query is ever reintroduced, and they cover any rows that
-- were inserted before the app normalized to lowercase on write.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_profiles_slug_lower
  ON public.profiles (lower(slug))
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_ref_slug_lower
  ON public.profiles (lower(ref_slug))
  WHERE ref_slug IS NOT NULL;
