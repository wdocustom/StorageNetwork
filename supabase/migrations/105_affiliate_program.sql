-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 105: Installer Affiliate Program — Phase 1 (Schema + Types only)
--
-- Purpose
-- ───────
-- A new self-serve installer-recruits-installer affiliate program. Each
-- approved affiliate gets a custom-negotiated cut of their recruits'
-- subscription revenue. This is SEPARATE from:
--   • The customer-side Network Bounty (30% of deposit) — untouched.
--   • The legacy `partners` + `referrals` tables (migration 025) — left in
--     place for now. Joe Long's Elite Storage Systems arrangement still
--     pays out via the existing flow until Phase 5 cuts it over.
--
-- This migration is INTENTIONALLY behavior-neutral — only schema, indexes,
-- and RLS policies are introduced. No reads, no writes, no cron, no
-- triggers, no Stripe wiring. Subsequent phases add the application flow
-- (Phase 2), admin approval + agreement assignment (Phase 3), the private
-- partner portal + acceptance (Phase 4), the Stripe payout pipeline that
-- replaces calculate_partner_commission (Phase 5), and the cold-email
-- referral capture with attribution (Phase 6).
--
-- Privacy invariant baked into RLS
-- ───────────────────────────────
-- Every table containing per-affiliate data has a SELECT policy keyed
-- to auth.uid(). An affiliate can only see rows that belong to them.
-- Admins (profiles.is_admin = true) get a separate policy that opens
-- read access to everything for the approval queue and oversight UI.
-- Service role bypasses RLS for server-side operations as in the
-- existing 025 / 077 / 091 migrations.
--
-- Tables created
-- ──────────────
--   affiliate_applications     — applications to join the program
--   affiliate_agreements       — per-affiliate cut config + lifecycle
--   affiliate_payouts          — audit log of every Stripe transfer
--   affiliate_email_invites    — cold-email invite tokens for Phase 6
--   cold_email_suppressions    — global opt-out list (CAN-SPAM)
--
-- Profile column added
--   profiles.referred_by_installer_id — locks the recruit ↔ recruiter
--     attribution at signup. Set once and immutable except by admin.
--     Distinct from the existing partner_id linkage in `referrals`.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. affiliate_applications ──────────────────────────────────────────────
-- An installer applies once at a time. Status moves:
--   pending → approved | rejected | withdrawn
-- Re-applying after a reject is allowed; a partial unique index enforces
-- only one pending application per applicant.

