-- ============================================================
-- Migration 004: Partner Network schema updates
-- stripe_account_id, subscription_tier, lead source tracking
-- ============================================================

-- 1. PROFILES — Stripe Connect + subscription tier
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'pro'));

-- 2. LEADS — source tracking + payout status
-- source column may already exist; ensure constraint covers new values
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'paid', 'refunded'));

-- Ensure source column exists and allows our values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN source text DEFAULT 'platform';
  END IF;
END$$;

-- 3. INDEX for installer lookup on leads
CREATE INDEX IF NOT EXISTS idx_leads_installer_id
  ON public.leads (installer_id);

CREATE INDEX IF NOT EXISTS idx_leads_source
  ON public.leads (source);
