-- ═══════════════════════════════════════════════════════════════════════════
-- 044: Portfolio Fields
--
-- Adds bio, social links, and portfolio photos to profiles for the
-- installer portfolio page at /p/[slug].
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS portfolio_photos jsonb DEFAULT '[]'::jsonb;

-- NOTE: Create a 'portfolio' storage bucket via Supabase Dashboard:
--   Name: portfolio  |  Public: true  |  File size limit: 10MB
--
-- Then add these storage policies:
--
-- INSERT INTO storage.buckets (id, name, public)
--   VALUES ('portfolio', 'portfolio', true)
--   ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Users upload own portfolio photos" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'portfolio'
--     AND auth.uid()::text = (storage.foldername(name))[1]
--   );
--
-- CREATE POLICY "Users delete own portfolio photos" ON storage.objects
--   FOR DELETE USING (
--     bucket_id = 'portfolio'
--     AND auth.uid()::text = (storage.foldername(name))[1]
--   );
--
-- CREATE POLICY "Portfolio photos are publicly accessible" ON storage.objects
--   FOR SELECT USING (bucket_id = 'portfolio');
