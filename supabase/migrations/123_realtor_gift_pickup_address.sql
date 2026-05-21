-- ═══════════════════════════════════════════════════════════════════════════
-- 123_realtor_gift_pickup_address.sql
--
-- Adds an optional pickup address to closing-gift orders. Default behavior
-- (and the row state when these columns are null) is that the installer
-- retrieves the totes from the same address where they were delivered.
-- When the realtor checks "Pickup address is different than delivery" on
-- the gift form, these two columns capture where the installer should go
-- to pick the totes up at the end of the rental.
--
-- pickup_zip is also fed into findEligibleInstaller so the routing pool is
-- restricted to installers whose service_zips covers BOTH the delivery
-- address AND the pickup address — picking an installer who can't reach
-- the pickup would strand the totes at the recipient's house.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE tote_rental_gifts
  ADD COLUMN IF NOT EXISTS pickup_address text NULL,
  ADD COLUMN IF NOT EXISTS pickup_zip text NULL;

COMMENT ON COLUMN tote_rental_gifts.pickup_address IS
  'Optional. Where the installer retrieves totes at the end of the rental. NULL = same as delivery_address.';

COMMENT ON COLUMN tote_rental_gifts.pickup_zip IS
  'Optional. ZIP for the pickup location. When set, the assigned installer must cover BOTH delivery_zip and pickup_zip.';
