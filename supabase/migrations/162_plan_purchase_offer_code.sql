-- ═══════════════════════════════════════════════════════════════════════════
-- Which offer a tote plan purchase was bought with (Stripe metadata.offer):
--   'save3'  — the retention ("exit") offer, $3 off
--   'save5'  — the retired $5-off retention offer (older links)
--   'friday' — the Black Friday promo code, limited to one per email
-- NULL = regular price. Lets checkout enforce "FRIDAY once per email".
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.public_plan_purchases
  add column if not exists offer_code text null;

create index if not exists public_plan_purchases_email_offer_idx
  on public.public_plan_purchases (email, offer_code)
  where offer_code is not null;

comment on column public.public_plan_purchases.offer_code is
  'Offer the purchase was bought with (save3, save5, friday); NULL = regular price.';
