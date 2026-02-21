-- ============================================================
-- Pro Community Feature — Supabase Schema
-- Run this in the Supabase SQL Editor AFTER the base schema.
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. COMMUNITIES / SPACES
-- Overarching topic spaces. Only admins create these initially.
-- ═══════════════════════════════════════════════════════════════
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  icon_url text,
  created_by uuid references public.profiles(id) on delete set null,
  post_count integer not null default 0,
  member_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.communities enable row level security;

-- All Pro users can read communities
create policy "Pro users can read communities"
  on public.communities for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_pro = true
    )
  );

-- Only the creator (admin) can insert communities
create policy "Admins can insert communities"
  on public.communities for insert
  with check (auth.uid() = created_by);

-- Only the creator can update their community
create policy "Admins can update own communities"
  on public.communities for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- ═══════════════════════════════════════════════════════════════
-- 2. POSTS
-- User-submitted content within a community.
-- ═══════════════════════════════════════════════════════════════
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  comment_count integer not null default 0,
  ai_summary text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for fast feed queries
create index idx_posts_community_created on public.posts (community_id, created_at desc);
create index idx_posts_community_upvotes on public.posts (community_id, upvotes desc);
create index idx_posts_author on public.posts (author_id);
create index idx_posts_tags on public.posts using gin (tags);

alter table public.posts enable row level security;

-- All Pro users can read posts
create policy "Pro users can read posts"
  on public.posts for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_pro = true
    )
  );

-- Pro users can create posts
create policy "Pro users can insert posts"
  on public.posts for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_pro = true
    )
  );

-- Authors can update their own posts
create policy "Authors can update own posts"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- Authors can delete their own posts
create policy "Authors can delete own posts"
  on public.posts for delete
  using (auth.uid() = author_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. COMMENTS
-- Threaded comments with self-referencing parent_id for nesting.
-- ═══════════════════════════════════════════════════════════════
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null,
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  depth integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for fast nested comment reads
create index idx_comments_post on public.comments (post_id, created_at asc);
create index idx_comments_parent on public.comments (parent_id);
create index idx_comments_author on public.comments (author_id);

alter table public.comments enable row level security;

-- All Pro users can read comments
create policy "Pro users can read comments"
  on public.comments for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_pro = true
    )
  );

-- Pro users can create comments
create policy "Pro users can insert comments"
  on public.comments for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_pro = true
    )
  );

-- Authors can update their own comments
create policy "Authors can update own comments"
  on public.comments for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- Authors can delete their own comments
create policy "Authors can delete own comments"
  on public.comments for delete
  using (auth.uid() = author_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. VOTES
-- Junction table: tracks user votes on posts and comments.
-- Prevents duplicate voting via unique constraint.
-- vote_value: +1 (upvote), -1 (downvote)
-- ═══════════════════════════════════════════════════════════════
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  vote_value smallint not null check (vote_value in (-1, 1)),
  created_at timestamptz not null default now(),

  -- Ensure a user can only vote once per post or comment
  constraint votes_unique_post unique (user_id, post_id),
  constraint votes_unique_comment unique (user_id, comment_id),

  -- Must reference exactly one of post or comment
  constraint votes_target_check check (
    (post_id is not null and comment_id is null) or
    (post_id is null and comment_id is not null)
  )
);

create index idx_votes_post on public.votes (post_id) where post_id is not null;
create index idx_votes_comment on public.votes (comment_id) where comment_id is not null;
create index idx_votes_user on public.votes (user_id);

alter table public.votes enable row level security;

-- Pro users can read votes (needed to show current user's vote state)
create policy "Pro users can read votes"
  on public.votes for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_pro = true
    )
  );

-- Pro users can insert votes
create policy "Pro users can insert votes"
  on public.votes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_pro = true
    )
  );

-- Users can update their own votes (change direction)
create policy "Users can update own votes"
  on public.votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own votes (un-vote)
create policy "Users can delete own votes"
  on public.votes for delete
  using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. AUTO-UPDATE updated_at TRIGGERS
-- ═══════════════════════════════════════════════════════════════
create trigger communities_updated_at
  before update on public.communities
  for each row execute function public.update_updated_at();

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.update_updated_at();

create trigger comments_updated_at
  before update on public.comments
  for each row execute function public.update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 6. HELPER FUNCTIONS
-- Auto-increment/decrement counters for denormalized counts.
-- ═══════════════════════════════════════════════════════════════

-- Increment community post_count on new post
create or replace function public.increment_community_post_count()
returns trigger language plpgsql security definer as $$
begin
  update public.communities
    set post_count = post_count + 1
    where id = new.community_id;
  return new;
end;
$$;

create trigger on_post_created
  after insert on public.posts
  for each row execute function public.increment_community_post_count();

-- Decrement community post_count on post deletion
create or replace function public.decrement_community_post_count()
returns trigger language plpgsql security definer as $$
begin
  update public.communities
    set post_count = greatest(0, post_count - 1)
    where id = old.community_id;
  return old;
end;
$$;

create trigger on_post_deleted
  after delete on public.posts
  for each row execute function public.decrement_community_post_count();

-- Increment post comment_count on new comment
create or replace function public.increment_post_comment_count()
returns trigger language plpgsql security definer as $$
begin
  update public.posts
    set comment_count = comment_count + 1
    where id = new.post_id;
  return new;
end;
$$;

create trigger on_comment_created
  after insert on public.comments
  for each row execute function public.increment_post_comment_count();

-- Decrement post comment_count on comment deletion
create or replace function public.decrement_post_comment_count()
returns trigger language plpgsql security definer as $$
begin
  update public.posts
    set comment_count = greatest(0, comment_count - 1)
    where id = old.post_id;
  return old;
end;
$$;

create trigger on_comment_deleted
  after delete on public.comments
  for each row execute function public.decrement_post_comment_count();

-- ═══════════════════════════════════════════════════════════════
-- 7. SEED DEFAULT COMMUNITIES
-- ═══════════════════════════════════════════════════════════════
insert into public.communities (name, slug, description) values
  ('General Discussion', 'general', 'Open discussion about anything storage-related. Tips, tricks, and stories from the field.'),
  ('Build Showcase', 'builds', 'Show off your latest tote rack builds. Photos, dimensions, and proud moments.'),
  ('Business Tips', 'business', 'Grow your installer business. Marketing, pricing, customer management strategies.'),
  ('Technical Help', 'tech-help', 'Got a tricky build? Ask the community for advice on materials, techniques, and troubleshooting.'),
  ('Feature Requests', 'features', 'Suggest and vote on new features for the Storage Network platform.')
on conflict (slug) do nothing;
