-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 007: Avatars Storage Bucket & RLS Policies
-- Fixes: "Failed to upload photo" error on Profile page
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. RLS Policies for storage.objects (avatars bucket)
--    Drop existing policies first to avoid conflicts on re-run

DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_owner" ON storage.objects;

-- 2a. SELECT — Anyone can view avatars (public bucket)
CREATE POLICY "avatars_select_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 2b. INSERT — Authenticated users can upload to their own folder
CREATE POLICY "avatars_insert_authenticated"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2c. UPDATE — Owners can overwrite their own files
CREATE POLICY "avatars_update_owner"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2d. DELETE — Owners can delete their own files
CREATE POLICY "avatars_delete_owner"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
