-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 038: Waitlist Quote Data
--
-- Adds a JSONB column to demand_signals so we can persist the customer's
-- configurator build (unit sizes, tote type, options, pricing) when they
-- join the waitlist. When an installer later covers their ZIP, the
-- activation email can include their original build details and the
-- referrer attribution is carried through the re-engagement link.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.demand_signals
  ADD COLUMN IF NOT EXISTS quote_data JSONB;

COMMENT ON COLUMN public.demand_signals.quote_data IS
  'Saved configurator build from waitlisted customer (unit configs, pricing). NULL for anonymous signals.';
