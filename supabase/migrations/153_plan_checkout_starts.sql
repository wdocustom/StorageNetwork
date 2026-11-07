-- Plans funnel: who clicked "Buy" and was sent to Stripe's payment page.
--
-- Page views show who opened the designer (/plans/checkout) and
-- public_plan_purchases shows who paid. This fills the gap between them:
-- one row per Stripe Checkout Session created for a tote plan. A row whose
-- stripe_session_id never shows up in public_plan_purchases is someone who
-- reached the payment page and left without paying.
--
-- visitor_id is the browser's anonymous analytics id (localStorage sn_vid,
-- the same id platform_page_views uses), so clicks count per person.
-- Written and read only by the server (service role).

CREATE TABLE IF NOT EXISTS plan_checkout_starts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text NOT NULL UNIQUE,
  plan_id text NOT NULL,
  tier text,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  visitor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_checkout_starts_created ON plan_checkout_starts (created_at DESC);

ALTER TABLE plan_checkout_starts ENABLE ROW LEVEL SECURITY;
