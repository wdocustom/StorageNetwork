-- Add operational_status column to leads table for installer pipeline tracking.
-- Distinct from the payment `status` column — this tracks the physical job pipeline:
--   new       = lead received, not yet scheduled
--   scheduled = install date set, awaiting completion
--   completed = installation done
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS operational_status text DEFAULT 'new';

COMMENT ON COLUMN leads.operational_status IS
  'Installer pipeline state: new | scheduled | completed. Independent of payment status.';
