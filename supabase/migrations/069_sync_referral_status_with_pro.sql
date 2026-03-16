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
--      a paid Pro subscriber (has stripe_subscription_id, not just trial).
--   2. Trigger: automatically keep referral status in sync whenever
--      profiles.is_pro or stripe_subscription_id changes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Backfill existing referrals ────────────────────────────────────────
-- Only activate for PAID subscribers (stripe_subscription_id present).
-- Trial users have is_pro=true but no stripe_subscription_id — they should
-- stay 'pending' until they convert to a paid subscription.
UPDATE public.referrals r
SET status = 'active'
FROM public.profiles p
WHERE r.installer_id = p.id
  AND r.status = 'pending'
  AND p.is_pro = true
  AND p.stripe_subscription_id IS NOT NULL
  AND (p.is_suspended IS NULL OR p.is_suspended = false);

-- ── 2. Trigger: sync referral status when is_pro changes ─────────────────
CREATE OR REPLACE FUNCTION public.sync_referral_status_on_pro_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Activate referral when installer becomes a PAID Pro subscriber.
  -- This covers two cases:
  --   a) Non-pro → paid pro (is_pro flips true with stripe_subscription_id)
  --   b) Trial → paid (is_pro was already true, stripe_subscription_id gets set)
  IF NEW.is_pro = true AND NEW.stripe_subscription_id IS NOT NULL
     AND (OLD.is_pro IS DISTINCT FROM true
          OR OLD.stripe_subscription_id IS NULL) THEN
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
  AFTER UPDATE OF is_pro, stripe_subscription_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_referral_status_on_pro_change();
