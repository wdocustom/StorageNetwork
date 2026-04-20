-- Tracks whether an installer has received the feedback call invite email.
-- Used by the feedback-call-invite cron to prevent duplicate sends.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS feedback_call_email_sent boolean DEFAULT false;
