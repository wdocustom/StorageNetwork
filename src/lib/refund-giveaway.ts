// ═══════════════════════════════════════════════════════════════════════════
// Holiday Full Refund Giveaway — the one place its details live.
//
// The Official Rules page (/refund-rules), the free-entry form and the line
// under the plans buy button all read from here. Fill in every `null` before
// the promotion starts: until then the rules show a highlighted
// "[placeholder]", and the form and the buy-button line stay off.
// ═══════════════════════════════════════════════════════════════════════════

export const REFUND_GIVEAWAY = {
  name: "Holiday Full Refund Giveaway",
  rulesPath: "/refund-rules",
  /** Sponsor's legal business name, e.g. "Example Storage LLC" */
  sponsorLegalName: null as string | null,
  /** e.g. "Omaha, Nebraska" */
  sponsorCityState: null as string | null,
  /** First day, YYYY-MM-DD, Central Time (starts 12:00 AM CT) */
  startDate: null as string | null,
  /** Last day, YYYY-MM-DD, Central Time (ends 11:59 PM CT) */
  endDate: null as string | null,
  /** Refund issued within this many business days of verification */
  refundBusinessDays: null as number | null,
  /** Winners notified within this many days of their drawing */
  notifyDays: null as number | null,
  /** Where free (no-purchase) entries can be emailed */
  entryEmail: "refunds@storage-network.app",
  /** Winners list requests and questions */
  contactEmail: null as string | null,
  /** Prize value, the plans price */
  prizeValue: "$19",
  timeZone: "America/Chicago",
};

/** "YYYY-MM-DD" for a moment, in Central Time (each CT day is its own drawing). */
export function centralDate(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REFUND_GIVEAWAY.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type GiveawayStatus = "unscheduled" | "upcoming" | "active" | "ended";

/** Running when today (CT) is between the start and end dates, inclusive. */
export function giveawayStatus(at: Date = new Date()): GiveawayStatus {
  const { startDate, endDate } = REFUND_GIVEAWAY;
  if (!startDate || !endDate) return "unscheduled";
  const today = centralDate(at);
  if (today < startDate) return "upcoming";
  if (today > endDate) return "ended";
  return "active";
}

/** "December 1, 2026" for a YYYY-MM-DD date. */
export function formatGiveawayDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
