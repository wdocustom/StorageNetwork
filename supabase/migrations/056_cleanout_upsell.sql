-- Migration 056: Cleanout Upsell — Automated pre-install upsell system
--
-- Adds tracking fields for the cleanout upsell email campaign:
--   - cleanout_upsell_sent: Timestamp when the upsell email was sent (NULL = not sent)
--   - cleanout_upsell_service: JSONB snapshot of the selected cleanout service
--   - cleanout_upsell_amount: Total price of the upsold cleanout service
--   - cleanout_upsell_deposit: 50% deposit collected from customer
--   - cleanout_upsell_paid_at: Timestamp when the upsell deposit was paid
--
-- Fee split for network-driven upsells:
--   10% → Platform fee
--   40% → Installer (immediate payout)
--   50% → Remaining balance (collected at service time)

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cleanout_upsell_sent timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cleanout_upsell_service jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cleanout_upsell_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cleanout_upsell_deposit numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cleanout_upsell_paid_at timestamptz DEFAULT NULL;
