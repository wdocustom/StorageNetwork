-- ═══════════════════════════════════════════════════════════════════════════
-- 115 — Inventory-mode gifts: dispatch path that debits realtor tote balance
--
-- Adds the schema needed for the realtor-bulk-inventory dispatch flow built
-- alongside this migration:
--
--   tote_rental_gifts.dispatch_source        — 'package' (existing quick-send
--                                              catalog) or 'inventory' (new
--                                              bulk-balance path).
--   tote_rental_gifts.delivery_distance_miles — ZIP-centroid distance from
--                                              the routed installer to the
--                                              recipient, snapshotted at
--                                              dispatch time. Audit/display
--                                              only — gating happens in code.
--   tote_rental_gifts.package_id is now nullable for inventory gifts.
--                                              A check constraint enforces
--                                              exclusivity: package gifts
--                                              MUST have package_id, inventory
--                                              gifts MUST NOT.
--
-- Plus an atomic dispatch function:
--
--   dispatch_inventory_tote_gift(...)        — Locks the realtor's profile
--                                              row, validates balance, inserts
--                                              the gift, debits balance. All
--                                              one transaction so concurrent
--                                              dispatches can't both pass the
--                                              balance check and overdraft.
--
-- Status convention for inventory gifts:
--   • surcharge_cents = 0     → status='paid' immediately; gift_token + paid_at
--                                stamped at insert. No Stripe round-trip.
--   • surcharge_cents > 0     → status='pending_payment'; gift_token + paid_at
--                                left NULL. Stripe Checkout collects the $25
--                                extended-delivery surcharge; webhook flips
--                                the row to 'paid' and generates the token.
--
-- Balance debit happens up-front in BOTH cases — the totes are "reserved"
-- the moment the gift row exists. If the surcharge Stripe session is
-- abandoned, a cron sweep (future PR) will restore balance on
-- pending_payment rows older than 1 hour.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Columns ──────────────────────────────────────────────────────────────

ALTER TABLE public.tote_rental_gifts
  ADD COLUMN IF NOT EXISTS dispatch_source         text NOT NULL DEFAULT 'package',
  ADD COLUMN IF NOT EXISTS delivery_distance_miles int  NULL;

ALTER TABLE public.tote_rental_gifts
  DROP CONSTRAINT IF EXISTS tote_rental_gifts_dispatch_source_check;

ALTER TABLE public.tote_rental_gifts
  ADD CONSTRAINT tote_rental_gifts_dispatch_source_check
  CHECK (dispatch_source IN ('package', 'inventory'));

-- Drop the NOT NULL on package_id so inventory gifts can exist without
-- a catalog package_id.
ALTER TABLE public.tote_rental_gifts
  ALTER COLUMN package_id DROP NOT NULL;

-- Enforce mutual exclusion between dispatch sources and package_id presence.
-- Existing rows are all dispatch_source='package' (the new default) AND have
-- package_id set, so the constraint validates cleanly on backfill.
ALTER TABLE public.tote_rental_gifts
  DROP CONSTRAINT IF EXISTS tote_rental_gifts_dispatch_source_package_xor;

ALTER TABLE public.tote_rental_gifts
  ADD CONSTRAINT tote_rental_gifts_dispatch_source_package_xor
  CHECK (
    (dispatch_source = 'package'   AND package_id IS NOT NULL)
    OR
    (dispatch_source = 'inventory' AND package_id IS NULL)
  );

COMMENT ON COLUMN public.tote_rental_gifts.dispatch_source IS
  '''package'' for quick-send catalog purchases (Starter/Standard/Pro/Premium); '
  '''inventory'' for gifts dispatched against the realtor''s bulk-tote balance. '
  'Inventory gifts have package_id IS NULL and amount_cents = surcharge only.';

COMMENT ON COLUMN public.tote_rental_gifts.delivery_distance_miles IS
  'ZIP-centroid distance from the installer''s service_zip to the recipient''s '
  'delivery_zip, snapshotted at gift creation. Inventory gifts use this to '
  'decide surcharge tier (0–50 free / 51–75 +$25 / >75 inquire-only at the '
  'form level).';

