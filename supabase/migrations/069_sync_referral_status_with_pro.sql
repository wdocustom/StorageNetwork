-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 069: Sync referral status with Pro subscription state
--
-- Problem: Referral rows stay "pending" even after the installer becomes a
-- Pro subscriber.  The Stripe webhook (checkout.session.completed) is supposed
-- to flip status → 'active', but existing referrals were created before that
-- logic was added, or the webhook didn't fire for them.
--
-- Fix:
--   1. Backfill: set status='active' for any referral whose installer is
--      already is_pro=true (and not suspended).
--   2. Trigger: automatically keep referral status in sync whenever
--      profiles.is_pro changes, as a safety net alongside the webhook.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Backfill existing referrals ────────────────────────────────────────
UPDATE public.referrals r
SET status = 'active'
FROM public.profiles p
WHERE r.installer_id = p.id
  AND r.status = 'pending'
  AND p.is_pro = true
  AND (p.is_suspended IS NULL OR p.is_suspended = false);

-- ── 2. Trigger: sync referral status when is_pro changes ─────────────────
CREATE OR REPLACE FUNCTION public.sync_referral_status_on_pro_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Installer just became Pro → activate their referral
  IF NEW.is_pro = true AND (OLD.is_pro IS DISTINCT FROM true) THEN
    UPDATE public.referrals
    SET status = 'active'
    WHERE installer_id = NEW.id
      AND status IN ('pending', 'inactive');
  END IF;

  -- Installer lost Pro → deactivate their referral
  IF NEW.is_pro = false AND OLD.is_pro = true THEN
    UPDATE public.referrals
    SET status = 'inactive'
    WHERE installer_id = NEW.id
      AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to make migration re-runnable
DROP TRIGGER IF EXISTS trg_sync_referral_status ON public.profiles;

CREATE TRIGGER trg_sync_referral_status
  AFTER UPDATE OF is_pro ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_referral_status_on_pro_change();
