import { toInstallDateKey } from "@/utils/installDate";

// ═══════════════════════════════════════════════════════════════════════════
// Install day as a calendar event — for the "Installation Scheduled" and
// "install is tomorrow" emails.
//
//   • .ics invite (METHOD:REQUEST) attached to the email. Gmail turns it into
//     the event card at the top of the message (and Apple Mail / Outlook show
//     their own "Add to calendar"). Same UID per lead with a rising SEQUENCE,
//     so a reschedule moves the event instead of adding a second one.
//   • Google Calendar / Outlook links for the buttons next to the date.
//
// All-day event on the stored calendar date (see utils/installDate) — the
// installer's arrival time isn't fixed, and an all-day event can't land on
// the wrong day in the customer's time zone.
// ═══════════════════════════════════════════════════════════════════════════

export interface InstallEventInput {
  leadId: string;
  /** Stored scheduled_at, bare "YYYY-MM-DD" or ISO */
  date: string;
  installerName?: string;
  /** "morning" | "afternoon" | anything else (ignored) */
  timePreference?: string | null;
  address?: string;
  /** Track-your-install page */
  trackUrl?: string;
}

export interface InstallEvent {
  title: string;
  description: string;
  location: string;
  /** YYYYMMDD start (inclusive) and end (exclusive) */
  start: string;
  end: string;
  uid: string;
  url?: string;
}

const compact = (key: string) => key.replace(/-/g, "");

function nextDay(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Null when the date isn't a real calendar date (e.g. "TBD"). */
export function installEvent(input: InstallEventInput): InstallEvent | null {
  const key = toInstallDateKey(input.date);
  if (!key) return null;
  const who = input.installerName?.trim();
  const slot = input.timePreference === "morning" || input.timePreference === "afternoon" ? ` (${input.timePreference})` : "";
  const lines = [
    who ? `${who} is installing your storage rack.` : "Your storage rack is being installed.",
    slot ? `Arrival: ${input.timePreference}. Your installer will confirm the exact time.` : "Your installer will reach out with arrival timing.",
    "Please clear the wall and floor where the rack is going.",
    input.trackUrl ? `Track your install: ${input.trackUrl}` : "",
  ].filter(Boolean);
  return {
    title: `Storage rack install${who ? ` — ${who}` : ""}${slot}`,
    description: lines.join("\n"),
    location: input.address?.trim() || "",
    start: compact(key),
    end: compact(nextDay(key)),
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
  const iso = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const q = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: iso(e.start),
    enddt: iso(e.end),
    allday: "true",
    body: e.description,
  });
  if (e.location) q.set("location", e.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q}`;
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
    `DTSTART;VALUE=DATE:${e.start}`,
    `DTEND;VALUE=DATE:${e.end}`,
    `SUMMARY:${icsText(e.title)}`,
    `DESCRIPTION:${icsText(e.description)}`,
    e.location ? `LOCATION:${icsText(e.location)}` : "",
    e.url ? `URL:${e.url}` : "",
    opts.organizer ? `ORGANIZER;CN=${cn(opts.organizer.name)}:mailto:${opts.organizer.email}` : "",
    opts.attendee
      ? `ATTENDEE;${opts.attendee.name ? `CN=${cn(opts.attendee.name)};` : ""}ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${opts.attendee.email}`
      : "",
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    // 6 PM the evening before
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(e.title)}`,
    "TRIGGER:-PT6H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ── Email pieces ──────────────────────────────────────────────────────────

/** Small "Add to calendar" button row for under the date. */
export function addToCalendarHtml(e: InstallEvent, icsUrl?: string): string {
  const btn = (href: string, label: string) =>
    `<a href="${href.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" target="_blank" style="display:inline-block;margin:4px;padding:8px 14px;border:1px solid #3f3f46;border-radius:999px;color:#ffffff;font-size:12px;font-weight:700;text-decoration:none;">${label}</a>`;
  return `
    <p style="margin:14px 0 4px;color:#a3a3a3;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Add to calendar</p>
    <div>
      ${btn(googleCalendarUrl(e), "Google")}
      ${icsUrl ? btn(icsUrl, "Apple") : ""}
      ${btn(outlookCalendarUrl(e), "Outlook")}
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
