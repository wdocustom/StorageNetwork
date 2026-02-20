-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 035: Discount Codes
--
-- Installer-scoped discount codes. Each code belongs to a specific
-- installer and can only be applied to that installer's orders.
-- Supports both percentage and fixed-dollar discounts.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code          text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent'
                CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_uses      integer,                     -- NULL = unlimited
  current_uses  integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  expires_at    timestamptz,                 -- NULL = never expires
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Same code can't be used twice for the same installer
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_codes_installer_code
  ON public.discount_codes (installer_id, LOWER(code));

-- Fast lookup by code text
CREATE INDEX IF NOT EXISTS idx_discount_codes_code
  ON public.discount_codes (LOWER(code));

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Installers can read their own codes
DROP POLICY IF EXISTS "Installers can read own discount codes" ON public.discount_codes;
CREATE POLICY "Installers can read own discount codes"
  ON public.discount_codes FOR SELECT
  USING (installer_id = auth.uid());

-- Installers can create their own codes
DROP POLICY IF EXISTS "Installers can create own discount codes" ON public.discount_codes;
CREATE POLICY "Installers can create own discount codes"
  ON public.discount_codes FOR INSERT
  WITH CHECK (installer_id = auth.uid());

-- Installers can update their own codes
DROP POLICY IF EXISTS "Installers can update own discount codes" ON public.discount_codes;
CREATE POLICY "Installers can update own discount codes"
  ON public.discount_codes FOR UPDATE
  USING (installer_id = auth.uid());

-- Installers can delete their own codes
DROP POLICY IF EXISTS "Installers can delete own discount codes" ON public.discount_codes;
CREATE POLICY "Installers can delete own discount codes"
  ON public.discount_codes FOR DELETE
  USING (installer_id = auth.uid());

-- Service role (used by server actions) can read any code for validation
DROP POLICY IF EXISTS "Service role can read all discount codes" ON public.discount_codes;
CREATE POLICY "Service role can read all discount codes"
  ON public.discount_codes FOR SELECT
  USING (true);

-- ── Add discount tracking columns to leads ───────────────────────────────
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS discount_code text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
