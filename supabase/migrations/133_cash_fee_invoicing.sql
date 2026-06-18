-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 133: Cash/Venmo/Check Platform Fee Invoicing
--
-- When an installer marks a job paid without ever running it through Stripe
-- (cash, Venmo, check), the platform's 3%/15% maintenance fee has never been
-- collected. markLeadAsPaid() now charges it directly via a one-off Stripe
-- invoice against the installer's existing billing Customer. These columns
-- track that invoice for idempotency and reporting.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cash_fee_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS cash_fee_cents INTEGER,
  ADD COLUMN IF NOT EXISTS cash_fee_status TEXT;
