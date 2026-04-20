-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 026: SMS Notification Tracking
--
-- Adds columns to track SMS notification state on the leads table:
--   en_route_notified  — whether the "Start Trip" SMS was sent
--   en_route_at        — timestamp when installer started their trip
--   installer_sms_sent — whether the new booking SMS was sent to installer
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS en_route_notified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS installer_sms_sent BOOLEAN DEFAULT false;
