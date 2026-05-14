-- ═══════════════════════════════════════════════════════════════════════════
-- 111 — Realtor custom branding
--
-- Three new optional columns on `profiles` so realtors can co-brand the
-- recipient gift page (/gift/[token]) with their own visual identity:
--
--   realtor_photo_url   — public URL of a head-shot, used as a circular
--                         avatar above the recipient's banner
--   realtor_logo_url    — brokerage logo, rendered alongside the brokerage
--                         name as a small badge
--   realtor_signature   — a default closing line / signature that shows
--                         on the recipient page when the realtor hasn't
--                         supplied a per-gift personal_message
--
-- The files themselves live in a Supabase Storage bucket called
-- `realtor-branding`, created lazily by the upload server action
-- (mirrors the pattern in src/app/actions/photo-upload.ts:19-27).
-- Bucket layout: realtor-branding/{userId}/photo.{ext} and
-- realtor-branding/{userId}/logo.{ext} — one folder per realtor so a
-- profile delete can sweep with a single list+remove pass.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS realtor_photo_url text NULL,
  ADD COLUMN IF NOT EXISTS realtor_logo_url  text NULL,
  ADD COLUMN IF NOT EXISTS realtor_signature text NULL;

-- Length cap on the signature so a malicious / careless realtor can't
-- stuff a novel onto every recipient page. 500 chars ≈ 75 words; the UI
-- counter will surface the limit.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_realtor_signature_length
  CHECK (realtor_signature IS NULL OR char_length(realtor_signature) <= 500);

COMMENT ON COLUMN public.profiles.realtor_photo_url IS
  'Public URL of the realtor''s head-shot for co-branded recipient pages. NULL = no photo set.';
COMMENT ON COLUMN public.profiles.realtor_logo_url IS
  'Public URL of the realtor''s brokerage logo for co-branded recipient pages. NULL = name-only.';
COMMENT ON COLUMN public.profiles.realtor_signature IS
  'Default closing line shown on /gift/[token] when no per-gift personal_message is set. Max 500 chars.';
