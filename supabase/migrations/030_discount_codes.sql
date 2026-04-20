-- ═══════════════════════════════════════════════════════════════════════════
-- 030: Discount Codes — Installer-specific promo/discount code system
--
-- Fully idempotent: safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  installer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code         text NOT NULL,
  discount_type text NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage', 'percent')),
  discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
  max_discount  numeric(10,2) DEFAULT NULL,   -- Cap for percentage discounts
  min_order     numeric(10,2) DEFAULT 0,       -- Minimum order total to qualify
  max_uses      integer DEFAULT NULL,           -- NULL = unlimited
  used_count    integer DEFAULT 0 NOT NULL,
  current_uses  integer DEFAULT 0 NOT NULL,
  expires_at    timestamptz DEFAULT NULL,
  active        boolean DEFAULT true NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE (installer_id, code)
);

-- Add columns that may be missing if table was created by an older migration
DO $$ BEGIN
  ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS used_count integer DEFAULT 0 NOT NULL;
  ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS current_uses integer DEFAULT 0 NOT NULL;
  ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS max_discount numeric(10,2) DEFAULT NULL;
  ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS min_order numeric(10,2) DEFAULT 0;
  ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Index for fast lookups by installer + code
CREATE INDEX IF NOT EXISTS idx_discount_codes_lookup
  ON public.discount_codes (installer_id, upper(code))
  WHERE active = true;

-- Add discount_code column to leads table for tracking which code was used
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS discount_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0;

-- RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Drop ALL possible policy names (from both old and new versions) before creating
DO $$ BEGIN DROP POLICY IF EXISTS "Installers can view own discount codes" ON public.discount_codes; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Installers can read own discount codes" ON public.discount_codes; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Installers can insert own discount codes" ON public.discount_codes; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Installers can create own discount codes" ON public.discount_codes; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Installers can update own discount codes" ON public.discount_codes; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Installers can delete own discount codes" ON public.discount_codes; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Service role full access" ON public.discount_codes; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Service role can read all discount codes" ON public.discount_codes; EXCEPTION WHEN others THEN NULL; END $$;

-- Recreate clean policies
CREATE POLICY "Installers can view own discount codes"
  ON public.discount_codes FOR SELECT
  USING (auth.uid() = installer_id);

CREATE POLICY "Installers can insert own discount codes"
  ON public.discount_codes FOR INSERT
  WITH CHECK (auth.uid() = installer_id);

CREATE POLICY "Installers can update own discount codes"
  ON public.discount_codes FOR UPDATE
  USING (auth.uid() = installer_id);

CREATE POLICY "Installers can delete own discount codes"
  ON public.discount_codes FOR DELETE
  USING (auth.uid() = installer_id);

-- Service role can read/write for validation (server actions use service role key)
CREATE POLICY "Service role full access"
  ON public.discount_codes FOR ALL
  USING (true)
  WITH CHECK (true);
