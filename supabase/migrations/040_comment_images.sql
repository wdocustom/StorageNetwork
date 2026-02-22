-- ============================================================
-- Migration 040: Comment Images — Photo Replies
--
-- Adds a comment_images table for image attachments on comments.
-- Reuses the existing "community-images" storage bucket.
-- ============================================================

-- ── Table: comment_images ───────────────────────────────────
create table if not exists public.comment_images (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null,
  image_url text not null,
  storage_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.comment_images
    add constraint comment_images_comment_id_fkey
    foreign key (comment_id) references public.comments(id) on delete cascade;
exception when others then null;
end $$;

create index if not exists idx_comment_images_comment on public.comment_images (comment_id, sort_order);

alter table public.comment_images enable row level security;

-- Pro users can see comment images
drop policy if exists "Pro users can read comment images" on public.comment_images;
create policy "Pro users can read comment images"
  on public.comment_images for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_pro = true
    )
  );

-- Comment authors can add images
drop policy if exists "Comment authors can insert images" on public.comment_images;
create policy "Comment authors can insert images"
  on public.comment_images for insert
  with check (
    exists (
      select 1 from public.comments
      where comments.id = comment_id and comments.author_id = auth.uid()
    )
  );

-- Comment authors can delete their images
drop policy if exists "Comment authors can delete images" on public.comment_images;
create policy "Comment authors can delete images"
  on public.comment_images for delete
  using (
    exists (
      select 1 from public.comments
      where comments.id = comment_id and comments.author_id = auth.uid()
    )
  );
