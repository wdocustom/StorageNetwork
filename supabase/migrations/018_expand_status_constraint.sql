-- Migration 018: Add pending_payment and payment_pending to status check constraint
-- Required for the "Reserve then Pay" flow where leads start as pending_payment.

DO $$
BEGIN
  ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
  ALTER TABLE leads ADD CONSTRAINT leads_status_check
    CHECK (status IN (
      'new', 'open', 'assigned',
      'pending_payment', 'payment_pending',
      'deposit_paid', 'completed', 'paid',
      'cancelled', 'archived'
    ));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Status constraint could not be modified';
END $$;
