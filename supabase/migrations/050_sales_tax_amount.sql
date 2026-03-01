-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 050: Sales Tax Amount on Leads
--
-- Stores the computed sales-tax amount collected during checkout so the
-- job ticket can display the tax line item and the installer sees the
-- correct "collect from customer" balance (balance_due + tax).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS sales_tax_amount numeric(10,2) DEFAULT 0;
