-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 169: one-time "sideways tote brand" notice to DIY plan buyers
--
-- Sideways 2×4 bays started following the tote brand (HDX 30-1/4",
-- Greenmade-size 32"). Every sideways plan made before that was cut for HDX.
-- /api/cron/sideways-brand-notice emails those buyers once; this stamp is
-- how it knows a plan's owner was already told. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.public_plan_purchases ADD COLUMN IF NOT EXISTS sideways_notice_sent_at timestamptz;
