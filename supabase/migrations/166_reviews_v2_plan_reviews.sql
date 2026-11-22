-- ═══════════════════════════════════════════════════════════════════════════
-- 166: Reviews v2 — DIY plan reviews + installer review fixes
--
-- installer_reviews
--   • SECURITY: drop "Anyone can insert reviews". Reviews are written only by
--     the server (service role) after checking the one-time review link; the
--     open INSERT policy let anyone with the public anon key post a
--     "verified" review for any installer straight through the REST API.
--   • photos (public URLs, review-photos bucket) and the installer's reply.
--
-- plan_reviews
--   One review per buyer email per plan product (27-gal "tote", "mini").
--   Written only by the server after checking the buyer's access token AND a
--   verified device (same gate as opening the plan). 4–5★ publish at once;
--   1–3★ are held for admin approval (and the admin is emailed).
--
-- public_plan_purchases
--   review_request_sent_at / review_reminder_sent_at for the review emails.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone can insert reviews" ON installer_reviews;

ALTER TABLE installer_reviews ADD COLUMN IF NOT EXISTS photos   TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE installer_reviews ADD COLUMN IF NOT EXISTS reply    TEXT;
ALTER TABLE installer_reviews ADD COLUMN IF NOT EXISTS reply_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS plan_reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id    UUID NOT NULL REFERENCES public_plan_purchases(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  product        TEXT NOT NULL CHECK (product IN ('tote', 'mini')),
  customer_name  TEXT NOT NULL,
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  headline       TEXT,
  comment        TEXT,
  tags           TEXT[] NOT NULL DEFAULT '{}',
  photos         TEXT[] NOT NULL DEFAULT '{}',
  skill_level    TEXT CHECK (skill_level IN ('first', 'some', 'experienced')),
  build_hours    NUMERIC(5, 1) CHECK (build_hours > 0 AND build_hours <= 200),
  -- What they built, from their design, e.g. "8×4 rolling rack with a top"
  build_summary  TEXT,
  status         TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'held', 'hidden')),
  reply          TEXT,
  reply_at       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email, product)
);

CREATE INDEX IF NOT EXISTS idx_plan_reviews_published
  ON plan_reviews (product, created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_plan_reviews_status ON plan_reviews (status, created_at DESC);

-- Service role only: every read and write goes through server code.
ALTER TABLE plan_reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE public_plan_purchases ADD COLUMN IF NOT EXISTS review_request_sent_at  TIMESTAMPTZ;
ALTER TABLE public_plan_purchases ADD COLUMN IF NOT EXISTS review_reminder_sent_at TIMESTAMPTZ;

-- Public bucket for review photos (resized JPEGs, written by the server).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('review-photos', 'review-photos', true, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;
