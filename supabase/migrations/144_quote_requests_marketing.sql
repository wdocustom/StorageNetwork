-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 144: Tie quote requests to the marketing email that prompted them
--
-- A customer who can't re-order a custom build online (custom add-ons, mini
-- units, shelving…) taps "Request a custom quote" on the campaign /book page.
-- That request carries the campaign send id, so when the installer builds the
-- quote from it the resulting lead is stored as source='platform_campaign'
-- (15% network fee) instead of 'installer_manual' (3%).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS marketing_send_id UUID
  REFERENCES public.marketing_email_sends(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_requests_marketing_send_id
  ON public.quote_requests (marketing_send_id) WHERE marketing_send_id IS NOT NULL;
