-- ════════════════════════════════════════════════════════════════════════
-- 054 — Saved Facebook Groups
-- Lets installers save their Facebook group URLs for quick multi-posting
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.saved_facebook_groups (
  id uuid primary key default gen_random_uuid(),
  installer_id uuid not null references public.profiles(id) on delete cascade,
  group_name text not null,
  group_url text not null,
  created_at timestamptz not null default now()
);

-- Index for fast lookups by installer
create index if not exists idx_saved_fb_groups_installer
  on public.saved_facebook_groups(installer_id);

-- RLS
alter table public.saved_facebook_groups enable row level security;

-- Installers can only see/manage their own groups
create policy "Installers can view own groups"
  on public.saved_facebook_groups for select
  using (auth.uid() = installer_id);

create policy "Installers can insert own groups"
  on public.saved_facebook_groups for insert
  with check (auth.uid() = installer_id);

create policy "Installers can delete own groups"
  on public.saved_facebook_groups for delete
  using (auth.uid() = installer_id);
