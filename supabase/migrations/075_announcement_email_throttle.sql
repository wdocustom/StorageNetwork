-- Tracks when an installer last received an announcement/marketing email.
-- Used to enforce max 1 announcement email per day per installer,
-- preventing email fatigue when multiple announcement crons run the same day.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_announcement_email_at timestamptz;
