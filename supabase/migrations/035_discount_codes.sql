-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 035: Discount Codes — ensure all columns exist
--
-- This is a follow-up to 030_discount_codes.sql.
-- It only adds columns that may be missing. Fully idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- Ensure table exists (no-op if 030 already ran)
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code          text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent'
                CHECK (discount_type IN ('percent', 'fixed', 'percentage')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_uses      integer,
  current_uses  integer NOT NULL DEFAULT 0,
  used_count    integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Add any missing columns
DO $$ BEGIN
  ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS current_uses integer DEFAULT 0 NOT NULL;
  ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS used_count integer DEFAULT 0 NOT NULL;
  ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS max_discount numeric(10,2) DEFAULT NULL;
  ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS min_order numeric(10,2) DEFAULT 0;
  ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Indexes (IF NOT EXISTS = safe to re-run)
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_codes_installer_code
  ON public.discount_codes (installer_id, LOWER(code));

CREATE INDEX IF NOT EXISTS idx_discount_codes_code
  ON public.discount_codes (LOWER(code));

-- RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Drop all policy name variants before recreating (handles both 030 and 035 names)
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

CREATE POLICY "Service role full access"
  ON public.discount_codes FOR ALL
  USING (true)
  WITH CHECK (true);

-- Ensure leads table has discount tracking columns
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS discount_code text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
