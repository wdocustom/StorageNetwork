-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 142: A timestamp per install step
--
-- Migration 141 kept only the time of the CURRENT step (install_stage_at),
-- so the customer's tracking page couldn't show when each earlier step
-- happened. With no GPS and a manual Refresh, "Loaded up · 7:42 AM (12 min
-- ago)" is how a customer knows how fresh the status is.
--
-- A step's time is set when the installer first marks it; skipped steps stay
-- NULL (shown as done, without a time). Reset clears them all.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS install_built_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS install_loaded_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS install_on_the_way_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill the current step's time from 141's install_stage_at.
UPDATE public.leads SET install_built_at = install_stage_at
  WHERE install_stage = 'built' AND install_built_at IS NULL;
UPDATE public.leads SET install_loaded_at = install_stage_at
  WHERE install_stage = 'loaded' AND install_loaded_at IS NULL;
UPDATE public.leads SET install_on_the_way_at = install_stage_at
  WHERE install_stage = 'on_the_way' AND install_on_the_way_at IS NULL;
