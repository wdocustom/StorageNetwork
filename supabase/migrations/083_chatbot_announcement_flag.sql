-- ═══════════════════════════════════════════════════════════════════════════
-- 083: AI Chatbot Feature Announcement Flag
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chatbot_announcement_email_sent BOOLEAN DEFAULT false;
