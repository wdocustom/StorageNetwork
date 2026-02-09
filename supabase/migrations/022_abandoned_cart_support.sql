-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Abandoned Cart Support
-- Adds tracking for abandoned cart recovery emails and expired status
-- ═══════════════════════════════════════════════════════════════════════════

-- Add column to track if abandoned cart email has been sent
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS abandoned_email_sent boolean DEFAULT false;

-- Add index for efficient abandoned cart queries
CREATE INDEX IF NOT EXISTS idx_leads_abandoned_cart
ON public.leads (status, created_at, abandoned_email_sent)
WHERE status = 'pending_payment';

-- Update status constraint to include 'expired' if not already present
-- First check if we need to update the constraint
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_status_check'
    AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads DROP CONSTRAINT leads_status_check;
  END IF;

  -- Add updated constraint with 'expired' status
  ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status IN (
    'new',
    'pending_payment',
    'open',
    'scheduled',
    'in_progress',
    'completed',
    'paid',
    'cancelled',
    'archived',
    'payment_pending',
    'expired'
  ));
EXCEPTION WHEN OTHERS THEN
  -- Constraint might not exist or have different name, continue
  NULL;
END $$;

-- Comment for documentation
COMMENT ON COLUMN public.leads.abandoned_email_sent IS
'Tracks whether an abandoned cart recovery email has been sent for this lead';
