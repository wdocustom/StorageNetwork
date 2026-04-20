-- Add billing_state column to leads table
-- This stores the customer's billing state from the Stripe payment flow,
-- used as a fallback for sales tax calculation when delivery/address state is missing.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS billing_state TEXT;
