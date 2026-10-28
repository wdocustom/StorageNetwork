-- Buyer's name from Stripe Checkout (customer_details.name), so the DIY plan
-- PDF cover can say "Designed for <first name>". Nullable: purchases made
-- before this column existed fall back to "Designed for you".
ALTER TABLE public_plan_purchases ADD COLUMN IF NOT EXISTS customer_name text;
