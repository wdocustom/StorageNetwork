-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 136: Backfill customers.email from linked leads (non-conflicting only)
--
-- customers.email is nullable (a quote can be created with no email — a
-- guest/phone-only lead, see migration 048). If that email only became
-- known later (e.g. collected at checkout), nothing previously wrote it
-- back onto the customers row, so customers.email stayed NULL forever.
-- That silently breaks cross-quote card reuse for that person: a LATER
-- quote WITH the email can never match this row (NULL != any string in
-- SQL) and creates a duplicate customers row instead of reusing it —
-- exactly what happened for the customer this migration was written for.
--
-- Backfill each NULL-email customers row from the most recent lead
-- referencing it that has a customer_email on file — but ONLY when no
-- OTHER customers row for the same installer already owns that exact
-- email. Where a conflict already exists (an already-diverged duplicate —
-- two separate customers rows for the same person), this migration
-- deliberately leaves both alone; that needs a reviewed, manual merge,
-- not a blind automatic one. See src/app/actions/payments.ts's
-- backfillCustomerEmailIfMissing() for the same logic applied going
-- forward on every new deposit.
-- ═══════════════════════════════════════════════════════════════════════════

WITH latest_lead_email AS (
  SELECT DISTINCT ON (customer_id)
    customer_id,
    customer_email
  FROM public.leads
  WHERE customer_id IS NOT NULL
    AND customer_email IS NOT NULL
  ORDER BY customer_id, updated_at DESC
),
candidates AS (
  SELECT c.id, c.installer_id, lle.customer_email AS candidate_email
  FROM public.customers c
  JOIN latest_lead_email lle ON lle.customer_id = c.id
  WHERE c.email IS NULL
)
UPDATE public.customers c
SET email = cand.candidate_email
FROM candidates cand
WHERE c.id = cand.id
  AND NOT EXISTS (
    SELECT 1 FROM public.customers other
    WHERE other.email = cand.candidate_email
      AND other.installer_id = cand.installer_id
      AND other.id <> cand.id
  );
