-- ============================================================
-- Migration 003: Waitlist table + leads deposit columns
-- ============================================================

-- 1. WAITLIST TABLE
-- Captures emails from unserviced ZIP codes
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  zip_code text not null,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

-- Allow public inserts (service role handles this)
create policy "Public can join waitlist"
  on public.waitlist for insert
  with check (true);

-- Only service role reads waitlist (no user-facing reads needed)
create policy "Service role reads waitlist"
  on public.waitlist for select
  using (false);

-- Index for dedup checks
create index if not exists idx_waitlist_email_zip
  on public.waitlist (email, zip_code);

-- 2. LEADS TABLE — add deposit tracking columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS balance_due numeric(10,2) DEFAULT 0;
