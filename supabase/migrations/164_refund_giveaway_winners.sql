-- ═══════════════════════════════════════════════════════════════════════════
-- Holiday Full Refund Giveaway: winners, drawn from the admin tool.
--
-- One row per prize. A purchase winner gets the order refunded in Stripe;
-- a free-entry winner with no purchase that day gets a lifetime plans
-- account. "void" rows (drawn but ineligible) keep their entry out of later
-- draws but free the person to win that day from another entry.
-- Free entries sent by email are added by an admin (source = 'email').
-- Written and read only by the server (service role).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.refund_giveaway_free_entries
  add column if not exists source text not null default 'form'
  check (source in ('form', 'email'));

create table if not exists public.refund_giveaway_winners (
  id uuid primary key default gen_random_uuid(),
  draw_date date not null,                 -- the Central Time day drawn
  entry_kind text not null check (entry_kind in ('purchase', 'gift_order', 'free')),
  entry_ref text not null,                 -- Stripe session id, or free:<entry id>
  email text not null,
  full_name text,
  prize text not null check (prize in ('refund', 'plans_account')),
  stripe_session_id text,                  -- the order refunded (refund prizes)
  amount_cents integer,                    -- what they paid / were refunded
  status text not null default 'drawn'
    check (status in ('drawn', 'processing', 'refunded', 'granted', 'failed', 'void')),
  stripe_refund_id text,
  access_token uuid,                       -- their plans (link in the email)
  error text,
  notified_at timestamptz,
  notify_error text,
  drawn_by uuid,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- One prize per person per day; an entry wins at most once.
create unique index if not exists refund_giveaway_winners_person_day
  on public.refund_giveaway_winners (draw_date, lower(email)) where status <> 'void';
create unique index if not exists refund_giveaway_winners_entry
  on public.refund_giveaway_winners (entry_ref);
-- A Stripe order is refunded at most once.
create unique index if not exists refund_giveaway_winners_session
  on public.refund_giveaway_winners (stripe_session_id) where stripe_session_id is not null and status <> 'void';
create index if not exists refund_giveaway_winners_date_idx on public.refund_giveaway_winners (draw_date);

alter table public.refund_giveaway_winners enable row level security;
