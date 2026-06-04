-- Public plan purchases — no account required.
-- Buyers receive an access_token via email that grants permanent access to the purchased plan's HTML.
CREATE TABLE IF NOT EXISTS public_plan_purchases (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT        NOT NULL,
  plan_id          TEXT        NOT NULL,
  stripe_session_id TEXT       UNIQUE NOT NULL,
  access_token     UUID        UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  email_sent       BOOLEAN     NOT NULL DEFAULT false,
  purchased_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS public_plan_purchases_email_idx  ON public_plan_purchases(email);
CREATE INDEX IF NOT EXISTS public_plan_purchases_token_idx  ON public_plan_purchases(access_token);
