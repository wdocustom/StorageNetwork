-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 100: Drop saved_facebook_groups
--
-- The "My Groups" feature (component + server action) was removed from the
-- marketing page. Drop the backing table from migration 054 since it's no
-- longer read or written.
--
-- DESTRUCTIVE: this deletes any installer-saved Facebook group URLs.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.saved_facebook_groups CASCADE;
