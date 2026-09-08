-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 138: Record chargebacks and disputes
--
-- There was no dispute handling anywhere: no charge.dispute.* webhook branch,
-- no record of a chargeback, no alert to anyone. Disputes simply happened and
-- money disappeared from a Stripe balance with nothing in the app to show for
-- it.
--
-- Under direct charges (migration 137) the disputed amount and the $15 fee are
-- debited from the INSTALLER's connected account, not the platform's — so the
-- installer is the one who needs to know immediately, and they're the one who
-- has to submit evidence before Stripe's deadline. This table is what makes
-- that visible: one row per Stripe dispute, updated as it progresses.
--
-- `account_id` is the connected account debited (NULL for a dispute on a
-- platform-owned charge, e.g. a Pro subscription or a plans purchase).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.disputes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stripe identifiers. stripe_dispute_id is the idempotency anchor: Stripe
  -- sends several events per dispute (created, updated, closed) and each must
  -- land on the same row.
  stripe_dispute_id       TEXT NOT NULL UNIQUE,
  stripe_charge_id        TEXT,
  stripe_payment_intent_id TEXT,
  account_id              TEXT DEFAULT NULL,

  -- Who and what it's about. Nullable because a dispute can arrive for a
  -- charge we can't map back to a lead (a platform product, or metadata lost).
  lead_id             UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  installer_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Money, in cents, as Stripe reports it.
  amount_cents        INTEGER NOT NULL DEFAULT 0,
  fee_cents           INTEGER NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'usd',

  -- Stripe's own vocabulary, stored verbatim rather than mapped, so a status
  -- or reason Stripe adds later doesn't silently become a wrong value here.
  status              TEXT NOT NULL,
  reason              TEXT,

  -- Deadline for submitting evidence (from evidence_details.due_by).
  evidence_due_at     TIMESTAMPTZ DEFAULT NULL,

  -- Set when the dispute reaches a terminal status: 'won' or 'lost'.
  outcome             TEXT DEFAULT NULL,
  closed_at           TIMESTAMPTZ DEFAULT NULL,

  -- Alerting is idempotent on this: the installer gets one "you have a
  -- chargeback" email no matter how many times Stripe re-delivers the event.
  installer_alerted_at TIMESTAMPTZ DEFAULT NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_lead_id ON public.disputes (lead_id)
  WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disputes_installer_id ON public.disputes (installer_id)
  WHERE installer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes (status);

COMMENT ON TABLE public.disputes IS
  'One row per Stripe dispute (chargeback). Written by the charge.dispute.* webhook branches.';
COMMENT ON COLUMN public.disputes.account_id IS
  'Connected account debited for the dispute. NULL = platform-owned charge.';

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- An installer can see chargebacks against their own jobs — under direct
-- charges it's their money being pulled back, so hiding them would be wrong.
CREATE POLICY "disputes_select_own" ON public.disputes
  FOR SELECT USING (installer_id = auth.uid());

CREATE POLICY "disputes_select_admin" ON public.disputes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Writes come only from the webhook, which runs as the service role.
CREATE POLICY "disputes_service_all" ON public.disputes
  FOR ALL USING (auth.role() = 'service_role');
