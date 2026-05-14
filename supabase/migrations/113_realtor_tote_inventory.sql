-- ═══════════════════════════════════════════════════════════════════════════
-- 113 — Realtor tote inventory + purchase ledger (PR1 of tote-inventory build)
--
-- Stands up the data foundation for the inventory-mode gift flow. Realtors
-- buy 27-gallon totes in bulk packs, accumulate a per-realtor balance, and
-- dispatch gifts (10–50 totes each) against that balance. Quick-send via the
-- existing tote_rental_packages catalog continues to coexist as a one-off
-- purchase path — see PR4 for the gift-dispatch wiring.
--
-- Pricing (informational; enforced in the purchase action, not the DB):
--   • $6.50 flat per paid tote
--   • 50-pack  → +5 bonus  (10%)
--   • 100-pack → +10 bonus (10%)
--   • 250-pack → +38 bonus (15%, ceil)
--   • Custom 1–49 → no bonus
--
-- Tables added:
--   profiles.realtor_tote_balance       — running balance (totes available to
--                                         dispatch). Increments on paid
--                                         purchase, decrements on gift
--                                         dispatch. CHECK (>= 0) — never goes
--                                         negative; PR4 validates before
--                                         dispatch.
--   realtor_tote_purchases              — one row per pack purchase. Audit
--                                         trail + Stripe reconciliation.
--                                         total_credited = paid + bonus, only
--                                         counted toward balance once status
--                                         flips to 'paid' (handled in PR2's
--                                         webhook).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Realtor balance ──────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS realtor_tote_balance int NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_realtor_tote_balance_nonneg;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_realtor_tote_balance_nonneg
  CHECK (realtor_tote_balance >= 0);

COMMENT ON COLUMN public.profiles.realtor_tote_balance IS
  'Totes available for the realtor to dispatch via inventory-mode gifts. '
  'Credited on paid tote-pack purchase; debited on gift dispatch. '
  'Never negative — PR4 dispatch action validates balance >= requested count.';

-- ── Purchase ledger ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.realtor_tote_purchases (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  realtor_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- SKU. 'custom' = top-up of arbitrary 1–49 quantity, no bonus.
  pack_sku                 text NOT NULL
    CHECK (pack_sku IN ('pack_50', 'pack_100', 'pack_250', 'custom')),

  -- Quantities. paid_count is what the realtor paid for; bonus_count is the
  -- promotional add-on (10% for 50/100, 15% ceil for 250, 0 for custom).
  -- total_credited is the column the webhook adds to profiles.realtor_tote_balance.
  paid_count               int NOT NULL CHECK (paid_count > 0),
  bonus_count              int NOT NULL DEFAULT 0 CHECK (bonus_count >= 0),
  total_credited           int GENERATED ALWAYS AS (paid_count + bonus_count) STORED,

  -- Pricing snapshot — protects history if base price changes.
  unit_price_cents         int NOT NULL DEFAULT 650 CHECK (unit_price_cents > 0),
  amount_cents             int NOT NULL CHECK (amount_cents >= 0),

  -- Lifecycle:
  --   pending_payment → paid    (webhook on checkout.session.completed)
  --   pending_payment → cancelled (realtor abandoned checkout; swept by cron)
  --   pending_payment → failed   (Stripe reported failure)
  -- 'paid' is terminal — no refunds (use-it-or-lose-it per product decision).
  status                   text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'failed', 'cancelled')),

  -- Stripe trail.
  stripe_session_id        text UNIQUE,
  stripe_payment_intent_id text,
  paid_at                  timestamptz,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.realtor_tote_purchases IS
  'Audit ledger of realtor tote-pack purchases. One row per Stripe Checkout '
  'session. Balance credit happens in the webhook when status flips to ''paid''.';

COMMENT ON COLUMN public.realtor_tote_purchases.total_credited IS
  'Generated: paid_count + bonus_count. The amount added to profiles.realtor_tote_balance '
  'when status transitions to ''paid''.';

CREATE INDEX IF NOT EXISTS idx_realtor_tote_purchases_realtor
  ON public.realtor_tote_purchases (realtor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_realtor_tote_purchases_status
  ON public.realtor_tote_purchases (status, created_at DESC)
  WHERE status = 'pending_payment';

-- Auto-bump updated_at on every UPDATE (matches the project's other tables).
CREATE OR REPLACE FUNCTION public.touch_realtor_tote_purchases()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_realtor_tote_purchases_touch ON public.realtor_tote_purchases;
CREATE TRIGGER trg_realtor_tote_purchases_touch
  BEFORE UPDATE ON public.realtor_tote_purchases
  FOR EACH ROW EXECUTE FUNCTION public.touch_realtor_tote_purchases();

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.realtor_tote_purchases ENABLE ROW LEVEL SECURITY;

-- Realtors read their own purchase history (renders the purchase log on the
-- inventory tile in PR2). All writes go through the service client.
CREATE POLICY "Realtors view own tote purchases"
  ON public.realtor_tote_purchases FOR SELECT
  USING (realtor_id = auth.uid());

CREATE POLICY "Service role full access to tote purchases"
  ON public.realtor_tote_purchases FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
