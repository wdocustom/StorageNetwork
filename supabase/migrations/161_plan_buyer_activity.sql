-- ═══════════════════════════════════════════════════════════════════════════
-- What DIY plan buyers do with their plans, after paying
--
-- plan_events (156) is the anonymous designer funnel BEFORE purchase. This is
-- per purchase AFTER it: when a buyer opens their plan (and how: straight
-- from checkout, the email link, My Builds…), new-device codes, the 3D guide
-- (opened, sections and steps reached, finished), PDF downloads, checklist
-- progress, buy-link taps, more plans built under All-Access, gift opens.
--
-- Keyed to the purchase's access_token, with the buyer's email copied in so
-- one buyer's activity reads across all their plans. device_hash is the same
-- sha256-of-cookie as plan_buyer_devices (never the cookie itself).
-- Server events are written where access is decided; browser events come
-- through /api/analytics/plan-activity, which checks the token first.
-- Written and read only by the server (service role).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.plan_buyer_activity (
  id uuid primary key default gen_random_uuid(),
  access_token uuid not null,
  email text not null,
  plan_id text not null,
  event text not null,
  detail text,
  -- Numeric payload where one fits (step reached, items checked…)
  value int,
  -- Out of how many (steps in the section, items on the list…)
  total int,
  device_hash text,
  session_id text,
  in_app text,
  created_at timestamptz not null default now()
);

create index if not exists plan_buyer_activity_email_idx on public.plan_buyer_activity (email, created_at desc);
create index if not exists plan_buyer_activity_token_idx on public.plan_buyer_activity (access_token, created_at desc);
create index if not exists plan_buyer_activity_created_idx on public.plan_buyer_activity (created_at desc);
create index if not exists plan_buyer_activity_event_idx on public.plan_buyer_activity (event, created_at desc);

alter table public.plan_buyer_activity enable row level security;
