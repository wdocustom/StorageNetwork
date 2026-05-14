-- ═══════════════════════════════════════════════════════════════════════════
-- 114 — Atomic credit function for realtor tote-pack purchases
--
-- The Stripe webhook + the success-page poll can both fire finalize on the
-- same checkout session. We need to flip the purchase row's status AND
-- increment profiles.realtor_tote_balance as a single atomic unit, with
-- idempotency so the second caller is a no-op.
--
-- Strategy: SELECT ... FOR UPDATE the purchase row inside this function
-- (which runs in a single implicit transaction). The first caller transitions
-- pending_payment → paid and adds total_credited to the balance. The second
-- caller sees status='paid' and returns already_credited=true. Any other
-- terminal status (failed / cancelled) raises so the webhook logs it.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.credit_realtor_tote_purchase(
  p_stripe_session_id        text,
  p_stripe_payment_intent_id text DEFAULT NULL
)
RETURNS TABLE (
  purchase_id      uuid,
  realtor_id       uuid,
  total_credited   int,
  already_credited boolean,
  new_balance      int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.realtor_tote_purchases%ROWTYPE;
  v_balance  int;
BEGIN
  -- Lock the purchase row for the duration of this function so a concurrent
  -- finalize call blocks here until we commit.
  SELECT * INTO v_purchase
    FROM public.realtor_tote_purchases
    WHERE stripe_session_id = p_stripe_session_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tote purchase found for stripe_session_id %', p_stripe_session_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent: if already paid, return the current balance without crediting again.
  IF v_purchase.status = 'paid' THEN
    SELECT realtor_tote_balance INTO v_balance
      FROM public.profiles
      WHERE id = v_purchase.realtor_id;

    purchase_id      := v_purchase.id;
    realtor_id       := v_purchase.realtor_id;
    total_credited   := v_purchase.total_credited;
    already_credited := true;
    new_balance      := COALESCE(v_balance, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  -- Refuse to credit a row that's already terminally bad — surfaces a clean
  -- error to the webhook log instead of silently mutating state.
  IF v_purchase.status <> 'pending_payment' THEN
    RAISE EXCEPTION
      'Tote purchase % is in terminal status %; cannot credit', v_purchase.id, v_purchase.status
      USING ERRCODE = '22023';
  END IF;

  -- Flip the purchase row to paid.
  UPDATE public.realtor_tote_purchases
    SET status                   = 'paid',
        paid_at                  = now(),
        stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id)
    WHERE id = v_purchase.id;

  -- Credit the realtor's balance. Returning gives us the post-update value.
  UPDATE public.profiles
    SET realtor_tote_balance = realtor_tote_balance + v_purchase.total_credited
    WHERE id = v_purchase.realtor_id
    RETURNING realtor_tote_balance INTO v_balance;

  purchase_id      := v_purchase.id;
  realtor_id       := v_purchase.realtor_id;
  total_credited   := v_purchase.total_credited;
  already_credited := false;
  new_balance      := v_balance;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.credit_realtor_tote_purchase(text, text) IS
  'Atomic credit of a tote-pack purchase: flips realtor_tote_purchases.status '
  'to paid AND adds total_credited to profiles.realtor_tote_balance, gated by '
  'a row lock so concurrent webhook/success-page finalize calls cannot '
  'double-credit. Idempotent — second call returns already_credited=true.';

-- Restrict execution to the service role (webhook + server actions run as
-- service_role; realtors never call this directly).
REVOKE ALL ON FUNCTION public.credit_realtor_tote_purchase(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_realtor_tote_purchase(text, text) TO service_role;
