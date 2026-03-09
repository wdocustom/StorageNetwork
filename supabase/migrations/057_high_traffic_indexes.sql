-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 057: High-Traffic Indexes for 2.5M Subscriber Launch
--
-- Adds indexes on frequently filtered columns that currently require
-- full-table scans under high concurrency.
-- ═══════════════════════════════════════════════════════════════════════════

-- Leads filtered by status (e.g. WHERE status = 'new')
CREATE INDEX IF NOT EXISTS idx_leads_status
  ON public.leads (status);

-- Installer's leads filtered by status (dashboard: "my new leads")
CREATE INDEX IF NOT EXISTS idx_leads_installer_status
  ON public.leads (installer_id, status);

-- Activity feeds and pagination ordered by creation time
CREATE INDEX IF NOT EXISTS idx_leads_created_at_desc
  ON public.leads (created_at DESC);

-- Profile lookups and pagination ordered by creation time
CREATE INDEX IF NOT EXISTS idx_profiles_created_at_desc
  ON public.profiles (created_at DESC);

-- Prevent duplicate email registrations
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles (email)
  WHERE email IS NOT NULL;
