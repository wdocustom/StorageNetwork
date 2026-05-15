-- ═══════════════════════════════════════════════════════════════════════════
-- 120 — Drop the 28-day rental option from the tote-rental catalog
--
-- Product decision: the 28-day tier is being removed across the realtor
-- closing-gift flow. This migration prunes `duration_days = 28` entries
-- from every existing tote_rental_packages.pricing_tiers JSONB array so
-- the catalog-driven GiftPurchaseFlow stops surfacing it as an option.
--
-- The inventory-mode flow (no catalog row, custom totes count + duration)
-- enforces the [7, 14] whitelist client- and server-side in code, so it
-- doesn't need a DB change.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.tote_rental_packages
   SET pricing_tiers = (
     SELECT COALESCE(
       jsonb_agg(tier),
       '[]'::jsonb
     )
     FROM jsonb_array_elements(pricing_tiers) AS tier
     WHERE (tier->>'duration_days')::int <> 28
   )
 WHERE pricing_tiers @> '[{"duration_days":28}]'::jsonb;
