-- ============================================================
-- Migration 032: Post Images — Supabase Storage Support
--
-- Adds a post_images table for multiple images per post.
-- Images are stored in Supabase Storage bucket "community-images".
-- ============================================================

-- ── Table: post_images ────────────────────────────────────────
create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  image_url text not null,          -- Supabase Storage public URL
  storage_path text,                -- Raw storage path for deletion
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.post_images
    add constraint post_images_post_id_fkey
    foreign key (post_id) references public.posts(id) on delete cascade;
exception when duplicate_table or duplicate_object then null;
end $$;

create index if not exists idx_post_images_post on public.post_images (post_id, sort_order);

alter table public.post_images enable row level security;

-- Anyone who can see posts can see images
drop policy if exists "Pro users can read post images" on public.post_images;
create policy "Pro users can read post images"
  on public.post_images for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_pro = true
    )
  );

-- Post authors can add images
drop policy if exists "Post authors can insert images" on public.post_images;
create policy "Post authors can insert images"
  on public.post_images for insert
  with check (
    exists (
      select 1 from public.posts
      where posts.id = post_id and posts.author_id = auth.uid()
    )
  );

-- Post authors can delete their images
drop policy if exists "Post authors can delete images" on public.post_images;
create policy "Post authors can delete images"
  on public.post_images for delete
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_id and posts.author_id = auth.uid()
    )
  );

-- ── Storage Bucket ────────────────────────────────────────────
-- NOTE: Supabase Storage buckets must be created via the Dashboard
-- or the Storage API. Run this SQL AND then create the bucket:
--
--   Dashboard > Storage > New Bucket
--   Name: community-images
--   Public: ON (so images can be served without auth headers)
--   File size limit: 5MB
--   Allowed MIME types: image/jpeg, image/png, image/webp, image/gif
--
-- Then add these Storage RLS policies in the Dashboard:
--
--   SELECT (read): Allow authenticated users
--   INSERT (upload): Allow Pro users
--     - ((storage.foldername(name))[1] = auth.uid()::text)
--   DELETE: Allow users to delete own uploads
--     - ((storage.foldername(name))[1] = auth.uid()::text)

-- Insert bucket record if using SQL (works on most Supabase versions)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-images',
  'community-images',
  true,
  5242880,  -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Storage policies: Pro users can upload to their own folder
-- Path pattern: community-images/{user_id}/{filename}

drop policy if exists "Pro users can upload community images" on storage.objects;
create policy "Pro users can upload community images"
  on storage.objects for insert
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_pro = true
    )
  );

drop policy if exists "Anyone can view community images" on storage.objects;
create policy "Anyone can view community images"
  on storage.objects for select
  using (bucket_id = 'community-images');

drop policy if exists "Users can delete own community images" on storage.objects;
create policy "Users can delete own community images"
  on storage.objects for delete
  using (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
