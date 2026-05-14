-- ═══════════════════════════════════════════════════════════════════════════
-- 117 — Gift recipient phone + early-pickup signal
--
-- Two adjacent feature columns for the installer per-job detail page and
-- the recipient's "I'm done early" flow:
--
--   recipient_phone           — Optional. Captured by the realtor at gift
--                               creation. Surfaced to the installer on the
--                               per-job detail page as a tel: / sms: link so
--                               they can coordinate delivery and pickup
--                               without going through email.
--
--   pickup_early_requested_at — Set when the recipient hits "Ready for
--                               pickup" on /gift/{token} before their
--                               rental window closes. Triggers an installer
--                               alert email and surfaces as a banner on the
--                               installer's per-job page so they can swing
--                               by sooner.
--
--   pickup_early_note         — Optional free-form note from the recipient
--                               (e.g. "We're done — anytime tomorrow works")
--                               displayed alongside the banner.
--
-- All three columns are nullable; no existing rows are touched. The
-- early-pickup flow doesn't change the gift status — markGiftReturned still
-- runs the same flipMilestone path. The signal is just informational.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tote_rental_gifts
  ADD COLUMN IF NOT EXISTS recipient_phone           text        NULL,
  ADD COLUMN IF NOT EXISTS pickup_early_requested_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pickup_early_note         text        NULL;

COMMENT ON COLUMN public.tote_rental_gifts.recipient_phone IS
  'Optional recipient phone, captured by the realtor at gift creation. '
  'Surfaced to the installer on the per-job detail page as tel:/sms: links.';

COMMENT ON COLUMN public.tote_rental_gifts.pickup_early_requested_at IS
  'Timestamp the recipient signaled they''re ready for pickup before the '
  'rental window closes. NULL until the recipient hits the button.';

COMMENT ON COLUMN public.tote_rental_gifts.pickup_early_note IS
  'Optional free-form note from the recipient when signaling early pickup. '
  'NULL when no note or no signal.';

-- Partial index over rows the installer dashboard cares about — i.e. only
-- gifts where pickup_early_requested_at IS NOT NULL. Lets the installer
-- query "show me jobs where the recipient wants pickup now" cheaply
-- without scanning the whole table.
CREATE INDEX IF NOT EXISTS idx_tote_rental_gifts_pickup_early
  ON public.tote_rental_gifts (installer_id, pickup_early_requested_at DESC)
  WHERE pickup_early_requested_at IS NOT NULL;
