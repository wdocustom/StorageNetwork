-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 094: Shared Territories with Tiered Priority
--
-- Replaces exclusive ZIP ownership with shared territories. Multiple
-- installers can now cover the same ZIP code. When a customer searches
-- a ZIP, the platform ranks matching installers by tiered priority:
--
--   1. Pro tier installers beat Basic tier
--   2. More completed_jobs = higher priority
--   3. Fewer current_month_leads = higher priority (fair distribution)
--   4. Capacity and suspension filters still apply
--
-- The PRIMARY KEY changes from (zip) to (zip, installer_id) — allowing
-- multiple installers to own the same ZIP code.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Drop the old PRIMARY KEY (zip only) and recreate as composite
--    First drop dependent objects
DROP INDEX IF EXISTS idx_territory_zips_installer;
DROP INDEX IF EXISTS idx_territory_zips_home;

-- Drop existing RLS policies so we can recreate the table cleanly
DROP POLICY IF EXISTS "Anyone can view territories" ON public.territory_zips;
DROP POLICY IF EXISTS "Service role manages territories" ON public.territory_zips;

-- Recreate the table with composite primary key
-- We need to migrate data, so: rename old → create new → copy → drop old
ALTER TABLE public.territory_zips RENAME TO territory_zips_old;

CREATE TABLE public.territory_zips (
  zip          TEXT        NOT NULL,
  installer_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_home_zip  BOOLEAN     NOT NULL DEFAULT false,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (zip, installer_id)
);

-- Copy existing data
INSERT INTO public.territory_zips (zip, installer_id, is_home_zip, assigned_at)
SELECT zip, installer_id, is_home_zip, assigned_at
FROM public.territory_zips_old;

-- Drop old table
DROP TABLE public.territory_zips_old;

-- 2. Recreate indexes
CREATE INDEX idx_territory_zips_installer
  ON public.territory_zips (installer_id);

CREATE INDEX idx_territory_zips_home
  ON public.territory_zips (installer_id)
  WHERE is_home_zip = true;

-- 3. Recreate RLS policies
ALTER TABLE public.territory_zips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view territories"
  ON public.territory_zips
  FOR SELECT
  USING (true);

CREATE POLICY "Service role manages territories"
  ON public.territory_zips
  FOR ALL
  USING (auth.role() = 'service_role');
