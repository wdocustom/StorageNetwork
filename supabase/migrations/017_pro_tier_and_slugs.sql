-- Migration 017: Pro tier support - slug, is_pro, stripe_subscription_id
-- Enables vanity links (?installer=my-business) and Pro subscription tracking.

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "slug" text UNIQUE;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "is_pro" boolean DEFAULT false;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;

-- Index for fast slug lookups on the design page
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles (slug) WHERE slug IS NOT NULL;
