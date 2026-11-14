-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 155: Custom Storage Builder — subscriptions, saved designs,
-- share links, marketplace listings and plan sales
--
-- The Custom Builder (/plans/builder) is a $49/month subscription. Like the
-- rest of the plans store its buyers have no account: a subscriber is an
-- EMAIL, reached through an access_token link and the per-device code gate
-- (plan_buyer_devices / plan_access_codes, migration 151).
--
--   builder_subscriptions    one row per subscriber email; the Stripe
--                            subscription behind it and its last known status
--   builder_designs          a subscriber's saved designs. Each can stay
--                            private, be shared as a view-only link, or be
--                            listed for sale (the marketplace is the set of
--                            rows with share_mode = 'sale')
--   builder_plan_purchases   a plan bought from another builder. Also the
--                            sales ledger: what the buyer paid, the
--                            platform's cut, what the creator is owed and
--                            whether it has been paid out
--
-- All three are written and read only by the server (service role), like
-- every other plans table: RLS is on with no policies, so the anon and
-- authenticated keys see nothing.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Subscribers ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.builder_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- lower-cased; one subscription per email
  email text NOT NULL UNIQUE,
  -- the link in the subscriber's email: /plans/builder?token=…
  access_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  customer_name text,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  -- the Checkout Session that started (or last restarted) the subscription
  stripe_session_id text UNIQUE,
  -- Stripe's subscription status as last read: active, trialing, past_due,
  -- canceled, unpaid, incomplete, incomplete_expired, paused
  status text NOT NULL DEFAULT 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  -- when status was last confirmed with Stripe (the server re-checks when
  -- this is stale instead of relying on webhooks)
  checked_at timestamptz,
  email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Saved designs, share links and listings ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.builder_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  name text NOT NULL,
  -- the scene graph (src/lib/builder/scene.ts); scene_version is its
  -- `version` field, kept as a column so old formats can be found
  scene jsonb NOT NULL,
  scene_version integer NOT NULL,
  piece_count integer NOT NULL DEFAULT 0 CHECK (piece_count >= 0),
  -- overall size in inches and material counts, shown on listings without
  -- handing out the scene itself
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- small JPEG data URL of the build, for cards and listings
  thumbnail text CHECK (thumbnail IS NULL OR length(thumbnail) <= 400000),
  -- private: only the owner · view: anyone with the link can look at it in
  -- 3D · sale: listed in the marketplace, plan sold at price_cents
  share_mode text NOT NULL DEFAULT 'private' CHECK (share_mode IN ('private', 'view', 'sale')),
  -- unguessable id in the share URL; set the first time a design is shared
  share_slug text UNIQUE,
  description text CHECK (description IS NULL OR length(description) <= 1200),
  price_cents integer CHECK (price_cents IS NULL OR (price_cents >= 100 AND price_cents <= 50000)),
  listed_at timestamptz,
  -- the design this one was copied from, if any
  forked_from uuid REFERENCES public.builder_designs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- soft delete: a design that has been sold must stay readable for refunds
  -- and disputes even after its owner removes it
  deleted_at timestamptz,
  CONSTRAINT builder_designs_sale_has_price CHECK (share_mode <> 'sale' OR price_cents IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS builder_designs_owner_idx
  ON public.builder_designs (owner_email, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS builder_designs_market_idx
  ON public.builder_designs (listed_at DESC) WHERE share_mode = 'sale' AND deleted_at IS NULL;

-- ── Plan sales (and the creator ledger) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.builder_plan_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.builder_designs(id),
  buyer_email text NOT NULL,
  customer_name text,
  -- the link in the buyer's email: /plans/builder/plan?token=…
  access_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  stripe_session_id text NOT NULL UNIQUE,
  -- what was bought, frozen at the moment of sale: later edits to the
  -- design never change a plan someone already paid for
  design_name text NOT NULL,
  scene_snapshot jsonb NOT NULL,
  -- money, in cents: amount = platform fee + creator earnings
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  platform_fee_cents integer NOT NULL CHECK (platform_fee_cents >= 0),
  creator_earnings_cents integer NOT NULL CHECK (creator_earnings_cents >= 0),
  creator_email text NOT NULL,
  -- owed until the platform pays the creator
  payout_status text NOT NULL DEFAULT 'owed' CHECK (payout_status IN ('owed', 'paid', 'void')),
  paid_out_at timestamptz,
  payout_note text,
  email_sent boolean NOT NULL DEFAULT false,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT builder_plan_purchases_split CHECK (amount_cents = platform_fee_cents + creator_earnings_cents)
);

CREATE INDEX IF NOT EXISTS builder_plan_purchases_buyer_idx
  ON public.builder_plan_purchases (buyer_email, purchased_at DESC);
CREATE INDEX IF NOT EXISTS builder_plan_purchases_creator_idx
  ON public.builder_plan_purchases (creator_email, purchased_at DESC);
CREATE INDEX IF NOT EXISTS builder_plan_purchases_design_idx
  ON public.builder_plan_purchases (design_id);

-- ── Service role only ────────────────────────────────────────────────────

ALTER TABLE public.builder_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.builder_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.builder_plan_purchases ENABLE ROW LEVEL SECURITY;
