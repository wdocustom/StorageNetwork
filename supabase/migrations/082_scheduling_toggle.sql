-- ═══════════════════════════════════════════════════════════════════════════
-- 082: Scheduling Toggle
--
-- Allows installers to disable customer-facing date selection.
-- When scheduling_enabled = false, customers skip the calendar step
-- and the installer coordinates the date via email after booking.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS scheduling_enabled boolean DEFAULT true;
