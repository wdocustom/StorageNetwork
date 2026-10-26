-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 148: allow leads.status = 'waitlisted'
--
-- submitNetworkLead creates "hostage" leads with status 'waitlisted' when an
-- installer is at their trial job cap (and the plans → "have it built" flow
-- does the same), but leads_status_check (migration 046) never listed it,
-- so those inserts were rejected. Same list as 046 plus 'waitlisted'.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN (
    'new', 'open', 'assigned',
    'contacted', 'quoted', 'accepted',
    'pending_payment', 'payment_pending',
    'deposit_paid', 'completed', 'paid',
    'cancelled', 'archived', 'expired',
    'waitlisted'
  ));
