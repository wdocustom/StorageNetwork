-- ═══════════════════════════════════════════════════════════════════════════
-- Holiday Full Refund Giveaway: free (no purchase necessary) entries, from
-- the form on /refund-rules. One per email per Central Time day (each CT day
-- is its own drawing). Purchase entries need no table: they are the day's
-- paid plan purchases (public_plan_purchases / plan_gift_orders).
-- Written and read only by the server (service role).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.refund_giveaway_free_entries (
  id uuid primary key default gen_random_uuid(),
  /** The drawing day, in Central Time */
  entry_date date not null,
  full_name text not null,
  email text not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (email, entry_date)
);

create index if not exists refund_giveaway_free_entries_date_idx
  on public.refund_giveaway_free_entries (entry_date);

alter table public.refund_giveaway_free_entries enable row level security;
