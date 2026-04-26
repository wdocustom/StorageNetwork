-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 097: Build Snapshots Storage Bucket
-- Stores 3D/2D canvas captures embedded in quote and booking emails
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create the build-snapshots bucket (public so email clients can render images)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('build-snapshots', 'build-snapshots', true, 2097152)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152;

-- 2. RLS Policies
DROP POLICY IF EXISTS "build_snapshots_select_public" ON storage.objects;
DROP POLICY IF EXISTS "build_snapshots_insert_anyone" ON storage.objects;
DROP POLICY IF EXISTS "build_snapshots_delete_authenticated" ON storage.objects;

-- 2a. SELECT — Anyone can view (needed for email rendering)
CREATE POLICY "build_snapshots_select_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'build-snapshots');

-- 2b. INSERT — Both authenticated installers and anonymous customers can upload
CREATE POLICY "build_snapshots_insert_anyone"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'build-snapshots');

-- 2c. DELETE — Only authenticated users can delete
CREATE POLICY "build_snapshots_delete_authenticated"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'build-snapshots'
  AND auth.role() = 'authenticated'
);
