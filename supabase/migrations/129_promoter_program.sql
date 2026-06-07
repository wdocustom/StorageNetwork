-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 129: Promoter Program — referral links + individualized
-- Stripe-split commissions on "plans" sales (chair plans, DIY plans, etc.)
--
-- Separate from (and does not modify):
--   • affiliate_applications / affiliate_agreements / affiliate_payouts
--     (migration 105) — that program pays installer-recruitment cuts off
--     SUBSCRIPTION INVOICES. This program pays a cut of one-time PLAN
--     SALES. Different trigger, different money flow — kept in its own
--     tables so neither program's indexes or webhook branches collide.
--   • realtor_referral_* (migration 119) — the referral-code/cookie/
--     attribution shape is borrowed (same UX), but promoters are
--     installers (not a separate role with its own signup flow), and
--     they're paid in cash via Stripe Connect transfers, not totes.
--
-- Tables:
--   promoter_applications — installer applies once at a time
--   promoter_agreements   — admin-proposed, individualized cut per promoter
--                           ({ "type": "percentage", "percent": N }),
--                           accepted by the promoter to go live
--   promoter_payouts      — audit log of every Stripe transfer (one row
--                           per converted sale, idempotent on session id)
--
-- Profile extensions:
--   profiles.is_promoter            — gates the Promoter Portal UI
--   profiles.promoter_referral_code — per-promoter share slug (unique),
--                                     lazily generated like realtors'
--
-- Attribution columns (mirrors leads.referred_by_realtor_id):
--   public_plan_purchases.referred_by_promoter_id
--   public_plan_purchases.promoter_referral_code_snapshot
--
-- Authenticated-installer plan purchases (chair_plan / chair_bundle / etc.)
-- have no intermediate row today — attribution for those rides in the
-- Stripe Checkout session metadata (promoter_id, promoter_referral_code)
-- and is read directly by the webhook at payout time. No profile/purchase
-- table changes are needed for that path.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Promoter role flag + referral slug ──────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_promoter BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS promoter_referral_code TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_promoter_referral_code_key;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_promoter_referral_code_key UNIQUE (promoter_referral_code);

CREATE INDEX IF NOT EXISTS idx_profiles_promoter_referral_code
  ON public.profiles (promoter_referral_code)
  WHERE promoter_referral_code IS NOT NULL;

COMMENT ON COLUMN public.profiles.promoter_referral_code IS
  'Per-promoter share slug. Lazily generated on first portal load. Maps '
  'to Stripe Checkout session metadata (promoter_id) when a customer '
  'buys plans through /promo/<code>. Promoters only — others leave NULL.';

-- ── Attribution columns on public_plan_purchases (guest checkouts) ──────
ALTER TABLE public.public_plan_purchases
  ADD COLUMN IF NOT EXISTS referred_by_promoter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.public_plan_purchases
  ADD COLUMN IF NOT EXISTS promoter_referral_code_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_plan_purchases_referred_by_promoter
  ON public.public_plan_purchases (referred_by_promoter_id)
  WHERE referred_by_promoter_id IS NOT NULL;

-- ── 1. promoter_applications ─────────────────────────────────────────────
-- Mirrors affiliate_applications (migration 105) shape exactly.
CREATE TABLE IF NOT EXISTS public.promoter_applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  application_data  JSONB NOT NULL DEFAULT '{}',
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promoter_applications_applicant
  ON public.promoter_applications (applicant_id);

