-- ═══════════════════════════════════════════════════════════════════════════
-- 030: Discount Codes — Installer-specific promo/discount code system
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  installer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code         text NOT NULL,
  discount_type text NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
  max_discount  numeric(10,2) DEFAULT NULL,   -- Cap for percentage discounts
  min_order     numeric(10,2) DEFAULT 0,       -- Minimum order total to qualify
  max_uses      integer DEFAULT NULL,           -- NULL = unlimited
  used_count    integer DEFAULT 0 NOT NULL,
  expires_at    timestamptz DEFAULT NULL,
  active        boolean DEFAULT true NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE (installer_id, code)
);

-- Index for fast lookups by installer + code
CREATE INDEX IF NOT EXISTS idx_discount_codes_lookup
  ON public.discount_codes (installer_id, upper(code))
  WHERE active = true;

-- Add discount_code column to leads table for tracking which code was used
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS discount_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0;

-- RLS: Installers can manage their own codes
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

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

-- Service role can read for validation (server actions use service role key)
CREATE POLICY "Service role full access"
  ON public.discount_codes FOR ALL
  USING (true)
  WITH CHECK (true);
