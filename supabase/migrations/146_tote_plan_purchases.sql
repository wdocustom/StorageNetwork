-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 146: Retail tote organizer plans on public_plan_purchases
--
-- Tote organizer plans are sold to retail (non-installer) customers in two
-- tiers — a printable PDF and the interactive 3D build guide. They share the
-- guest-checkout ledger with the chair plans (plan_id = 'tote-organizer') so
-- "Resend my link" on /plans finds every plan an email address bought.
--
--   tier          → 'pdf' | 'interactive'; NULL for the static HTML plans
--   build_config  → the unit the plan was generated for
--                   ({cols, rows, toteType, hasWheels, hasTop})
--   upgraded_at   → set when a 'pdf' purchase is upgraded to 'interactive'
--   upgrade_stripe_session_id → the upgrade checkout, for idempotency
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.public_plan_purchases
  ADD COLUMN IF NOT EXISTS tier TEXT
    CHECK (tier IS NULL OR tier IN ('pdf', 'interactive')),
  ADD COLUMN IF NOT EXISTS build_config JSONB,
  ADD COLUMN IF NOT EXISTS upgraded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS upgrade_stripe_session_id TEXT UNIQUE;

-- Service role only, like the rest of this table: buyers never hold a
-- Supabase session, they hold the access_token from their email.
ALTER TABLE public.public_plan_purchases ENABLE ROW LEVEL SECURITY;
