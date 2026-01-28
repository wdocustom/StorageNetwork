-- ============================================================
-- Migration 005: Profile & Branding schema updates
-- avatar_url, business_name, slug for branded links, stripe details
-- ============================================================

-- 1. PROFILES — Additional profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean DEFAULT false;

-- 2. UNIQUE INDEX for branded links slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_slug
  ON public.profiles (slug)
  WHERE slug IS NOT NULL;

-- 3. STORAGE — Create avatars bucket
-- NOTE: Run this via Supabase dashboard or API if not using Supabase CLI:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;

-- 4. STORAGE POLICY — Allow authenticated users to upload/read their avatar
-- Run these in Supabase dashboard under Storage policies:
--
-- CREATE POLICY "Users can upload their own avatar" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
--
-- CREATE POLICY "Users can update their own avatar" ON storage.objects
--   FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
--
-- CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
--   FOR SELECT USING (bucket_id = 'avatars');
