-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 058: Enable RLS on leads table
--
-- CRITICAL: The leads table had RLS disabled, exposing all customer PII
-- (names, emails, phones, addresses, payment amounts) to anyone with the
-- public anon key. This migration locks it down.
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Installers can read leads assigned to them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leads' AND policyname = 'Installers can view own leads'
  ) THEN
    CREATE POLICY "Installers can view own leads"
      ON public.leads
      FOR SELECT
      USING (installer_id = auth.uid());
  END IF;
END $$;

-- Referring installers can already view referred leads (migration 036)
-- That policy is now active since RLS is enabled.

-- Authenticated users can insert leads (for booking flow via server actions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leads' AND policyname = 'Authenticated users can insert leads'
  ) THEN
    CREATE POLICY "Authenticated users can insert leads"
      ON public.leads
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Installers can update their own leads (status changes, scheduling)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leads' AND policyname = 'Installers can update own leads'
  ) THEN
    CREATE POLICY "Installers can update own leads"
      ON public.leads
      FOR UPDATE
      USING (installer_id = auth.uid());
  END IF;
END $$;

-- Service role gets full access (webhooks, server actions use service role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leads' AND policyname = 'Service role full access on leads'
  ) THEN
    CREATE POLICY "Service role full access on leads"
      ON public.leads
      FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Anon users can insert leads (public booking form creates leads before auth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leads' AND policyname = 'Anon can insert leads'
  ) THEN
    CREATE POLICY "Anon can insert leads"
      ON public.leads
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Grant appropriate permissions
GRANT SELECT, UPDATE ON public.leads TO authenticated;
GRANT INSERT ON public.leads TO anon;
GRANT INSERT ON public.leads TO authenticated;
