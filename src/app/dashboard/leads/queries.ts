// Jobs tab queries — shared by the server page (first load) and JobsView
// (re-load after an edit) so both always show the same rows.

export const JOB_COLUMNS =
  "id, customer_name, customer_email, address, status, source, estimated_price, deposit_paid, balance_due, created_at, scheduled_at";

export const UNPAID_COLUMNS = `${JOB_COLUMNS}, viewed_at, view_count, last_step_reached`;

// Active + past jobs: deposit_paid = true (active/past), OR status is
// paid/completed (past jobs that may have skipped the deposit flow, e.g.
// unpaid quotes marked paid).
export const JOBS_OR = 'deposit_paid.eq.true,status.in.("paid","completed")';
export const JOBS_EXCLUDED = '("cancelled","archived","pending_payment","expired")';

// Unpaid quotes (pending_payment + waitlisted + recently expired, deposit not
// paid). Pending/waitlisted quotes show regardless of age; expired quotes
// only if created in the last 60 days so years of historical clutter don't
// dump into the workspace. Older rows stay in the DB — just hidden here.
export function unpaidOr(now = Date.now()): string {
  const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
  return `status.in.("pending_payment","waitlisted"),and(status.eq.expired,created_at.gte.${sixtyDaysAgo})`;
}
