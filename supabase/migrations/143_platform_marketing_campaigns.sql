-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 143: Platform-driven marketing campaigns
--
-- Lets the platform email past customers ("order another rack from your
-- installer") and have the resulting order billed as a NETWORK lead (15%
-- platform fee) instead of a direct partner_link lead (3%), because the
-- platform — not the installer — brought the customer back.
--
--   leads.source = 'platform_campaign'   → billed at the network rate. One
--       value covers every current and future platform-sent campaign; WHICH
--       campaign is tracked via leads.marketing_send_id → marketing_email_sends.
--   marketing_campaigns        → one row per campaign (key, attribution window)
--   marketing_email_sends      → one row per recipient per campaign. Its id is
--       the unguessable token carried in the email's links (?mc=<id>). It is
--       how a booking is attributed server-side — the client can never claim
--       the campaign source on its own.
--   customer_marketing_optouts → customers who opted out of PROMOTIONAL
--       email. Consulted ONLY by campaign senders. Transactional email
--       (receipts, tracking, balance links, scheduling) never reads this
--       table, and it is deliberately separate from cold_email_suppressions
--       (the installer-recruiting list), so opting out here cannot affect
--       anything else the customer has ordered or will order.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. leads.source: allow 'platform_campaign' ────────────────────────────
-- Same drop-and-recreate pattern as migration 046. Includes every value the
-- app writes today (facebook_referral included) so the constraint can't
-- reject a legitimate lead.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'leads'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%source%'
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN (
    'platform', 'partner_link', 'installer_manual', 'affiliate',
    'network', 'self', 'facebook_referral', 'platform_campaign'
  ));

-- ── 2. marketing_campaigns ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key              TEXT NOT NULL UNIQUE,          -- e.g. 'repeat-order-2026-10'
  name             TEXT NOT NULL,
  -- How long after the email a booking still counts as campaign-driven.
  attribution_days INTEGER NOT NULL DEFAULT 60 CHECK (attribution_days > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. marketing_email_sends ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_email_sends (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,                -- lowercased
  installer_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_lead_id    UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  message_id        TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  converted_at      TIMESTAMPTZ,
  -- One email per customer per campaign — also what makes a double-run safe.
  UNIQUE (campaign_id, email)
);

CREATE INDEX IF NOT EXISTS idx_marketing_email_sends_email
  ON public.marketing_email_sends (email);

-- ── 4. leads.marketing_send_id ────────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS marketing_send_id UUID
  REFERENCES public.marketing_email_sends(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_marketing_send_id
  ON public.leads (marketing_send_id) WHERE marketing_send_id IS NOT NULL;

-- ── 5. customer_marketing_optouts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_marketing_optouts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,            -- lowercased
  source_send_id UUID REFERENCES public.marketing_email_sends(id) ON DELETE SET NULL,
  opted_out_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 6. RLS: service role + admin read only ────────────────────────────────
ALTER TABLE public.marketing_campaigns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_email_sends      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_marketing_optouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_campaigns_service_all" ON public.marketing_campaigns
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "marketing_email_sends_service_all" ON public.marketing_email_sends
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "customer_marketing_optouts_service_all" ON public.customer_marketing_optouts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "marketing_campaigns_select_admin" ON public.marketing_campaigns
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
CREATE POLICY "marketing_email_sends_select_admin" ON public.marketing_email_sends
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
CREATE POLICY "customer_marketing_optouts_select_admin" ON public.customer_marketing_optouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
