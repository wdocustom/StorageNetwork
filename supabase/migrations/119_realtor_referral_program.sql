-- ═══════════════════════════════════════════════════════════════════════════
-- 119 — Realtor referral program
--
-- A realtor (enrolled in the closing-gift program) shares a unique link;
-- when a customer who clicks that link books a job with a network installer:
--   1. the installer's 15% platform fee on that lead is waived, AND
--   2. the realtor's tote-rental balance is credited 5 totes.
--
-- The 3-free-jobs trial mechanic is NOT consumed by realtor-referred leads
-- — those jobs are independently free via this attribution path, so the
-- installer's trial pool stays intact for organic platform leads. The
-- free-job counter in payments.ts is computed against
-- `referred_by_realtor_id IS NULL` rows only.
--
-- Schema additions:
--   profiles.realtor_referral_code         — per-realtor share slug (unique)
--   leads.referred_by_realtor_id           — FK at booking time
--   leads.realtor_referral_code_snapshot   — code value at booking (audit;
--                                            survives later code changes)
--   realtor_referral_credits               — one row per credited lead
--   credit_realtor_referral(lead_id)       — atomic, idempotent credit RPC
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Realtor share slug ────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS realtor_referral_code text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_realtor_referral_code_key;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_realtor_referral_code_key UNIQUE (realtor_referral_code);

CREATE INDEX IF NOT EXISTS idx_profiles_realtor_referral_code
  ON public.profiles (realtor_referral_code)
  WHERE realtor_referral_code IS NOT NULL;

COMMENT ON COLUMN public.profiles.realtor_referral_code IS
  'Per-realtor share slug. Lazily generated on first dashboard load. '
  'Maps to leads.referred_by_realtor_id when a customer books through '
  '/refer/<code>. Realtors only — installers leave this NULL.';

-- ── Attribution columns on leads ──────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS referred_by_realtor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS realtor_referral_code_snapshot text;

CREATE INDEX IF NOT EXISTS idx_leads_referred_by_realtor
  ON public.leads (referred_by_realtor_id)
  WHERE referred_by_realtor_id IS NOT NULL;

COMMENT ON COLUMN public.leads.referred_by_realtor_id IS
  'Realtor profile whose share link drove this booking. Set in '
  'submitNetworkLead from cookie or ?ref= query param. Triggers fee '
  'waiver in createDepositIntent and 5-tote credit on deposit_paid.';

COMMENT ON COLUMN public.leads.realtor_referral_code_snapshot IS
  'Snapshot of profiles.realtor_referral_code at booking time. Preserves '
  'attribution audit trail if a realtor regenerates their slug later.';

