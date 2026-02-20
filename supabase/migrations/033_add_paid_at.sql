-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 033: Add paid_at column to leads
-- The webhook and markLeadAsPaid both write paid_at, but the column was
-- never created. PostgREST rejects the entire UPDATE when it encounters
-- an unknown column, silently preventing status from reaching 'paid'.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE leads ADD COLUMN IF NOT EXISTS paid_at timestamptz;
