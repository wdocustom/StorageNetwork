-- ═══════════════════════════════════════════════════════════════════════════
-- One-off manual fix: merge the two customer records for
-- christiane@voileandveil.com (installer 071e4146-4a6e-4df8-b753-ce5204225b39)
--
-- Not run automatically — review and run this yourself against the real
-- database. It is NOT part of the migrations/ pipeline.
--
-- Background: the first quote (lead a6d26db1..., paid, deposit_paid=true)
-- was created with no email, so its customers row
-- (a67293c3-e46d-4b14-b43f-dad789614e6b) has email=NULL. The email was
-- collected later at checkout and backfilled onto that LEAD but never onto
-- the customers row (the bug this session's code fix + migration 136
-- close going forward). A second quote (lead a2e51d99..., unpaid) then
-- came in WITH the email, couldn't match the NULL-email row, and created a
-- second customers row (de3769a9-09bb-4037-be0a-0c6a3cee3bfb) that has the
-- email but no saved card.
--
-- Fix: keep the OLDER row (a67293c3...) as canonical — it already holds
-- the Stripe customer + saved payment method. Give it the email. Repoint
-- the unpaid lead's customer_id to it. The newer row (de3769a9...) is left
-- in place but orphaned (no leads reference it) — safe to leave; delete
-- separately later if you want to tidy it up.
--
-- Run inside a transaction so you can inspect before committing.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Give the canonical (card-holding) customer row its email.
UPDATE customers
SET email = 'christiane@voileandveil.com',
    updated_at = now()
WHERE id = 'a67293c3-e46d-4b14-b43f-dad789614e6b'
  AND email IS NULL; -- guard: no-op if this has already been fixed

-- 2. Repoint the unpaid lead onto the canonical customer row, so it picks
--    up the saved card via the customer-level fallback.
UPDATE leads
SET customer_id = 'a67293c3-e46d-4b14-b43f-dad789614e6b'
WHERE id = 'a2e51d99-0107-4de4-aaab-538c66960365'
  AND customer_id = 'de3769a9-09bb-4037-be0a-0c6a3cee3bfb'; -- guard: only if still pointing at the duplicate

-- 3. Verify before committing:
select id, email, installer_id, stripe_payment_method_id
from customers
where id = 'a67293c3-e46d-4b14-b43f-dad789614e6b';

select id, customer_id, deposit_paid
from leads
where id = 'a2e51d99-0107-4de4-aaab-538c66960365';

-- If both look right (email populated, lead pointing at a67293c3...):
COMMIT;

-- If anything looks off, run ROLLBACK; instead of COMMIT;
