-- ============================================================
-- Migration 051: Installer Account Suspension
--
-- Adds suspension columns to profiles so an admin can manually
-- suspend an installer, or the system can flag a subscription
-- payment failure.
--
-- suspension_reason:
--   'manual'  → admin-initiated via partner portal
--   'payment' → subscription payment failed / missing
--
-- Trial protection: the app layer will never auto-suspend an
-- installer whose pro_trial_ends_at is in the future AND who
-- has fewer than 3 completed orders AND is within 45 days.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT DEFAULT NULL
    CHECK (suspension_reason IN ('manual', 'payment'));

-- Allow admin to update suspension fields on any profile
DROP POLICY IF EXISTS "Admins can update suspension" ON public.profiles;
CREATE POLICY "Admins can update suspension"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
