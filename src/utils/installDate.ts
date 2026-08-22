// ═══════════════════════════════════════════════════════════════════════════
// Install Date Helpers
//
// `leads.scheduled_at` is a timestamptz, but the value it carries is a
// *calendar date*: every writer (submit-lead, payments, scheduleJob) stores a
// bare "YYYY-MM-DD", which Postgres widens to midnight UTC, and every reader
// that does capacity math keys off that UTC date prefix
// (`scheduled_at.startsWith(dateStr)` in utils/scheduling + AvailabilityManager).
//
// Rendering it with `new Date(iso).toLocaleDateString()` re-interprets midnight
// UTC in the viewer's zone, so anyone west of UTC sees the *previous* day — an
// installer in DC who picks Tue 8/25 gets "Mon, Aug 24" on their dashboard
// while the confirmation email (rendered server-side in UTC) says Aug 25.
//
// These helpers keep the whole app on the one interpretation that matches how
// the date is stored and queried: the UTC calendar date.
// ═══════════════════════════════════════════════════════════════════════════

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Reduce a stored `scheduled_at` (bare date or ISO timestamp) to its calendar
 * date, "YYYY-MM-DD". Returns null for empty/unparseable values.
 */
export function toInstallDateKey(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "TBD") return null;

  // Bare dates and UTC timestamps: the date is already the first 10 chars.
  if (DATE_KEY.test(trimmed)) {
    if (!trimmed.includes("T")) return trimmed.slice(0, 10);
    // Timestamp with a non-UTC offset — normalize through UTC so the key still
    // matches what the capacity queries compare against.
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return trimmed.slice(0, 10);
    return parsed.toISOString().slice(0, 10);
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/**
 * True when two stored `scheduled_at` values (or a stored value and a
 * "YYYY-MM-DD" the installer just picked) land on the same install day.
 */
export function isSameInstallDate(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const keyA = toInstallDateKey(a);
  const keyB = toInstallDateKey(b);
  return keyA !== null && keyA === keyB;
}

const DEFAULT_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

/**
 * Format a stored `scheduled_at` as the calendar date that was picked,
 * independent of the viewer's timezone. Returns `fallback` when there's no
 * usable date.
 */
export function formatInstallDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_FORMAT,
  fallback = "TBD"
): string {
  const key = toInstallDateKey(value);
  if (!key) return fallback;

  const [year, month, day] = key.split("-").map(Number);
  // Build the date in local time so toLocaleDateString reports these exact
  // Y/M/D parts back rather than shifting them across a zone boundary.
  return new Date(year, month - 1, day).toLocaleDateString("en-US", options);
}

/**
 * Today's date as a "YYYY-MM-DD" install-date key, in the *viewer's* timezone.
 *
 * Used for the `min` on the install-date pickers. `new Date().toISOString()`
 * would answer in UTC, so an installer in the US evening (already past
 * midnight UTC) had today greyed out of their own date picker.
 */
export function todayInstallDateKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
