-- ═══════════════════════════════════════════════════════════════════════════
-- 167: Share-with-a-friend links for DIY plan buyers
--
-- Each buyer email gets one short code (storage-network.app/plans/friend/<code>).
-- Friends who buy through it get $3 off; the purchase records the code in
-- public_plan_purchases.friend_code. Purchases from a buyer's link pay no
-- bestseller split (see plan-splits.ts). Service role only.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plan_friend_codes (
  code         TEXT PRIMARY KEY CHECK (code ~ '^[a-z0-9]{6,12}$'),
  email        TEXT NOT NULL UNIQUE,
  purchase_id  UUID REFERENCES public_plan_purchases(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE plan_friend_codes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public_plan_purchases ADD COLUMN IF NOT EXISTS friend_code TEXT;
CREATE INDEX IF NOT EXISTS idx_ppp_friend_code ON public_plan_purchases (friend_code) WHERE friend_code IS NOT NULL;
