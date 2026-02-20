-- ============================================================
-- Post Images — Supabase Storage + post_images table
-- Allows Pro users to attach multiple photos to community posts
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. POST_IMAGES TABLE
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  image_url text not null,
  storage_path text not null,
  sort_order integer not null default 0,
  caption text,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.post_images
    add constraint post_images_post_id_fkey
    foreign key (post_id) references public.posts(id) on delete cascade;
exception when duplicate_object then null;
end $$;

create index if not exists idx_post_images_post on public.post_images (post_id, sort_order);

alter table public.post_images enable row level security;

-- RLS: Pro users can view images on any post they can see
drop policy if exists "Pro users can read post images" on public.post_images;
create policy "Pro users can read post images"
  on public.post_images for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_pro = true
    )
  );

-- RLS: Post author can insert images for their own posts
drop policy if exists "Authors can insert post images" on public.post_images;
create policy "Authors can insert post images"
  on public.post_images for insert
  with check (
    exists (
      select 1 from public.posts
      where posts.id = post_id and posts.author_id = auth.uid()
    )
  );

-- RLS: Post author can delete images from their own posts
drop policy if exists "Authors can delete post images" on public.post_images;
create policy "Authors can delete post images"
  on public.post_images for delete
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_id and posts.author_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. STORAGE BUCKET (created via app code, but document here)
-- Bucket: community-images
-- Public: true (images are viewable by anyone with the URL)
-- Max file size: 5MB
-- Allowed types: image/jpeg, image/png, image/webp, image/gif
-- ═══════════════════════════════════════════════════════════════
-- Note: Supabase Storage buckets are created programmatically
-- in the server action (ensureBucket pattern).
-- Storage RLS policies are also managed via the dashboard or
-- the storage API, not via SQL migrations.