-- Bounded tote_count for inventory gifts. Quick-send is bounded by the
-- catalog (20/30/40/50). Inventory mode enforces 10–50 per gift per the
-- product spec — encoded as a CHECK so the form can't bypass it.
ALTER TABLE public.tote_rental_gifts
  DROP CONSTRAINT IF EXISTS tote_rental_gifts_inventory_tote_count_range;

ALTER TABLE public.tote_rental_gifts
  ADD CONSTRAINT tote_rental_gifts_inventory_tote_count_range
  CHECK (
    dispatch_source <> 'inventory'
    OR (tote_count BETWEEN 10 AND 50)
  );

-- ── Atomic dispatch function ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.dispatch_inventory_tote_gift(
  p_realtor_id        uuid,
  p_recipient_name    text,
  p_recipient_email   text,
  p_delivery_address  text,
  p_delivery_zip      text,
  p_personal_message  text,
  p_tote_count        int,
  p_duration_days     int,
  p_surcharge_cents   int,
  p_distance_miles    int,
  -- Caller-generated 32-hex gift_token. Used only when surcharge_cents = 0
  -- (immediate-paid path). For the Stripe surcharge path, NULL is stored and
  -- the webhook generates the token at finalize.
  p_gift_token        text
)
RETURNS TABLE (
  gift_id     uuid,
  status      text,
  new_balance int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance     int;
  v_gift_id     uuid;
  v_status      text;
  v_new_balance int;
  v_now         timestamptz := now();
BEGIN
  -- Lock the realtor's profile row so concurrent dispatch calls serialize.
  SELECT realtor_tote_balance INTO v_balance
    FROM public.profiles
    WHERE id = p_realtor_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Realtor % not found', p_realtor_id
      USING ERRCODE = 'P0002';
  END IF;

  IF p_tote_count < 10 OR p_tote_count > 50 THEN
    RAISE EXCEPTION 'Inventory gifts require 10..50 totes; got %', p_tote_count
      USING ERRCODE = '22023';
  END IF;

  IF v_balance < p_tote_count THEN
    RAISE EXCEPTION 'Insufficient tote balance: has %, needs %', v_balance, p_tote_count
      USING ERRCODE = '23514';
  END IF;

  IF p_surcharge_cents = 0 THEN
    v_status := 'paid';
  ELSE
    v_status := 'pending_payment';
  END IF;

  INSERT INTO public.tote_rental_gifts (
    realtor_id, package_id, duration_days, tote_count, amount_cents,
    recipient_name, recipient_email, delivery_address, delivery_zip,
    personal_message, status, dispatch_source, delivery_distance_miles,
    gift_token, paid_at
  ) VALUES (
    p_realtor_id, NULL, p_duration_days, p_tote_count, p_surcharge_cents,
    p_recipient_name, p_recipient_email, p_delivery_address, p_delivery_zip,
    p_personal_message, v_status, 'inventory', p_distance_miles,
    CASE WHEN p_surcharge_cents = 0 THEN p_gift_token ELSE NULL END,
    CASE WHEN p_surcharge_cents = 0 THEN v_now ELSE NULL END
  )
  RETURNING id INTO v_gift_id;

  -- Pre-debit the balance — totes are reserved the moment the gift row
  -- exists. The CHECK (realtor_tote_balance >= 0) on the profiles column
  -- is an additional safety net but should never fire because of the
  -- explicit balance check above.
  UPDATE public.profiles
    SET realtor_tote_balance = realtor_tote_balance - p_tote_count
    WHERE id = p_realtor_id
    RETURNING realtor_tote_balance INTO v_new_balance;

  gift_id     := v_gift_id;
  status      := v_status;
  new_balance := v_new_balance;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.dispatch_inventory_tote_gift IS
  'Atomic inventory-mode gift creation: locks the realtor profile row, '
  'validates balance >= tote_count, inserts the gift, debits balance. '
  'p_surcharge_cents = 0 → status=paid + gift_token stamped immediately. '
  'p_surcharge_cents > 0 → status=pending_payment; Stripe webhook stamps '
  'the token on completion.';

REVOKE ALL ON FUNCTION public.dispatch_inventory_tote_gift(
  uuid, text, text, text, text, text, int, int, int, int, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_inventory_tote_gift(
  uuid, text, text, text, text, text, int, int, int, int, text
) TO service_role;
