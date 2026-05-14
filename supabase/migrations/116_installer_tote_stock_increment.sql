-- ═══════════════════════════════════════════════════════════════════════════
-- 116 — Installer tote-stock increment helper
--
-- Tiny RPC used by markGiftReturned (flipMilestone) to credit the installer's
-- available-tote count when a gift completes its return leg. Lives as a DB
-- function because the Supabase JS client can't express a column-arithmetic
-- UPDATE (stock = stock + N) directly — only literal-value sets.
--
-- The atomic milestone-flip in flipMilestone (the guarded UPDATE that
-- transitions status='delivered'→'returned') already guarantees this RPC
-- runs at most once per gift; this function is just a column increment, not
-- a coordination point.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.increment_installer_tote_stock(
  p_installer_id uuid,
  p_amount       int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_stock int;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Increment amount must be positive; got %', p_amount
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
    SET tote_fulfillment_stock = COALESCE(tote_fulfillment_stock, 0) + p_amount
    WHERE id = p_installer_id
    RETURNING tote_fulfillment_stock INTO v_new_stock;

  IF v_new_stock IS NULL THEN
    RAISE EXCEPTION 'Installer % not found', p_installer_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_new_stock;
END;
$$;

COMMENT ON FUNCTION public.increment_installer_tote_stock IS
  'Adds p_amount to profiles.tote_fulfillment_stock for an installer. Used '
  'by the returned-gift hook in flipMilestone to credit physical totes back '
  'to the installer''s available count.';

REVOKE ALL ON FUNCTION public.increment_installer_tote_stock(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_installer_tote_stock(uuid, int) TO service_role;
