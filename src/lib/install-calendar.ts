import { toInstallDateKey } from "@/utils/installDate";

// ═══════════════════════════════════════════════════════════════════════════
// Install day as a calendar event — for the "Installation Scheduled" and
// "install is tomorrow" emails.
//
//   • .ics invite (METHOD:REQUEST) attached to the email. Gmail turns it into
//     the event card at the top of the message (and Apple Mail / Outlook show
//     their own "Add to calendar"). Same UID per lead with a rising SEQUENCE,
//     so a reschedule moves the event instead of adding a second one.
//   • One "Add to calendar" button next to the date. It opens
//     /api/calendar/<token>, which sends the customer to the calendar they
//     use (see pickCalendar).
//
// The event is a block, not the whole day: morning 9:00–12:00, afternoon
// 12:01–4:00, 9:00–4:00 when no window was picked. Times are the install
// address's local time — converted to UTC when the state tells us the zone,
// otherwise left "floating" (the customer's own device time, which for a
// local install is the same thing).
// ═══════════════════════════════════════════════════════════════════════════

export interface InstallEventInput {
  leadId: string;
  /** Stored scheduled_at, bare "YYYY-MM-DD" or ISO */
  date: string;
  installerName?: string;
  /** "morning" | "afternoon" | anything else (no window picked) */
  timePreference?: string | null;
  address?: string;
  /** Track-your-install page */
  trackUrl?: string;
}

export interface InstallEvent {
  title: string;
  description: string;
  location: string;
  /** "YYYYMMDDTHHMMSSZ" (UTC) or "YYYYMMDDTHHMMSS" (floating local time) */
  start: string;
  end: string;
  uid: string;
  url?: string;
}

const SLOTS: Record<string, [string, string]> = {
  morning: ["09:00", "12:00"],
  afternoon: ["12:01", "16:00"],
  any: ["09:00", "16:00"],
};

// ── Time zone from the install address ────────────────────────────────────

const ZONES: Record<string, string> = {};
const assign = (zone: string, states: string) => states.split(" ").forEach((s) => (ZONES[s] = zone));
assign("America/New_York", "CT DE DC FL GA IN KY ME MD MA MI NH NJ NY NC OH PA RI SC VT VA WV");
assign("America/Chicago", "AL AR IL IA KS LA MN MS MO NE ND OK SD TN TX WI");
assign("America/Denver", "CO ID MT NM UT WY");
assign("America/Phoenix", "AZ");
assign("America/Los_Angeles", "CA NV OR WA");
assign("America/Anchorage", "AK");
assign("Pacific/Honolulu", "HI");

const STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

/** IANA zone for "…, Columbus, OH 43215" style addresses; null if no state found. */
export function zoneForAddress(address: string | undefined): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts.slice(1).reverse()) {
    const abbr = /^([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/.exec(part)?.[1]?.toUpperCase();
    if (abbr && ZONES[abbr]) return ZONES[abbr];
    const name = STATE_NAMES[part.replace(/\s+\d{5}(?:-\d{4})?$/, "").toLowerCase()];
    if (name) return ZONES[name];
  }
  return null;
}

/** UTC ms for a wall-clock time in `zone`. */
function zonedToUtc(key: string, hhmm: string, zone: string): number {
  const [y, mo, d] = key.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const offset = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .formatToParts(t)
        .map((x) => [x.type, x.value])
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
  };
  // Two passes settle the offset across a DST change.
  let t = wall - offset(wall);
  t = wall - offset(t);
  return t;
}

function stampTime(key: string, hhmm: string, zone: string | null): string {
  if (zone) return new Date(zonedToUtc(key, hhmm, zone)).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return `${key.replace(/-/g, "")}T${hhmm.replace(":", "")}00`;
}

/** Null when the date isn't a real calendar date (e.g. "TBD"). */
export function installEvent(input: InstallEventInput): InstallEvent | null {
  const key = toInstallDateKey(input.date);
  if (!key) return null;
  const who = input.installerName?.trim();
  const windowPicked = input.timePreference === "morning" || input.timePreference === "afternoon";
  const [from, to] = SLOTS[windowPicked ? input.timePreference! : "any"];
  const zone = zoneForAddress(input.address);
  const lines = [
    who ? `${who} is installing your storage rack.` : "Your storage rack is being installed.",
    windowPicked
      ? `Arrival window: ${input.timePreference}. Your installer will confirm the exact time.`
      : "Your installer will reach out with arrival timing.",
    "Please clear the wall and floor where the rack is going.",
    input.trackUrl ? `Track your install: ${input.trackUrl}` : "",
  ].filter(Boolean);
  return {
    title: `Storage rack install${who ? ` — ${who}` : ""}`,
    description: lines.join("\n"),
    location: input.address?.trim() || "",
    start: stampTime(key, from, zone),
    end: stampTime(key, to, zone),
    uid: `install-${input.leadId}@storage-network.app`,
    url: input.trackUrl,
  };
}

