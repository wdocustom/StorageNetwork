-- Add estimated_price column to leads table for storing the grand total
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS estimated_price numeric(10,2);

-- Add quote_data column to store the full multi-unit quote array
-- (dimensions stays for backward compat but quote_data holds the real payload)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS quote_data jsonb DEFAULT '[]';
