-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 025: Tiered Affiliate Partner System
--
-- Tables:
--   partners  — partner details (name, company, vanity slug)
--   referrals — links installer signups to the partner who referred them
--
-- Profile extension:
--   profiles.is_partner — gates access to the Partner Portal UI
--
-- Function:
--   calculate_partner_commission(partner_id) — tiered payout engine
--     ≤50 active Pro referrals → $35/each
--     >50 active Pro referrals → $25/each
--     Free-tier installers are never counted
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Partners Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partners (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  company    TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Partners can read their own record
CREATE POLICY "partners_select_own" ON public.partners
  FOR SELECT USING (user_id = auth.uid());

-- Service role can do anything (for admin/webhook operations)
CREATE POLICY "partners_service_all" ON public.partners
  FOR ALL USING (auth.role() = 'service_role');

-- ── Referrals Table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  installer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'active', 'inactive')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_id, installer_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Partners can read referrals linked to them
CREATE POLICY "referrals_select_partner" ON public.referrals
  FOR SELECT USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
  );

-- Service role can do anything
CREATE POLICY "referrals_service_all" ON public.referrals
  FOR ALL USING (auth.role() = 'service_role');

-- ── Add is_partner flag to profiles ─────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT false;

-- ── Tiered Commission Engine ────────────────────────────────────────────
-- Returns: active_count, tier_rate, projected_monthly, tier_label
-- Only counts installers with status='active' AND profiles.is_pro=true
CREATE OR REPLACE FUNCTION public.calculate_partner_commission(p_partner_id UUID)
RETURNS TABLE (
  active_count     BIGINT,
  tier_rate        NUMERIC,
  projected_monthly NUMERIC,
  tier_label       TEXT
) AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.referrals r
  JOIN public.profiles p ON r.installer_id = p.id
  WHERE r.partner_id = p_partner_id
    AND r.status = 'active'
    AND p.is_pro = true;

  IF v_count <= 50 THEN
    RETURN QUERY SELECT
      v_count,
      35.0::NUMERIC,
      (v_count * 35)::NUMERIC,
      'Tier 1: $35/installer'::TEXT;
  ELSE
    RETURN QUERY SELECT
      v_count,
      25.0::NUMERIC,
      (v_count * 25)::NUMERIC,
      'Tier 2: $25/installer'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Seed: Joe Long — Elite Storage Systems ──────────────────────────────
-- user_id is NULL until Joe creates an account and an admin links it.
-- Once linked, set: UPDATE profiles SET is_partner = true WHERE id = <joe_user_id>;
INSERT INTO public.partners (name, company, slug, email)
VALUES ('Joe Long', 'Elite Storage Systems', 'elite', NULL)
ON CONFLICT (slug) DO NOTHING;