CREATE INDEX IF NOT EXISTS idx_promoter_applications_status_submitted
  ON public.promoter_applications (status, submitted_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_promoter_pending_per_applicant
  ON public.promoter_applications (applicant_id)
  WHERE status = 'pending';

ALTER TABLE public.promoter_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promoter_applications_select_own" ON public.promoter_applications
  FOR SELECT USING (applicant_id = auth.uid());

CREATE POLICY "promoter_applications_select_admin" ON public.promoter_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "promoter_applications_insert_own" ON public.promoter_applications
  FOR INSERT WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "promoter_applications_update_admin" ON public.promoter_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "promoter_applications_update_self_withdraw" ON public.promoter_applications
  FOR UPDATE USING (applicant_id = auth.uid())
  WITH CHECK (applicant_id = auth.uid() AND status = 'withdrawn');

CREATE POLICY "promoter_applications_service_all" ON public.promoter_applications
  FOR ALL USING (auth.role() = 'service_role');

-- ── 2. promoter_agreements ───────────────────────────────────────────────
-- agreement_config (JSONB) shape — individualized per promoter:
--   { "type": "percentage", "percent": 20 }
--
-- Deliberately simpler than affiliate_agreements: one-time sales don't
-- have a recurring "active recruit count" to tier against, so only the
-- percentage-of-sale shape is supported. Validation lives in the server
-- action; the DB stores the structure as-is so the shape can evolve
-- without a migration.
CREATE TABLE IF NOT EXISTS public.promoter_agreements (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id           UUID REFERENCES public.promoter_applications(id) ON DELETE SET NULL,
  status                   TEXT NOT NULL DEFAULT 'proposed'
                           CHECK (status IN ('proposed', 'active', 'paused', 'terminated')),
  agreement_config         JSONB NOT NULL,
  terms_markdown           TEXT,
  accepted_at              TIMESTAMPTZ,
  accepted_terms_version   TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminated_at            TIMESTAMPTZ,
  terminated_reason        TEXT
);

CREATE INDEX IF NOT EXISTS idx_promoter_agreements_promoter
  ON public.promoter_agreements (promoter_id);

CREATE INDEX IF NOT EXISTS idx_promoter_agreements_status
  ON public.promoter_agreements (status);

-- One active / one proposed agreement per promoter — own namespace, does
-- not interact with the affiliate program's uniq_affiliate_* indexes, so
-- an installer can hold both an installer-recruitment affiliate agreement
-- AND a promoter agreement simultaneously if the business wants that.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_promoter_active_per_installer
  ON public.promoter_agreements (promoter_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_promoter_proposed_per_installer
  ON public.promoter_agreements (promoter_id)
  WHERE status = 'proposed';

ALTER TABLE public.promoter_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promoter_agreements_select_own" ON public.promoter_agreements
  FOR SELECT USING (promoter_id = auth.uid());

CREATE POLICY "promoter_agreements_select_admin" ON public.promoter_agreements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "promoter_agreements_service_all" ON public.promoter_agreements
  FOR ALL USING (auth.role() = 'service_role');

-- ── 3. promoter_payouts ──────────────────────────────────────────────────
-- One row per converted sale. Idempotent on (agreement_id, stripe_session_id)
-- so webhook retries never double-pay the same checkout session.
CREATE TABLE IF NOT EXISTS public.promoter_payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  agreement_id        UUID NOT NULL REFERENCES public.promoter_agreements(id) ON DELETE RESTRICT,
  stripe_session_id   TEXT NOT NULL,
  plan_id             TEXT,
  sale_amount_cents   INTEGER NOT NULL CHECK (sale_amount_cents >= 0),
  commission_cents    INTEGER NOT NULL CHECK (commission_cents >= 0),
  currency            TEXT NOT NULL DEFAULT 'usd',
  stripe_transfer_id  TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded')),
  failure_reason      TEXT,
  notes               TEXT,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_promoter_payout_session
  ON public.promoter_payouts (agreement_id, stripe_session_id);

CREATE INDEX IF NOT EXISTS idx_promoter_payouts_promoter
  ON public.promoter_payouts (promoter_id, created_at DESC);

ALTER TABLE public.promoter_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promoter_payouts_select_own" ON public.promoter_payouts
  FOR SELECT USING (promoter_id = auth.uid());

CREATE POLICY "promoter_payouts_select_admin" ON public.promoter_payouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "promoter_payouts_service_all" ON public.promoter_payouts
  FOR ALL USING (auth.role() = 'service_role');
