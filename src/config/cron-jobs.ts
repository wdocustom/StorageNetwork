// ═══════════════════════════════════════════════════════════════════════════
// Scheduled jobs — single source of truth.
//
// Cloudflare: cloudflare/worker.ts runs every job whose schedule matches the
// firing cron trigger. wrangler.jsonc "triggers.crons" must list each
// distinct schedule below (src/config/cron-jobs.test.ts checks this, and
// that vercel.json no longer schedules any job).
//
// Schedules are UTC, standard 5-field cron.
// ═══════════════════════════════════════════════════════════════════════════

export interface CronJob {
  path: string;
  schedule: string;
}

export const CRON_JOBS: CronJob[] = [
  { path: "/api/cron/abandoned-cart", schedule: "0 9 * * *" },
  { path: "/api/cron/onboarding-drip", schedule: "0 10 * * *" },
  { path: "/api/cron/prewarm", schedule: "0 0 * * *" },
  { path: "/api/cron/cleanout-upsell", schedule: "0 8 * * *" },
  { path: "/api/cron/feature-announcement", schedule: "0 11 * * *" },
  { path: "/api/cron/bounty-announcement", schedule: "0 14 * * *" },
  { path: "/api/cron/overhead-announcement", schedule: "0 15 * * *" },
  { path: "/api/cron/jig-announcement", schedule: "0 7 * * *" },
  { path: "/api/cron/feedback-call-invite", schedule: "0 16 * * *" },
  { path: "/api/cron/inventory-announcement", schedule: "0 13 * * *" },
  { path: "/api/cron/tote-rental-announcement", schedule: "0 12 * * *" },
  { path: "/api/cron/review-announcement", schedule: "0 17 * * *" },
  { path: "/api/cron/chatbot-announcement", schedule: "0 18 * * *" },
  { path: "/api/cron/send-contractor-agreements", schedule: "0 19 * * *" },
  { path: "/api/cron/weekly-digest", schedule: "0 9 * * 1" },
  { path: "/api/cron/waitlist-activation", schedule: "0 6 * * *" },
  { path: "/api/cron/install-reminders", schedule: "0 14 * * *" },
  { path: "/api/cron/indexnow", schedule: "0 13 * * *" },
];

export function jobsForSchedule(cron: string): CronJob[] {
  return CRON_JOBS.filter((j) => j.schedule === cron);
}
