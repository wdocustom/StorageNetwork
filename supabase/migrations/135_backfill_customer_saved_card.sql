-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 135: Backfill existing customers with their saved card
--
-- Migration 134 added Stripe columns to `customers`, but they're only
-- populated going forward (by getOrCreateStripeCustomerForLead and the
-- deposit webhook/fallback verifier on a NEW deposit). Without a backfill,
-- customers who already saved a card on a quote before this shipped
-- wouldn't get the cross-quote reuse benefit until their next deposit —
-- defeating the point for existing repeat customers. Backfill each
-- customer from their most recently updated lead that has a saved card.
--
-- Safe to re-run: only fills rows where customers.stripe_payment_method_id
-- is still NULL, so it never clobbers a card already written by the new
-- per-deposit dual-write.
-- ═══════════════════════════════════════════════════════════════════════════

WITH latest_saved_card AS (
  SELECT DISTINCT ON (customer_id)
    customer_id,
    stripe_customer_id,
    stripe_payment_method_id,
    stripe_payment_method_brand,
    stripe_payment_method_last4
  FROM public.leads
  WHERE customer_id IS NOT NULL
    AND stripe_payment_method_id IS NOT NULL
  ORDER BY customer_id, updated_at DESC
)
UPDATE public.customers c
SET
  stripe_customer_id = lsc.stripe_customer_id,
  stripe_payment_method_id = lsc.stripe_payment_method_id,
  stripe_payment_method_brand = lsc.stripe_payment_method_brand,
  stripe_payment_method_last4 = lsc.stripe_payment_method_last4
FROM latest_saved_card lsc
WHERE c.id = lsc.customer_id
  AND c.stripe_payment_method_id IS NULL;
