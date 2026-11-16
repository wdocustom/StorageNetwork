-- One-time emails to DIY plan buyers: one row per (email, campaign) so a
-- campaign reaches each buyer once, however often its job runs.
create table if not exists public.plan_buyer_campaigns (
  email text not null,
  campaign text not null,
  sent_at timestamptz not null default now(),
  primary key (email, campaign)
);
alter table public.plan_buyer_campaigns enable row level security;
-- service role only (no policies)
