-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 106: Affiliate Payout Dedup + Elite Storage Systems Migration
--
-- Purpose
-- ───────
-- 1. Add a partial unique index that prevents paying the signup_bonus more
--    than once per (agreement, recruit) pair, even across Stripe webhook
--    retries spanning different invoices. The earlier idempotency index
--    on (agreement, invoice, kind) covers recurring cuts but not signup
--    bonuses, which fire once per recruit not once per invoice.
--
-- 2. Lift Joe Long's existing Elite Storage Systems arrangement out of the
--    legacy partners + referrals + calculate_partner_commission system and
--    into the new affiliate_agreements table. Backfill
--    profiles.referred_by_installer_id for every installer that came in
--    through Joe's slug so they show up in his new Affiliate Portal.
--
-- 3. Backfill is idempotent. Re-running this migration is safe.
--
-- The legacy partners + referrals tables and the calculate_partner_commission
-- function are NOT removed by this migration. They stay in place as
-- historical reference (and any UI that still reads them keeps rendering).
-- A future migration can drop them once we've verified the new system
-- produces the same numbers for at least one full billing cycle.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Signup-bonus dedup ──────────────────────────────────────────────────
-- One signup_bonus per (agreement, recruit). Recurring payouts are
-- separately deduped by the existing uniq_affiliate_payout_invoice_kind.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_affiliate_signup_bonus_per_recruit
  ON public.affiliate_payouts (agreement_id, recruit_id)
  WHERE kind = 'signup_bonus' AND recruit_id IS NOT NULL;


-- ── 2. Elite Storage Systems migration ─────────────────────────────────────
-- All work runs in a DO block so we can read intermediate values into
-- variables and gracefully skip if Joe's account isn't linked yet.

DO $$
DECLARE
  v_partner_id UUID;
  v_joe_user_id UUID;
  v_admin_user_id UUID;
  v_existing_agreement_id UUID;
  v_recruit_count INT;
BEGIN
  -- Find the Elite Storage Systems partner row (seeded in migration 025).
  SELECT id, user_id INTO v_partner_id, v_joe_user_id
  FROM public.partners
  WHERE slug = 'elite';

  IF v_partner_id IS NULL THEN
    RAISE NOTICE '[Migration 106] Elite Storage Systems partner row not found — skipping.';
    RETURN;
  END IF;

  IF v_joe_user_id IS NULL THEN
    RAISE NOTICE '[Migration 106] Elite partner has no linked user_id yet — skipping until Joe creates his account and is linked.';
    RETURN;
  END IF;

  -- Pick an admin to attribute the agreement to as `created_by`.
  -- The seed admin from migration 031 is info@wdocustom.com — fall back to
  -- any admin if that account doesn't exist.
  SELECT id INTO v_admin_user_id
  FROM public.profiles
  WHERE email = 'info@wdocustom.com' AND is_admin = true
  LIMIT 1;

  IF v_admin_user_id IS NULL THEN
    SELECT id INTO v_admin_user_id
    FROM public.profiles
    WHERE is_admin = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_admin_user_id IS NULL THEN
    RAISE NOTICE '[Migration 106] No admin profile found — cannot attribute agreement.';
    RETURN;
  END IF;

  -- Check whether Joe already has an active agreement (idempotent re-run).
  SELECT id INTO v_existing_agreement_id
  FROM public.affiliate_agreements
  WHERE affiliate_id = v_joe_user_id
    AND status IN ('active', 'proposed');

  IF v_existing_agreement_id IS NULL THEN
    -- Mirror Joe's existing arrangement exactly:
    --   Tier 1: ≤50 active recruits → $35 each
    --   Tier 2: > 50 active recruits → $25 each
    --   Lifetime, accepted now (we're representing his pre-existing handshake).
    --   Acceptance terms version 'legacy-v1' so it's distinguishable from
    --   future v1.0 acceptances from the new flow.
    INSERT INTO public.affiliate_agreements (
      affiliate_id,
      application_id,
      status,
      agreement_config,
      duration_months,
      start_date,
      end_date,
      accepted_at,
      accepted_terms_version,
      terms_markdown,
      created_by,
      terminated_at,
      terminated_reason
    ) VALUES (
      v_joe_user_id,
      NULL,                                       -- predates the application flow
      'active',
      jsonb_build_object(
        'type', 'tiered',
        'basis', 'per_active_recruit_per_month',
        'tiers', jsonb_build_array(
          jsonb_build_object('max_active', 50, 'amount_cents', 3500),
          jsonb_build_object('max_active', NULL, 'amount_cents', 2500)
        )
      ),
      NULL,                                       -- lifetime
      NOW(),                                      -- start_date = now
      NULL,                                       -- end_date = NULL (lifetime)
      NOW(),                                      -- accepted_at = now (representing the existing handshake)
      'legacy-v1',
      '# Elite Storage Systems Affiliate Agreement (Migrated)' || E'\n\n' ||
        'This agreement was migrated from the platform''s prior partner arrangement on ' ||
        TO_CHAR(NOW(), 'Mon DD, YYYY') || '. ' ||
        'Terms preserved as originally agreed:' || E'\n\n' ||
        '- Tier 1: Up to 50 active subscribed recruits earn **$35/month** each.' || E'\n' ||
        '- Tier 2: Beyond 50 active subscribed recruits the rate becomes **$25/month** for all recruits in that billing period.' || E'\n' ||
        '- Term: lifetime, beginning at migration date.' || E'\n' ||
        '- Either party may terminate with reasonable notice.',
      v_admin_user_id,
      NULL,
      NULL
    );
    RAISE NOTICE '[Migration 106] Inserted Elite agreement for affiliate %', v_joe_user_id;
  ELSE
    RAISE NOTICE '[Migration 106] Elite already has agreement % — skipping insert.', v_existing_agreement_id;
  END IF;

  -- Backfill profiles.referred_by_installer_id for every installer who came
  -- in through Joe's slug. Only update rows that don't already have a value
  -- so we never clobber a more-recent attribution from the new email-invite
  -- flow (Phase 6).
  UPDATE public.profiles AS p
  SET referred_by_installer_id = v_joe_user_id
  FROM public.referrals AS r
  WHERE r.installer_id = p.id
    AND r.partner_id = v_partner_id
    AND p.referred_by_installer_id IS NULL
    AND p.id != v_joe_user_id;  -- never self-refer

  GET DIAGNOSTICS v_recruit_count = ROW_COUNT;
  RAISE NOTICE '[Migration 106] Backfilled % recruits → referred_by_installer_id = %', v_recruit_count, v_joe_user_id;

END $$;


-- ── 3. Cleanup verification (commented-out helper queries) ─────────────────
-- Run these manually after migration to verify state:
--
-- SELECT a.* FROM affiliate_agreements a
--   JOIN profiles p ON p.id = a.affiliate_id
--   WHERE p.business_name ILIKE '%elite%' OR p.email = 'joe@elitestorage.com';
--
-- SELECT COUNT(*) FROM profiles WHERE referred_by_installer_id IS NOT NULL;
--
-- The legacy partners + referrals tables stay intact for now:
--
-- SELECT * FROM partners WHERE slug = 'elite';
-- SELECT COUNT(*) FROM referrals WHERE partner_id = (SELECT id FROM partners WHERE slug = 'elite');
