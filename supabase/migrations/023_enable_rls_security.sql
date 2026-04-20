-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 023: Enable Row Level Security (RLS)
-- Enables RLS on communication_logs and installer_blackout_dates tables
-- to prevent unauthorized access to sensitive data.
-- ═══════════════════════════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ COMMUNICATION LOGS — Installer-owned communication records               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own communication logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'communication_logs' AND policyname = 'comm_logs_select_own'
  ) THEN
    CREATE POLICY comm_logs_select_own ON public.communication_logs
      FOR SELECT
      USING (auth.uid() = created_by);
  END IF;
END $$;

-- Users can insert their own communication logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'communication_logs' AND policyname = 'comm_logs_insert_own'
  ) THEN
    CREATE POLICY comm_logs_insert_own ON public.communication_logs
      FOR INSERT
      WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;

-- Users can update their own communication logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'communication_logs' AND policyname = 'comm_logs_update_own'
  ) THEN
    CREATE POLICY comm_logs_update_own ON public.communication_logs
      FOR UPDATE
      USING (auth.uid() = created_by);
  END IF;
END $$;

-- Users can delete their own communication logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'communication_logs' AND policyname = 'comm_logs_delete_own'
  ) THEN
    CREATE POLICY comm_logs_delete_own ON public.communication_logs
      FOR DELETE
      USING (auth.uid() = created_by);
  END IF;
END $$;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_logs TO authenticated;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ INSTALLER BLACKOUT DATES — Installer scheduling availability             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.installer_blackout_dates ENABLE ROW LEVEL SECURITY;

-- Installers can read their own blackout dates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'installer_blackout_dates' AND policyname = 'blackout_select_own'
  ) THEN
    CREATE POLICY blackout_select_own ON public.installer_blackout_dates
      FOR SELECT
      USING (auth.uid() = installer_id);
  END IF;
END $$;

-- Installers can insert their own blackout dates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'installer_blackout_dates' AND policyname = 'blackout_insert_own'
  ) THEN
    CREATE POLICY blackout_insert_own ON public.installer_blackout_dates
      FOR INSERT
      WITH CHECK (auth.uid() = installer_id);
  END IF;
END $$;

-- Installers can update their own blackout dates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'installer_blackout_dates' AND policyname = 'blackout_update_own'
  ) THEN
    CREATE POLICY blackout_update_own ON public.installer_blackout_dates
      FOR UPDATE
      USING (auth.uid() = installer_id);
  END IF;
END $$;

-- Installers can delete their own blackout dates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'installer_blackout_dates' AND policyname = 'blackout_delete_own'
  ) THEN
    CREATE POLICY blackout_delete_own ON public.installer_blackout_dates
      FOR DELETE
      USING (auth.uid() = installer_id);
  END IF;
END $$;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installer_blackout_dates TO authenticated;
