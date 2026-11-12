// ═══════════════════════════════════════════════════════════════════════════
// The next Veterans Day, and the calendar event for it
//
// Veterans Day is November 11 every year. "Next" is the first November 11
// AFTER today, so on the day itself the page already counts down to next
// year's.
//
// Pure module — used by the countdown page, its .ics route and tests.
// ═══════════════════════════════════════════════════════════════════════════

const NOV = 10; // JS months are 0-based.

/** The year of the next November 11 strictly after `now` (in the given calendar). */
export function nextVeteransDayYear(now: Date, utc = false): number {
  const year = utc ? now.getUTCFullYear() : now.getFullYear();
  const month = utc ? now.getUTCMonth() : now.getMonth();
  const day = utc ? now.getUTCDate() : now.getDate();
  return month > NOV || (month === NOV && day >= 11) ? year + 1 : year;
}

/** Local midnight at the start of the next Veterans Day. */
export function nextVeteransDay(now: Date): Date {
  return new Date(nextVeteransDayYear(now), NOV, 11);
}

/** "Thursday, November 11, 2027" */
export function veteransDayLabel(year: number): string {
  return new Date(Date.UTC(year, NOV, 11, 12)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const PAGE_URL = "https://storage-network.app/veterans-day";

export const EVENT_TITLE = "Veterans Day: free meals & discounts for veterans";

export const EVENT_DETAILS = [
  "Thank you for your service.",
  "",
  "Every Veterans Day, restaurants and retailers across the country thank veterans and active-duty military with free meals, coffee and sweet treats, free haircuts and car washes, and military discounts.",
  "",
  "Plan your day of freebies, with directions to every stop:",
  PAGE_URL,
  "",
  "Bring proof of service: military ID, VA card, a driver's license with a veteran designation, or your DD-214.",
].join("\n");

const ymd = (year: number, day: number) => `${year}${String(NOV + 1).padStart(2, "0")}${String(day).padStart(2, "0")}`;

/** Google Calendar: all-day, repeating every November 11. */
export function googleCalendarUrl(year: number): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: EVENT_TITLE,
    dates: `${ymd(year, 11)}/${ymd(year, 12)}`,
    details: EVENT_DETAILS,
    location: PAGE_URL,
    recur: "RRULE:FREQ=YEARLY",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Outlook (outlook.com / Microsoft 365 on the web): all-day event. */
export function outlookCalendarUrl(year: number): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: EVENT_TITLE,
    startdt: `${year}-11-11`,
    enddt: `${year}-11-12`,
    allday: "true",
    body: EVENT_DETAILS,
    location: PAGE_URL,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** RFC 5545 lines are folded at 75 octets. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (bytes(rest) > 75) {
    let cut = 75;
    while (bytes(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

/**
 * An .ics file for Apple Calendar, Outlook desktop, Android and any other
 * calendar app: an all-day event on November 11 that repeats every year,
 * with a reminder at 9 AM the day before so there's time to plan.
 */
export function veteransDayIcs(year: number, stamp: Date): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Storage Network//Veterans Day//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:veterans-day-freebies@storage-network.app",
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${ymd(year, 11)}`,
    `DTEND;VALUE=DATE:${ymd(year, 12)}`,
    "RRULE:FREQ=YEARLY",
    `SUMMARY:${icsText(EVENT_TITLE)}`,
    `DESCRIPTION:${icsText(EVENT_DETAILS)}`,
    `LOCATION:${icsText(PAGE_URL)}`,
    `URL:${PAGE_URL}`,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText("Veterans Day is tomorrow. Plan your free meals and discounts: " + PAGE_URL)}`,
    "TRIGGER:-PT15H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
