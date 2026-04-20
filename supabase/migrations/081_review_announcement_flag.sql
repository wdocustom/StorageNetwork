-- ═══════════════════════════════════════════════════════════════════════════
-- 081: Review System Announcement Flag
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS review_announcement_email_sent BOOLEAN DEFAULT false;