export function googleCalendarUrl(e: InstallEvent): string {
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${e.start}/${e.end}`, details: e.description });
  if (e.location) q.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function outlookCalendarUrl(e: InstallEvent): string {
  // 20261113T140000Z → 2026-11-13T14:00:00Z (floating stays offset-less)
  const iso = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}${s.endsWith("Z") ? "Z" : ""}`;
  const q = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: iso(e.start),
    enddt: iso(e.end),
    body: e.description,
  });
  if (e.location) q.set("location", e.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q}`;
}

// ── Which calendar to open ────────────────────────────────────────────────

export type CalendarKind = "google" | "outlook" | "ics";

const GOOGLE_DOMAINS = ["gmail.com", "googlemail.com"];
const OUTLOOK_DOMAINS = ["outlook.com", "hotmail.com", "live.com", "msn.com", "passport.com"];
const APPLE_DOMAINS = ["icloud.com", "me.com", "mac.com"];

/**
 * Pick the customer's calendar: their email provider first (a Gmail address
 * almost always means Google Calendar), then the device (Apple devices open
 * a .ics in Calendar, Android means Google). Anything else gets the .ics,
 * which the OS hands to its default calendar app.
 */
export function pickCalendar(email: string | null | undefined, userAgent: string | null | undefined): CalendarKind {
  const domain = email?.split("@")[1]?.trim().toLowerCase() ?? "";
  if (GOOGLE_DOMAINS.includes(domain)) return "google";
  if (OUTLOOK_DOMAINS.some((d) => domain === d || domain.startsWith(d.split(".")[0] + "."))) return "outlook";
  if (APPLE_DOMAINS.includes(domain)) return "ics";
  const ua = userAgent ?? "";
  if (/iPhone|iPad|iPod|Macintosh/i.test(ua)) return "ics";
  if (/Android|CrOS/i.test(ua)) return "google";
  return "ics";
}

// ── iCalendar (RFC 5545) ──────────────────────────────────────────────────

function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold to 75 octets per line, never splitting a UTF-8 character. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export interface IcsOptions {
  /** REQUEST for the emailed invite (Gmail's event card); PUBLISH for a downloaded file. */
  method: "REQUEST" | "PUBLISH";
  organizer?: { name: string; email: string };
  attendee?: { name?: string; email: string };
  now?: Date;
}

export function installIcs(e: InstallEvent, opts: IcsOptions): string {
  const now = opts.now ?? new Date();
  // Rises with every send, so a reschedule replaces the earlier event.
  const sequence = Math.max(0, Math.floor((now.getTime() - Date.UTC(2024, 0, 1)) / 1000));
  const cn = (name: string) => `"${name.replace(/"/g, "'")}"`;
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Storage Network//Install//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `SEQUENCE:${sequence}`,
    `DTSTART:${e.start}`,
    `DTEND:${e.end}`,
    `SUMMARY:${icsText(e.title)}`,
    `DESCRIPTION:${icsText(e.description)}`,
    e.location ? `LOCATION:${icsText(e.location)}` : "",
    e.url ? `URL:${e.url}` : "",
    opts.organizer ? `ORGANIZER;CN=${cn(opts.organizer.name)}:mailto:${opts.organizer.email}` : "",
    opts.attendee
      ? `ATTENDEE;${opts.attendee.name ? `CN=${cn(opts.attendee.name)};` : ""}ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${opts.attendee.email}`
      : "",
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    // The evening before (15 hours ahead of a 9 AM start)
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(e.title)}`,
    "TRIGGER:-PT15H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ── Email pieces ──────────────────────────────────────────────────────────

/** The "Add to calendar" button for under the date. */
export function addToCalendarHtml(addUrl: string): string {
  const href = addUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `
    <div style="margin:16px 0 0;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:10px 20px;border:1px solid #facc15;border-radius:999px;color:#facc15;font-size:13px;font-weight:700;text-decoration:none;">&#128197;&nbsp; Add to calendar</a>
    </div>`;
}

/** Resend attachment for the invite. */
export function icsAttachment(ics: string) {
  return {
    filename: "invite.ics",
    content: Buffer.from(ics, "utf8"),
    content_type: "text/calendar; charset=UTF-8; method=REQUEST",
  };
}
