-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 132: Manual Service ZIP Additions
--
-- Lets installers add individual ZIP codes to their service area beyond
-- the auto-computed cluster (e.g. a regular customer just outside their
-- normal radius). Tracked separately via is_manual so the profile UI can
-- list/manage just the ZIPs the installer added themselves, without
-- touching the auto-assigned cluster from assignTerritoryCluster().
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.territory_zips
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false;