-- ── Credits ledger ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.realtor_referral_credits (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  realtor_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  totes_credited  int  NOT NULL DEFAULT 5 CHECK (totes_credited > 0),
  credited_at     timestamptz NOT NULL DEFAULT now(),
  -- One credit per lead — webhook retries become no-ops.
  CONSTRAINT realtor_referral_credits_lead_unique UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_realtor_referral_credits_realtor
  ON public.realtor_referral_credits (realtor_id, credited_at DESC);

COMMENT ON TABLE public.realtor_referral_credits IS
  'Audit log: one row per realtor-referred lead that converted (deposit paid). '
  'Each row also represents a +5 increment that was applied to '
  'profiles.realtor_tote_balance. UNIQUE(lead_id) enforces idempotency so '
  'Stripe webhook retries cannot double-credit.';

-- ── Atomic credit function ───────────────────────────────────────────────
-- Mirrors credit_realtor_tote_purchase (migration 114): lock the lead row,
-- check eligibility, insert the credit, bump the realtor's tote balance —
-- all under a single transaction with idempotent semantics.
CREATE OR REPLACE FUNCTION public.credit_realtor_referral(
  p_lead_id uuid
)
RETURNS TABLE (
  credit_id        uuid,
  realtor_id       uuid,
  totes_credited   int,
  already_credited boolean,
  new_balance      int,
  skipped_reason   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead     public.leads%ROWTYPE;
  v_realtor  public.profiles%ROWTYPE;
  v_existing public.realtor_referral_credits%ROWTYPE;
  v_credit   public.realtor_referral_credits%ROWTYPE;
  v_balance  int;
BEGIN
  -- Lock the lead for the duration of this call. Concurrent webhook +
  -- success-page retries serialize here.
  SELECT * INTO v_lead
    FROM public.leads
    WHERE id = p_lead_id
    FOR UPDATE;

  IF NOT FOUND THEN
    credit_id := NULL; realtor_id := NULL; totes_credited := 0;
    already_credited := false; new_balance := 0;
    skipped_reason := 'lead_not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Idempotent: if a credit row already exists for this lead, return the
  -- realtor's current balance unchanged.
  SELECT * INTO v_existing
    FROM public.realtor_referral_credits
    WHERE lead_id = p_lead_id;

  IF FOUND THEN
    SELECT realtor_tote_balance INTO v_balance
      FROM public.profiles
      WHERE id = v_existing.realtor_id;

    credit_id := v_existing.id;
    realtor_id := v_existing.realtor_id;
    totes_credited := v_existing.totes_credited;
    already_credited := true;
    new_balance := COALESCE(v_balance, 0);
    skipped_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Gate: lead must carry a realtor attribution.
  IF v_lead.referred_by_realtor_id IS NULL THEN
    credit_id := NULL; realtor_id := NULL; totes_credited := 0;
    already_credited := false; new_balance := 0;
    skipped_reason := 'no_realtor_attribution';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Gate: realtor must still exist and be marked as a realtor. We pay credit
  -- even if they un-enrolled later — they earned it — but a wiped/inactive
  -- profile shouldn't accrue a balance.
  SELECT * INTO v_realtor
    FROM public.profiles
    WHERE id = v_lead.referred_by_realtor_id;

  IF NOT FOUND OR v_realtor.is_realtor IS NOT TRUE THEN
    credit_id := NULL; realtor_id := v_lead.referred_by_realtor_id; totes_credited := 0;
    already_credited := false; new_balance := 0;
    skipped_reason := 'realtor_inactive';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Gate: deposit must actually be paid. The webhook is supposed to call us
  -- after flipping deposit_paid, but be defensive — never credit on an
  -- unbooked lead.
  IF v_lead.deposit_paid IS NOT TRUE THEN
    credit_id := NULL; realtor_id := v_realtor.id; totes_credited := 0;
    already_credited := false; new_balance := COALESCE(v_realtor.realtor_tote_balance, 0);
    skipped_reason := 'deposit_not_paid';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Insert the credit row + bump the realtor's tote balance.
  INSERT INTO public.realtor_referral_credits (lead_id, realtor_id, totes_credited)
    VALUES (p_lead_id, v_realtor.id, 5)
    RETURNING * INTO v_credit;

  UPDATE public.profiles
    SET realtor_tote_balance = realtor_tote_balance + v_credit.totes_credited
    WHERE id = v_realtor.id
    RETURNING realtor_tote_balance INTO v_balance;

  credit_id := v_credit.id;
  realtor_id := v_realtor.id;
  totes_credited := v_credit.totes_credited;
  already_credited := false;
  new_balance := v_balance;
  skipped_reason := NULL;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.credit_realtor_referral(uuid) IS
  'Atomically credits the realtor attributed to a converted lead with 5 '
  'tote-rental units. Idempotent — second call returns already_credited=true. '
  'Skips silently (with a reason string) when the lead has no realtor '
  'attribution, the realtor is no longer active, or the deposit is not yet '
  'paid. Called from the Stripe webhook (payment_intent.succeeded → deposit) '
  'and safe to call from verifyAndConfirmDeposit as a fallback.';

REVOKE ALL ON FUNCTION public.credit_realtor_referral(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_realtor_referral(uuid) TO service_role;

-- ── RLS for the credits ledger ────────────────────────────────────────────
ALTER TABLE public.realtor_referral_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtor reads own referral credits"
  ON public.realtor_referral_credits;

CREATE POLICY "realtor reads own referral credits"
  ON public.realtor_referral_credits
  FOR SELECT
  TO authenticated
  USING (realtor_id = auth.uid());

-- service_role bypasses RLS; no INSERT policy needed — credits are only
-- written by the credit_realtor_referral function which runs as
-- SECURITY DEFINER from service-role callers.