CREATE TABLE IF NOT EXISTS public.affiliate_applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  application_data  JSONB NOT NULL DEFAULT '{}',  -- form fields (why, how, audience, etc.)
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_applications_applicant
  ON public.affiliate_applications (applicant_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_applications_status_submitted
  ON public.affiliate_applications (status, submitted_at DESC);

-- One pending application per installer at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_affiliate_pending_per_applicant
  ON public.affiliate_applications (applicant_id)
  WHERE status = 'pending';

ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_applications_select_own" ON public.affiliate_applications
  FOR SELECT USING (applicant_id = auth.uid());

CREATE POLICY "affiliate_applications_select_admin" ON public.affiliate_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "affiliate_applications_insert_own" ON public.affiliate_applications
  FOR INSERT WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "affiliate_applications_update_admin" ON public.affiliate_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Applicant may withdraw (UPDATE status='withdrawn') their own pending app.
-- Server actions perform this with service role; this policy is a
-- defense-in-depth fallback for direct API access.
CREATE POLICY "affiliate_applications_update_self_withdraw" ON public.affiliate_applications
  FOR UPDATE USING (applicant_id = auth.uid())
  WITH CHECK (applicant_id = auth.uid() AND status = 'withdrawn');

CREATE POLICY "affiliate_applications_service_all" ON public.affiliate_applications
  FOR ALL USING (auth.role() = 'service_role');


-- ── 2. affiliate_agreements ────────────────────────────────────────────────
-- The custom contract between platform and affiliate. Status:
--   proposed (admin created)  →  active (affiliate accepted)
--   active                    →  paused | terminated
--
-- agreement_config (JSONB) shape — discriminated union by `type`:
--   { "type": "flat", "flat_amount_cents": 3500,
--     "flat_basis": "per_active_recruit_per_month" | "per_invoice",
--     "signup_bonus_cents"?: number }
--
--   { "type": "percentage", "percent": 30,
--     "signup_bonus_cents"?: number }
--
--   { "type": "tiered",
--     "tiers": [ { "max_active": 25, "amount_cents": 3500 },
--                { "max_active": null, "amount_cents": 2500 } ],
--     "basis": "per_active_recruit_per_month",
--     "signup_bonus_cents"?: number }
--
-- Validation lives in the server actions (Phase 3); the DB stores the
-- structure as-is so we can evolve the shape without migrations.

CREATE TABLE IF NOT EXISTS public.affiliate_agreements (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id           UUID REFERENCES public.affiliate_applications(id) ON DELETE SET NULL,
  status                   TEXT NOT NULL DEFAULT 'proposed'
                           CHECK (status IN ('proposed', 'active', 'paused', 'terminated')),
  agreement_config         JSONB NOT NULL,            -- see shape above
  duration_months          INTEGER,                    -- NULL = lifetime
  start_date               TIMESTAMPTZ,                -- set when accepted
  end_date                 TIMESTAMPTZ,                -- start + duration_months, computed on accept
  accepted_at              TIMESTAMPTZ,
  accepted_terms_version   TEXT,                       -- snapshot of T&Cs version at accept
  terms_markdown           TEXT,                       -- legal/boilerplate body shown to affiliate
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminated_at            TIMESTAMPTZ,
  terminated_reason        TEXT
);

CREATE INDEX IF NOT EXISTS idx_affiliate_agreements_affiliate
  ON public.affiliate_agreements (affiliate_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_agreements_status
  ON public.affiliate_agreements (status);

-- Only one active agreement per affiliate at a time. Re-negotiating means
-- terminating the existing active row before activating a new one.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_affiliate_active_per_installer
  ON public.affiliate_agreements (affiliate_id)
  WHERE status = 'active';

-- Likewise only one open `proposed` agreement awaiting acceptance.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_affiliate_proposed_per_installer
  ON public.affiliate_agreements (affiliate_id)
  WHERE status = 'proposed';

ALTER TABLE public.affiliate_agreements ENABLE ROW LEVEL SECURITY;

-- The affiliate sees ONLY their own agreement. This is the privacy
-- invariant the user explicitly required: no installer ever sees another
-- installer's terms.
CREATE POLICY "affiliate_agreements_select_own" ON public.affiliate_agreements
  FOR SELECT USING (affiliate_id = auth.uid());

CREATE POLICY "affiliate_agreements_select_admin" ON public.affiliate_agreements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "affiliate_agreements_service_all" ON public.affiliate_agreements
  FOR ALL USING (auth.role() = 'service_role');


-- ── 3. affiliate_payouts ───────────────────────────────────────────────────
-- One row per Stripe transfer attempt. Idempotent on
-- (agreement_id, stripe_invoice_id, kind) so the same recruit invoice
-- never pays out twice. Uses a separate `kind` field to allow both the
-- recurring revenue cut AND a one-time signup bonus from the same invoice.

CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  agreement_id        UUID NOT NULL REFERENCES public.affiliate_agreements(id) ON DELETE RESTRICT,
  recruit_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind                TEXT NOT NULL DEFAULT 'recurring'
                      CHECK (kind IN ('recurring', 'signup_bonus', 'manual_adjustment')),
  stripe_invoice_id   TEXT,                              -- populated for recurring + signup_bonus
  stripe_transfer_id  TEXT,                              -- populated after successful transfer
  amount_cents        INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency            TEXT NOT NULL DEFAULT 'usd',
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded')),
  failure_reason      TEXT,
  paid_at             TIMESTAMPTZ,
  notes               TEXT,                              -- admin-visible context for adjustments
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate
  ON public.affiliate_payouts (affiliate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_agreement
  ON public.affiliate_payouts (agreement_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status
  ON public.affiliate_payouts (status)
  WHERE status IN ('pending', 'processing', 'failed');

-- Idempotency: never pay twice for the same (agreement, invoice, kind).
-- recurring and signup_bonus from the same invoice are distinct rows,
-- which is why kind is part of the key.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_affiliate_payout_invoice_kind
  ON public.affiliate_payouts (agreement_id, stripe_invoice_id, kind)
  WHERE stripe_invoice_id IS NOT NULL;

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Affiliate sees their own payouts only.
CREATE POLICY "affiliate_payouts_select_own" ON public.affiliate_payouts
  FOR SELECT USING (affiliate_id = auth.uid());

CREATE POLICY "affiliate_payouts_select_admin" ON public.affiliate_payouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- All writes go through service-role server actions / webhooks.
CREATE POLICY "affiliate_payouts_service_all" ON public.affiliate_payouts
  FOR ALL USING (auth.role() = 'service_role');


-- ── 4. affiliate_email_invites ────────────────────────────────────────────
-- Cold-email invitations sent on behalf of a referring affiliate. The
-- invite_token travels in the URL and survives across sessions/devices,
-- giving robust attribution even when cookies are blocked or expire.
-- Phase 6 wires the email send + tracking; this table only defines the
-- shape.

CREATE TABLE IF NOT EXISTS public.affiliate_email_invites (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referring_installer_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prospect_email           TEXT NOT NULL,                 -- lowercased on insert
  prospect_name            TEXT,
  invite_token             TEXT NOT NULL UNIQUE,          -- random ≥32 chars; URL-safe
  status                   TEXT NOT NULL DEFAULT 'sent'
                           CHECK (status IN ('sent', 'opened', 'clicked', 'signed_up', 'unsubscribed', 'bounced')),
  subject_variant          TEXT,                          -- A/B testing later
  signed_up_user_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at                  TIMESTAMPTZ,
  opened_at                TIMESTAMPTZ,
  clicked_at               TIMESTAMPTZ,
  signed_up_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_affiliate_invites_referrer
  ON public.affiliate_email_invites (referring_installer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_invites_prospect_email
  ON public.affiliate_email_invites (prospect_email);

CREATE INDEX IF NOT EXISTS idx_affiliate_invites_status
  ON public.affiliate_email_invites (status);

ALTER TABLE public.affiliate_email_invites ENABLE ROW LEVEL SECURITY;

-- Referring installer sees only their own outbound invites.
CREATE POLICY "affiliate_invites_select_own" ON public.affiliate_email_invites
  FOR SELECT USING (referring_installer_id = auth.uid());

CREATE POLICY "affiliate_invites_select_admin" ON public.affiliate_email_invites
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "affiliate_invites_service_all" ON public.affiliate_email_invites
  FOR ALL USING (auth.role() = 'service_role');


-- ── 5. cold_email_suppressions ────────────────────────────────────────────
-- Global opt-out list. Once a prospect lands here, NO installer may email
-- them again through the affiliate invite flow. Sources:
--   user_unsubscribe — clicked the unsubscribe link
--   bounce            — hard bounce from Resend
--   spam_complaint    — feedback loop hit
--   admin_block       — admin manually blocked the address
--
-- Suppressions are not visible to installers (it would leak who else has
-- emailed a given prospect). Admin-only.

CREATE TABLE IF NOT EXISTS public.cold_email_suppressions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT NOT NULL UNIQUE,                -- lowercased on insert
  reason             TEXT NOT NULL
                     CHECK (reason IN ('user_unsubscribe', 'bounce', 'spam_complaint', 'admin_block')),
  source_invite_id   UUID REFERENCES public.affiliate_email_invites(id) ON DELETE SET NULL,
  notes              TEXT,
  suppressed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cold_email_suppressions_reason
  ON public.cold_email_suppressions (reason);

ALTER TABLE public.cold_email_suppressions ENABLE ROW LEVEL SECURITY;

-- Admin-only visibility (suppressions reveal cross-affiliate touch points).
CREATE POLICY "cold_email_suppressions_select_admin" ON public.cold_email_suppressions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "cold_email_suppressions_service_all" ON public.cold_email_suppressions
  FOR ALL USING (auth.role() = 'service_role');


-- ── 6. profiles.referred_by_installer_id ──────────────────────────────────
-- Lifetime, immutable-by-default attribution of a new installer to the
-- affiliate who recruited them. Set ONCE at signup based on (in priority):
--   1. invite_token in URL  (strongest — most explicit)
--   2. partner_ref cookie    (next strongest — survives cross-device)
--   3. last-touch fallback   (only when no token present)
-- Direct signups remain NULL and are unattributed forever (no retroactive
-- crediting). Admin can override via service-role update.
--
-- Distinct from `partners`/`referrals` (migration 025): that pair is for
-- the legacy hard-coded partner system. This column is for the new
-- self-serve affiliate program. The two systems coexist until Phase 5.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_installer_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_installer
  ON public.profiles (referred_by_installer_id)
  WHERE referred_by_installer_id IS NOT NULL;
