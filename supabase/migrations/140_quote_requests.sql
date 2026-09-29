-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 140: Quote requests from returning customers
--
-- A past customer can ask their installer for a new quote from a link in
-- their receipt email, the review page / review-request email, or their
-- rack inventory email / page. The link is signed per job (no login). Each
-- request lands here and in the installer's Jobs / Leads → Requests tab, and
-- the installer is emailed. The installer builds the quote in the normal
-- create-quote flow, prefilled from the original job.
--
-- status:
--   open      → waiting on the installer
--   quoted    → installer sent a quote for it (quoted_lead_id)
--   dismissed → installer deleted it from the Requests tab (kept, not shown)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.quote_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The earlier job the request came from (drives the quote prefill).
  source_lead_id    UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id       UUID REFERENCES public.customers(id) ON DELETE SET NULL,

  -- Contact details as the customer confirmed them on the request page.
  customer_name     TEXT NOT NULL,
  customer_email    TEXT,
  customer_phone    TEXT,

  -- What they're after: quick picks (e.g. {"rack","addons"}) + free text.
  wants             TEXT[] NOT NULL DEFAULT '{}',
  notes             TEXT,

  -- Which link they came from: receipt | review | rack | other.
  origin            TEXT NOT NULL DEFAULT 'other',

  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'quoted', 'dismissed')),
  quoted_lead_id    UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_requests_installer_status
  ON public.quote_requests (installer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_requests_source_lead
  ON public.quote_requests (source_lead_id);

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

-- Re-runnable: drop before create so applying twice doesn't error.
DROP POLICY IF EXISTS "quote_requests_select_own" ON public.quote_requests;
CREATE POLICY "quote_requests_select_own" ON public.quote_requests
  FOR SELECT USING (installer_id = auth.uid());

-- Writes come only from server actions (service role).
DROP POLICY IF EXISTS "quote_requests_service_all" ON public.quote_requests;
CREATE POLICY "quote_requests_service_all" ON public.quote_requests
  FOR ALL USING (auth.role() = 'service_role');
