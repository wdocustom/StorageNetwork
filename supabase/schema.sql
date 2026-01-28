-- ============================================================
-- The Shelf Dude Partner Network - Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. PROFILES TABLE
-- Extends auth.users with business-specific fields.
-- A row is auto-created on signup via trigger.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  business_name text,
  is_pro boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2. LEADS TABLE
-- Stores customer/job leads assigned to an installer.
-- installer_id is NULLABLE so public "Get Quote" submissions can be saved
-- before an installer is assigned (network leads).
-- dimensions is a JSONB column for flexible storage of measurements.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  installer_id uuid references public.profiles(id) on delete cascade,
  is_network_lead boolean not null default false,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  address text,
  dimensions jsonb default '{}',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'quoted', 'accepted', 'completed', 'cancelled')),
  source text not null default 'network'
    check (source in ('network', 'self')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads enable row level security;

-- Installers can read their own assigned leads
create policy "Users can read own leads"
  on public.leads for select
  using (auth.uid() = installer_id);

-- Installers can insert leads tied to themselves
create policy "Users can insert own leads"
  on public.leads for insert
  with check (auth.uid() = installer_id);

-- Allow anonymous inserts for public quote requests (network leads).
-- The server action uses the service-role key, so this policy allows
-- anon-keyed inserts where installer_id is null and is_network_lead is true.
create policy "Public can submit network leads"
  on public.leads for insert
  with check (installer_id is null and is_network_lead = true);

create policy "Users can update own leads"
  on public.leads for update
  using (auth.uid() = installer_id)
  with check (auth.uid() = installer_id);

create policy "Users can delete own leads"
  on public.leads for delete
  using (auth.uid() = installer_id);

-- 3. SAVED BUILDS TABLE
-- Pro installers save calculator results (cut lists / shopping lists).
create table public.saved_builds (
  id uuid primary key default gen_random_uuid(),
  installer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  dimensions jsonb not null default '{}',
  cut_list jsonb not null default '[]',
  shopping_list jsonb not null default '[]',
  total_cost numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saved_builds enable row level security;

create policy "Users can read own builds"
  on public.saved_builds for select
  using (auth.uid() = installer_id);

create policy "Users can insert own builds"
  on public.saved_builds for insert
  with check (auth.uid() = installer_id);

create policy "Users can update own builds"
  on public.saved_builds for update
  using (auth.uid() = installer_id)
  with check (auth.uid() = installer_id);

create policy "Users can delete own builds"
  on public.saved_builds for delete
  using (auth.uid() = installer_id);

-- 4. AUTO-CREATE PROFILE ON SIGNUP
-- Trigger function that inserts a profiles row when a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. AUTO-UPDATE updated_at COLUMNS
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.update_updated_at();

create trigger saved_builds_updated_at
  before update on public.saved_builds
  for each row execute function public.update_updated_at();
