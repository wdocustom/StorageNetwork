-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 099: Atomic Credit Operations (AI Asset Forge)
--
-- Provides race-safe debit/credit RPCs for `profiles.marketing_credits`.
-- The Forge action calls `decrement_credits` to reserve a credit BEFORE
-- invoking the Replicate API, and `refund_credit` to restore it if the
-- generation fails. Both run in a single SQL statement so concurrent
-- requests can't double-spend.
--
-- Both functions are SECURITY DEFINER so the constraint check + UPDATE
-- run with elevated privileges, but EXECUTE is revoked from anon /
-- authenticated to prevent clients from mutating their own balances
-- directly via PostgREST. Server actions using the service role key
-- can still call them.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.decrement_credits(user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining integer;
BEGIN
  UPDATE public.profiles
     SET marketing_credits = marketing_credits - 1
   WHERE id = decrement_credits.user_id
     AND marketing_credits >= 1
   RETURNING marketing_credits INTO remaining;

  IF remaining IS NULL THEN
    RAISE EXCEPTION 'Insufficient credits' USING ERRCODE = 'P0001';
  END IF;

  RETURN remaining;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credit(user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining integer;
BEGIN
  UPDATE public.profiles
     SET marketing_credits = marketing_credits + 1
   WHERE id = refund_credit.user_id
   RETURNING marketing_credits INTO remaining;

  RETURN COALESCE(remaining, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrement_credits(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refund_credit(uuid) FROM anon, authenticated, public;
