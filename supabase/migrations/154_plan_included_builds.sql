-- ═══════════════════════════════════════════════════════════════════════════
-- All-Access tote plans: plans built free after the first purchase
--
-- Since Nov 12, 2026 a tote plan purchase ($19, lifetime) covers every tote
-- organizer the buyer designs. Each extra plan is a public_plan_purchases
-- row like any other (its own access_token, same email), with included_from
-- set to the access_token of the PAID purchase it came from. Analytics and
-- referral payouts skip these rows: they are not sales.
--
-- stripe_session_id is NOT NULL, so included rows store "included_<uuid>".
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.public_plan_purchases
  add column if not exists included_from uuid null;

comment on column public.public_plan_purchases.included_from is
  'All-Access: access_token of the paid purchase this free plan was built under. NULL for real purchases.';

create index if not exists public_plan_purchases_email_plan_idx
  on public.public_plan_purchases (email, plan_id);
