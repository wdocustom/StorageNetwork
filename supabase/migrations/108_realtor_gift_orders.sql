-- ═══════════════════════════════════════════════════════════════════════════
-- Realtor Gift Checkout — Phase A2
--
-- Stands up the tote-rental-gift product:
--   tote_rental_packages   — catalog (Starter/Standard/Pro/Premium)
--   tote_rental_gifts      — one row per gift purchase (realtor → recipient)
--   tote_rental_gift_otps  — 6-digit codes for magic-link recipient verify
--
-- Fulfillment routing (installer assignment) lives in PR A3 — this migration
-- adds the installer_id column up front so A3 doesn't need a schema change.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Catalog ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tote_rental_packages (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  description     text NOT NULL,
  tote_count      int  NOT NULL,
  best_for        text,
  features        jsonb NOT NULL DEFAULT '[]'::jsonb,
  pricing_tiers   jsonb NOT NULL,                  -- [{duration_days,price_cents}, ...]
  sort_order      int NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tote_rental_packages IS
  'Tote-rental gift catalog. pricing_tiers is a jsonb array of '
  '{duration_days:int, price_cents:int} entries.';

-- ── Gift orders ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tote_rental_gifts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Purchaser (realtor today, contractor in Phase C — leave column name generic)
  realtor_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Snapshotted package details. Stored alongside package_id so a future
  -- catalog price change does NOT mutate the historical record.
  package_id              text NOT NULL REFERENCES public.tote_rental_packages(id),
  duration_days           int  NOT NULL,
  tote_count              int  NOT NULL,
  amount_cents            int  NOT NULL,

  -- Recipient context (captured at purchase, recipient can refine on /gift/[token])
  recipient_name          text NOT NULL,
  recipient_email         text NOT NULL,
  property_address        text,
  property_zip            text,
  personal_message        text,

  -- Lifecycle. State machine:
  --   pending_payment → paid → redeemed → scheduled → assigned → delivered → returned
  --   (cancelled / refunded are terminal states reachable from any prior state)
  status                  text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment',
      'paid',
      'redeemed',
      'scheduled',
      'assigned',
      'delivered',
      'returned',
      'cancelled'
    )),

  -- Redemption — gift_token is the public URL slug; only generated after payment.
  gift_token              text UNIQUE,
  redeemed_at             timestamptz,
  recipient_user_id       uuid REFERENCES auth.users(id),

  -- Scheduling (recipient supplies after redeem)
  delivery_address        text,
  delivery_zip            text,
  delivery_window_start   timestamptz,
  delivery_window_end     timestamptz,
  pickup_window_start     timestamptz,
  pickup_window_end       timestamptz,
  scheduled_at            timestamptz,

  -- Fulfillment (A3 populates these)
  installer_id            uuid REFERENCES public.profiles(id),
  installer_assigned_at   timestamptz,

  -- Stripe trail (for refunds + audit)
  stripe_session_id       text UNIQUE,
  stripe_payment_intent_id text,
  paid_at                 timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tote_rental_gifts_realtor
  ON public.tote_rental_gifts (realtor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tote_rental_gifts_token
  ON public.tote_rental_gifts (gift_token)
  WHERE gift_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tote_rental_gifts_installer
  ON public.tote_rental_gifts (installer_id, status)
  WHERE installer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tote_rental_gifts_status_paid_at
  ON public.tote_rental_gifts (status, paid_at DESC);

-- Auto-bump updated_at on every UPDATE (matches the project's other tables).
CREATE OR REPLACE FUNCTION public.touch_tote_rental_gifts()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tote_rental_gifts_touch ON public.tote_rental_gifts;
CREATE TRIGGER trg_tote_rental_gifts_touch
  BEFORE UPDATE ON public.tote_rental_gifts
  FOR EACH ROW EXECUTE FUNCTION public.touch_tote_rental_gifts();

-- ── Magic-link OTPs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tote_rental_gift_otps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id     uuid NOT NULL REFERENCES public.tote_rental_gifts(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,                    -- SHA-256 of the 6-digit code (never store plaintext)
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tote_rental_gift_otps_gift
  ON public.tote_rental_gift_otps (gift_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tote_rental_packages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tote_rental_gifts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tote_rental_gift_otps   ENABLE ROW LEVEL SECURITY;

-- Catalog is public-readable (everyone, including anon recipients, needs it
-- to render package details on /gift/[token]).
CREATE POLICY "Packages are publicly readable"
  ON public.tote_rental_packages FOR SELECT
  USING (active = true);

CREATE POLICY "Service role manages package catalog"
  ON public.tote_rental_packages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Realtors see their own gifts. Service role handles everything else
-- (recipient-facing reads happen via the gift_token through server actions
-- using the service client, so they don't need a direct RLS path).
CREATE POLICY "Realtors view own gifts"
  ON public.tote_rental_gifts FOR SELECT
  USING (realtor_id = auth.uid());

CREATE POLICY "Service role full access to gifts"
  ON public.tote_rental_gifts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- OTPs are NEVER directly readable by clients. Service role only.
CREATE POLICY "Service role full access to gift OTPs"
  ON public.tote_rental_gift_otps FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════
-- Seed: four launch packages with three duration tiers each.
-- Prices are competitive with the reusable-tote-rental market (Frogbox /
-- Bin-It / BungoBox benchmarks, mid-market metro). Includes local
-- delivery + pickup; installer fulfillment fee is platform margin.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.tote_rental_packages (id, name, description, tote_count, best_for, features, pricing_tiers, sort_order) VALUES
  (
    'starter',
    'Starter Move',
    'Perfect for a studio or one-bedroom move. Reusable, stackable, professional.',
    20,
    'Studios & 1-bedroom apartments',
    '["20 reusable heavy-duty totes","Co-branded delivery — your name on every box","Local pickup after move-in","Furniture pads (4)","Tote dolly (1)"]'::jsonb,
    '[{"duration_days":7,"price_cents":12900},{"duration_days":14,"price_cents":16900},{"duration_days":28,"price_cents":22900}]'::jsonb,
    10
  ),
  (
    'standard',
    'Standard Move',
    'The most-popular package — sized for a typical two-bedroom relocation.',
    30,
    '2-bedroom apartments & condos',
    '["30 reusable heavy-duty totes","Co-branded delivery — your name on every box","Local pickup after move-in","Furniture pads (6)","Tote dolly (1)","Labeling kit"]'::jsonb,
    '[{"duration_days":7,"price_cents":18900},{"duration_days":14,"price_cents":23900},{"duration_days":28,"price_cents":30900}]'::jsonb,
    20
  ),
  (
    'pro',
    'Pro Move',
    'For three-bedroom homes — pads, dollies, and enough totes for the whole house.',
    40,
    '3-bedroom homes',
    '["40 reusable heavy-duty totes","Co-branded delivery — your name on every box","Local pickup after move-in","Furniture pads (10)","Tote dollies (2)","Labeling kit","Wardrobe boxes (4)"]'::jsonb,
    '[{"duration_days":7,"price_cents":24900},{"duration_days":14,"price_cents":30900},{"duration_days":28,"price_cents":39900}]'::jsonb,
    30
  ),
  (
    'premium',
    'Premium Move',
    'White-glove tier for larger homes — enough totes for a full four-bedroom move.',
    50,
    '4+ bedroom homes',
    '["50 reusable heavy-duty totes","Co-branded delivery — your name on every box","Local pickup after move-in","Furniture pads (14)","Tote dollies (2)","Labeling kit","Wardrobe boxes (8)","Priority delivery scheduling"]'::jsonb,
    '[{"duration_days":7,"price_cents":32900},{"duration_days":14,"price_cents":40900},{"duration_days":28,"price_cents":52900}]'::jsonb,
    40
  )
ON CONFLICT (id) DO NOTHING;
