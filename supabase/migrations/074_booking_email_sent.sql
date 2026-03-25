-- Track whether booking confirmation emails were sent for a lead.
-- Used by the Stripe webhook to prevent duplicate emails on retry
-- while ensuring emails are never silently dropped.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS booking_email_sent boolean DEFAULT false;
