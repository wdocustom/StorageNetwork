-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 145: Admin installer outreach + complimentary ("comped") Pro
--
--   profiles.pro_comped      → admin granted Pro for free. is_pro stays true
--       with no Stripe subscription and no trial clock, so nothing bills the
--       installer and checkProTrial never expires them. Only the admin
--       toggle in the Partner Portal turns it off (back to Free).
--   profiles.pro_comped_at   → when it was granted (shown in the portal).
--
--   installer_outreach_emails → one row per admin-sent outreach email, so
--       the portal can show "last emailed" and avoid double-contacting.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_comped BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_comped_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.installer_outreach_emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_email      TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,                  -- merge tags already resolved
  message_id    TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installer_outreach_emails_installer
  ON public.installer_outreach_emails (installer_id, sent_at DESC);

ALTER TABLE public.installer_outreach_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "installer_outreach_emails_service_all" ON public.installer_outreach_emails
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "installer_outreach_emails_select_admin" ON public.installer_outreach_emails
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
