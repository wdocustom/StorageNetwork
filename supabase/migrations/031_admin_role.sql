-- ============================================================
-- Migration 031: Admin Role + Platform Visibility
--
-- Adds is_admin flag to profiles.
-- Admin users get an extra "All Platform Users" view in the
-- Partner Portal showing every installer's analytics.
--
-- Seed: info@wdocustom.com → is_admin = true, is_partner = true
-- ============================================================

-- Add admin flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Seed: mark the WDO Custom account as admin + partner.
-- This runs as an UPDATE on the email column — safe if account
-- doesn't exist yet (0 rows affected).
UPDATE public.profiles
SET is_admin = true,
    is_partner = true
WHERE email = 'info@wdocustom.com';

-- Helper: check admin status without triggering RLS recursion.
-- SECURITY DEFINER bypasses RLS so the profiles self-query doesn't
-- re-evaluate the same policy infinitely.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- Ensure admin can always read all profiles (for the admin panel)
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_admin()
  );

-- Ensure a partner record exists for WDO Custom so the portal loads
INSERT INTO public.partners (name, company, slug, email)
VALUES ('WDO Custom', 'WDO Custom', 'wdo-custom', 'info@wdocustom.com')
ON CONFLICT (slug) DO NOTHING;
