-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 108: Allow 'site_measure' demand signal type
--
-- The Design Entry Modal lets a customer request an in-home measure when
-- they don't know their own wall dimensions. That request is recorded as
-- a demand_signal so the assigned installer (or the platform, when no
-- installer is locked) can reach back out to schedule the visit.
--
-- Schema 037 hard-coded signal_type ∈ ('anonymous', 'waitlist'). Add the
-- new value via a DROP/ADD on the CHECK constraint. Idempotent because
-- we drop unconditionally before re-adding.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.demand_signals
  DROP CONSTRAINT IF EXISTS demand_signals_signal_type_check;

ALTER TABLE public.demand_signals
  ADD CONSTRAINT demand_signals_signal_type_check
  CHECK (signal_type IN ('anonymous', 'waitlist', 'site_measure'));
