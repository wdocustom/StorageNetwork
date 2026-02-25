-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 046: Fix leads CHECK constraints
--
-- The original schema.sql created inline CHECK constraints on status and source
-- columns. Migrations 009 and 018 tried to drop them by name (leads_status_check,
-- leads_source_check) but PostgreSQL may have auto-named them differently.
-- This migration drops ALL check constraints on these columns and recreates
-- the correct expanded ones.
--
-- Fully idempotent — safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop all CHECK constraints on leads.status and leads.source by querying pg_constraint
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop every CHECK constraint on the leads table that references 'status' or 'source'
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'leads'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'  -- CHECK constraint
      AND (
        pg_get_constraintdef(con.oid) ILIKE '%status%'
        OR pg_get_constraintdef(con.oid) ILIKE '%source%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- Recreate the correct expanded constraints
ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN (
    'new', 'open', 'assigned',
    'contacted', 'quoted', 'accepted',
    'pending_payment', 'payment_pending',
    'deposit_paid', 'completed', 'paid',
    'cancelled', 'archived', 'expired'
  ));

ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN (
    'platform', 'partner_link', 'installer_manual',
    'affiliate', 'network', 'self'
  ));
