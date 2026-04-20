-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 037: Demand Signals
--
-- Captures uncovered ZIP demand in two forms:
--   1. Anonymous: customer checked a ZIP, no installer covers it (cold)
--   2. Waitlist:  customer left name + email + ZIP (warm)
--
-- When an installer onboards and their service_zips overlap with
-- unresolved demand signals, the platform can auto-notify waitlisted
-- customers and show the installer their area's demand count.
--
-- Lifecycle:
--   status = 'unresolved'  → no installer covers this ZIP yet
--   status = 'notified'    → customer was emailed about new installer
--   status = 'converted'   → customer became an actual lead
--   status = 'expired'     → signal aged out (>12 months, no action)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Create demand_signals table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.demand_signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip           TEXT NOT NULL,
  signal_type   TEXT NOT NULL DEFAULT 'anonymous'
                CHECK (signal_type IN ('anonymous', 'waitlist')),
  status        TEXT NOT NULL DEFAULT 'unresolved'
                CHECK (status IN ('unresolved', 'notified', 'converted', 'expired')),

  -- Contact info (NULL for anonymous signals)
  customer_name   TEXT,
  customer_email  TEXT,
  customer_phone  TEXT,

  -- Attribution: which installer's link brought them here (if any)
  source_installer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Resolution: which installer eventually covers this ZIP
  resolved_by_installer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at    TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────

-- Fast lookup: "how many unresolved signals exist for ZIP 90210?"
CREATE INDEX IF NOT EXISTS idx_demand_signals_zip_status
  ON public.demand_signals (zip, status);

-- Fast lookup: "all unresolved waitlist signals with contact info"
CREATE INDEX IF NOT EXISTS idx_demand_signals_waitlist_unresolved
  ON public.demand_signals (status, signal_type)
  WHERE status = 'unresolved' AND signal_type = 'waitlist';

-- Installer dashboard: "demand signals in my area"
CREATE INDEX IF NOT EXISTS idx_demand_signals_source_installer
  ON public.demand_signals (source_installer_id)
  WHERE source_installer_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.demand_signals ENABLE ROW LEVEL SECURITY;

-- Service role (webhooks, cron, server actions) gets full access implicitly.
-- Installers can view demand signals in their service area (read-only).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename  = 'demand_signals'
      AND policyname = 'Installers can view demand in their area'
  ) THEN
    CREATE POLICY "Installers can view demand in their area"
      ON public.demand_signals
      FOR SELECT
      USING (
        source_installer_id = auth.uid()
        OR resolved_by_installer_id = auth.uid()
      );
  END IF;
END $$;

-- Public can insert anonymous demand signals (no auth required)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename  = 'demand_signals'
      AND policyname = 'Anyone can create demand signals'
  ) THEN
    CREATE POLICY "Anyone can create demand signals"
      ON public.demand_signals
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;
