-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 141: Install tracking — manual steps + day-before reminder
--
-- Installers already text customers "loaded up and on the way" by hand. The
-- Job Ticket now has manual steps the installer taps (built → loaded → on
-- the way); each one emails the customer and updates their tracking page
-- (/track/[token]). A daily job also emails a reminder the day before the
-- install with the same tracking link.
--
-- install_stage           null | 'built' | 'loaded' | 'on_the_way'
-- install_stage_at        when the current stage was set
-- install_reminder_for    install date the day-before reminder was sent for
--                         (a reschedule gets a fresh reminder)
-- tracking_viewed_at      last time the customer opened their tracking page
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS install_stage TEXT DEFAULT NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS install_stage_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS install_reminder_for DATE DEFAULT NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS tracking_viewed_at TIMESTAMPTZ DEFAULT NULL;

-- Re-runnable: drop before add.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_install_stage_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_install_stage_check
  CHECK (install_stage IS NULL OR install_stage IN ('built', 'loaded', 'on_the_way'));
