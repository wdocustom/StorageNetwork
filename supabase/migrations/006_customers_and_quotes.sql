-- ============================================================
-- Migration 006: Customers table & Quote system updates
-- Adds customers table, installer_manual source, profile fields
-- FIXED: Cleans up existing data before adding constraint
-- ============================================================

-- 1. CUSTOMERS TABLE — Store customer info separately from leads
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Customer Info
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  address text,

  -- Ownership
  installer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Tracking
  source text DEFAULT 'manual'
    CHECK (source IN ('manual', 'quote', 'booking', 'import'))
);

-- Index for installer lookup
CREATE INDEX IF NOT EXISTS idx_customers_installer_id
  ON public.customers (installer_id);

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_customers_email
  ON public.customers (email);

-- 2. PROFILES — Additional fields for identity
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS trade_name text;

-- 3. LEADS — Add source column if it doesn't exist
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source text;

-- 4. Drop existing constraint FIRST (before any data changes)
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;

-- 5. DATA CLEAN-UP: Fix any NULL or invalid source values
UPDATE public.leads
SET source = 'platform'
WHERE source IS NULL
   OR source NOT IN ('platform', 'partner_link', 'installer_manual', 'affiliate');

-- 6. Add the new constraint (now that data is clean and old constraint is gone)
ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN ('platform', 'partner_link', 'installer_manual', 'affiliate'));

-- 7. LEADS — Set default for future rows
ALTER TABLE public.leads
  ALTER COLUMN source SET DEFAULT 'platform';

-- 8. LEADS — Add customer reference
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- 9. INDEX for customer lookup on leads
CREATE INDEX IF NOT EXISTS idx_leads_customer_id
  ON public.leads (customer_id);
