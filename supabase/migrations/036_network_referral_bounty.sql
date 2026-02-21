-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 036: Network Referral Bounty
--
-- Adds referral tracking to the leads table so that when Installer A
-- drives traffic that lands outside their service area, the lead gets
-- routed to a local Installer B, and Installer A earns a $15 bounty
-- when the deposit is captured.
--
-- Schema changes:
--   leads.referring_installer_id  (UUID, nullable FK → profiles)
--   leads.bounty_status           (text: 'none' | 'pending' | 'paid')
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Add referring_installer_id to leads ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'leads'
      AND column_name  = 'referring_installer_id'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN referring_installer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

    CREATE INDEX idx_leads_referring_installer_id
      ON public.leads (referring_installer_id)
      WHERE referring_installer_id IS NOT NULL;
  END IF;
END $$;

-- ── Add bounty_status to leads ───────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'leads'
      AND column_name  = 'bounty_status'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN bounty_status TEXT NOT NULL DEFAULT 'none'
      CHECK (bounty_status IN ('none', 'pending', 'paid'));
  END IF;
END $$;

-- ── RLS policies for referring_installer_id ──────────────────────────────
-- Referring installers can read leads they referred (for dashboard card)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename  = 'leads'
      AND policyname = 'Referring installers can view their referred leads'
  ) THEN
    CREATE POLICY "Referring installers can view their referred leads"
      ON public.leads
      FOR SELECT
      USING (referring_installer_id = auth.uid());
  END IF;
END $$;
