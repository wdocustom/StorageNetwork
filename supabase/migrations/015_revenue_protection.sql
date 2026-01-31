-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 015: Revenue Protection — Lead Caps & Subscription Tiers
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_monthly_leads     integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS current_month_leads   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_tier     text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS leads_reset_at        timestamptz NOT NULL DEFAULT date_trunc('month', now());

-- Index for lead cap queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier
  ON public.profiles (subscription_tier);

-- Function to auto-reset monthly lead counts on the 1st
CREATE OR REPLACE FUNCTION reset_monthly_leads()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.profiles
  SET current_month_leads = 0,
      leads_reset_at = date_trunc('month', now())
  WHERE leads_reset_at < date_trunc('month', now());
END;
$$;
