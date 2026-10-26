-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 147: Installer splits on tote plan sales
--
-- Each confirmed tote plan purchase can send up to $5 to installers — the
-- installer who referred the customer, or the installers who own the
-- bestsellers in the plan (src/lib/plan-splits.ts). The Stripe webhook pays
-- each share as a Connect transfer and records it here.
--
-- Idempotency: UNIQUE(stripe_session_id, recipient_id) — the first insert
-- claims the share; webhook retries hit 23505 and stop. Failed transfers
-- stay 'failed' with a reason so they can be retried.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.plan_split_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT NOT NULL,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 500),
  reason TEXT NOT NULL CHECK (reason IN ('referral', 'bestseller')),
  -- bestseller preset ids behind a 'bestseller' share
  bestsellers TEXT[] NOT NULL DEFAULT '{}',
  plan_tier TEXT,
  design TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  stripe_transfer_id TEXT,
  failure_reason TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stripe_session_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS plan_split_payouts_recipient_idx
  ON public.plan_split_payouts (recipient_id, created_at DESC);

-- Service role only (webhook + admin tooling).
ALTER TABLE public.plan_split_payouts ENABLE ROW LEVEL SECURITY;
