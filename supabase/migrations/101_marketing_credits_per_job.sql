-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 101: Award 10 marketing_credits per completed job
--
-- Extends the existing fn_increment_job_score() trigger so that whenever a
-- lead transitions to status='paid', the installer also receives +10
-- marketing_credits (used by the AI Asset Forge generator). The trigger
-- already runs on the same row update that bumps completed_jobs; we just
-- piggy-back the credit grant in the same UPDATE statement.
--
-- Then backfills every existing installer's balance to:
--   10 (initial)  +  10 * (their lifetime paid leads)
-- so a long-tenured installer with 7 paid jobs starts at 80 credits.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Replace the trigger function (preserves existing trg_job_score_on_paid)
CREATE OR REPLACE FUNCTION fn_increment_job_score()
RETURNS trigger AS $$
BEGIN
  -- Only fire when status transitions TO 'paid' for the first time
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    UPDATE profiles
    SET
      completed_jobs    = COALESCE(completed_jobs, 0) + 1,
      job_score         = COALESCE(job_score, 0) + 1,
      marketing_credits = COALESCE(marketing_credits, 0) + 10,
      tier              = CASE
                            WHEN COALESCE(job_score, 0) + 1 > 10 THEN 'pro'
                            ELSE COALESCE(tier, 'rookie')
                          END
    WHERE id = NEW.installer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 2. One-time backfill: align every installer's balance to formula.
-- Counts paid leads directly (the source of truth) rather than
-- profiles.completed_jobs, which can drift.
UPDATE profiles p
   SET marketing_credits = 10 + 10 * (
     SELECT COUNT(*)
       FROM leads l
      WHERE l.installer_id = p.id
        AND l.status = 'paid'
   );
