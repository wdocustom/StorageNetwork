-- ═══════════════════════════════════════════════════════════════════════════
-- Gift DIY plans: buy All-Access for other people (/plans/gift)
--
-- One Stripe Checkout Session pays for N gifts ($19 each, quantity N). The
-- recipients are written here BEFORE checkout (Stripe metadata can't hold
-- ten names and emails), and the session carries only gift_order_id.
--
-- When the session is paid (webhook, the gifter's return page, or the hourly
-- reconcile, whichever comes first), each plan_gifts row becomes its own
-- public_plan_purchases row under the RECIPIENT's email, then gets its own
-- email. Purchase rows use stripe_session_id "<cs_…>__gift_<position>" so
-- they stay unique and NOT NULL, and analytics can map them back to the
-- session.
--
-- Written and read only by the server (service role). RLS on, no policies.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.plan_gift_orders (
  id uuid primary key default gen_random_uuid(),
  -- Set right after the Checkout Session is created; null only if that failed.
  stripe_session_id text unique,
  -- Lets the gifter reopen the "gifts sent" page from their receipt email.
  manage_token uuid not null unique default gen_random_uuid(),
  gifter_name text not null,
  gifter_email text not null,
  message text,
  quantity int not null check (quantity between 1 and 10),
  unit_amount_cents int not null check (unit_amount_cents > 0),
  amount_cents int not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  -- Gifter's receipt: claimed (set) by whoever sends it, so it goes out once.
  receipt_claimed_at timestamptz,
  receipt_sent_at timestamptz,
  promoter_id uuid,
  visitor_id text,
  created_at timestamptz not null default now()
);

create index if not exists plan_gift_orders_status_idx on public.plan_gift_orders (status, created_at desc);
create index if not exists plan_gift_orders_gifter_email_idx on public.plan_gift_orders (gifter_email);

create table if not exists public.plan_gifts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.plan_gift_orders(id) on delete cascade,
  position int not null check (position between 1 and 10),
  recipient_name text not null,
  recipient_email text not null,
  -- public_plan_purchases.access_token once fulfilled (rotates if the gifter
  -- corrects a mistyped email before the gift is opened).
  purchase_token uuid unique,
  -- pending → sending (claimed) → sent | failed. A send stuck in "sending"
  -- (runtime killed mid-send) is retried by the reconcile job.
  email_status text not null default 'pending' check (email_status in ('pending', 'sending', 'sent', 'failed')),
  email_attempts int not null default 0,
  email_error text,
  email_claimed_at timestamptz,
  sent_at timestamptz,
  -- Gifter-triggered resends and email corrections (throttled in code).
  resend_count int not null default 0,
  last_resent_at timestamptz,
  email_corrections int not null default 0,
  -- First time the recipient's gift page ran in a browser.
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, position),
  unique (order_id, recipient_email)
);

create index if not exists plan_gifts_order_idx on public.plan_gifts (order_id, position);
create index if not exists plan_gifts_email_status_idx on public.plan_gifts (email_status) where email_status <> 'sent';

alter table public.public_plan_purchases
  add column if not exists gift_id uuid null references public.plan_gifts(id) on delete set null;

create unique index if not exists public_plan_purchases_gift_id_key
  on public.public_plan_purchases (gift_id) where gift_id is not null;

comment on column public.public_plan_purchases.gift_id is
  'Gifted All-Access: the plan_gifts row this purchase was bought under (paid by the gifter). NULL for normal purchases.';

alter table public.plan_gift_orders enable row level security;
alter table public.plan_gifts enable row level security;
