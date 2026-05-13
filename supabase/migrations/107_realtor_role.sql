-- ═══════════════════════════════════════════════════════════════════════════
-- Realtor Role — Phase A1 (foundation)
--
-- Adds the realtor persona to the platform. Realtors are influencers who
-- broker the reusable-tote rental service: they purchase packages and gift
-- them to buyers/sellers during a move. The gift flow doubles as a
-- customer-acquisition funnel for the installer network (storage racks).
--
-- This migration just stands up the role + brokerage metadata. The package
-- catalog, gift orders, and fulfillment tables ship in PR A2 / A3.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_realtor boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS realtor_brokerage text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS realtor_license text;

-- Partial index — realtors are a small slice of profiles; only index the
-- rows that matter for the realtor portal lookup paths.
CREATE INDEX IF NOT EXISTS idx_profiles_is_realtor
  ON public.profiles (id)
  WHERE is_realtor = true;

-- ─── RLS helper ──────────────────────────────────────────────────────────
-- SECURITY DEFINER so the function can read its own row without triggering
-- the RLS policies that depend on it (same pattern as is_admin() in 031).

CREATE OR REPLACE FUNCTION public.is_realtor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_realtor = true
  );
$$;

COMMENT ON FUNCTION public.is_realtor() IS
  'True when the caller is signed in and has profiles.is_realtor = true. '
  'Used by RLS policies on tables owned by realtors.';
