-- Tracks whether an installer has received the inventory feature announcement.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS inventory_announcement_email_sent boolean DEFAULT false;
