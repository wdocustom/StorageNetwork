// ═══════════════════════════════════════════════════════════════════════════
// Install slot rules — server-side mirror of NativeScheduler
//
// The customer picks a date on the calendar (components/booking/
// NativeScheduler), but the pick is re-checked here before it's saved, with
// the same rules the calendar applies:
//   • on or after today + lead time (3 days minimum when wheels are ordered,
//     same as BookingModal's caster rule)
//   • on one of the installer's working days
//   • not inside a blackout range
//   • the chosen block (morning/afternoon) not switched off for that date
// Pure — no I/O — so it can be unit-tested.
// ═══════════════════════════════════════════════════════════════════════════

export type TimeBlock = "morning" | "afternoon";

export interface SlotRules {
  leadTimeDays: number;
  workingDays: string[]; // ["Mon", "Tue", …]
  blackouts: Array<{ start_date: string; end_date: string }>;
  blocks: Record<string, { morning: boolean; afternoon: boolean }>;
  hasWheels?: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Furthest ahead a customer can book. */
export const MAX_BOOKING_DAYS = 180;
/** A booked date can be changed by the customer until this long before it. */
export const CHANGE_CUTOFF_HOURS = 48;

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function effectiveLeadTime(rules: Pick<SlotRules, "leadTimeDays" | "hasWheels">): number {
  const base = Math.max(0, rules.leadTimeDays || 0);
  return rules.hasWheels ? Math.max(base, 3) : base;
}

/**
 * Is `date` (+ optional `time`) bookable? `today` is the customer's calendar
 * date (YYYY-MM-DD); the server passes a day of slack for time zones.
 */
export function checkSlot(
  date: string,
  time: TimeBlock | null | undefined,
  rules: SlotRules,
  today: string
): { ok: true } | { ok: false; error: string } {
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
    return { ok: false, error: "Please pick a valid date." };
  }
  if (date < addDays(today, effectiveLeadTime(rules))) {
    return { ok: false, error: "That date is too soon. Please pick a later date." };
  }
  if (date > addDays(today, MAX_BOOKING_DAYS)) {
    return { ok: false, error: "That date is too far out. Please pick an earlier date." };
  }
  const weekday = DAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()];
  if (!rules.workingDays.includes(weekday)) {
    return { ok: false, error: "Your installer doesn't work that day. Please pick another date." };
  }
  if (rules.blackouts.some((r) => date >= r.start_date && date <= r.end_date)) {
    return { ok: false, error: "Your installer isn't available that date. Please pick another." };
  }
  const blocks = rules.blocks[date];
  if (blocks) {
    if (!blocks.morning && !blocks.afternoon) {
      return { ok: false, error: "That date is fully booked. Please pick another." };
    }
    if (time && !blocks[time]) {
      return { ok: false, error: `The ${time} isn't available that day. Please pick the other time or another date.` };
    }
  }
  return { ok: true };
}

/** Can the customer still change an already-booked date? */
export function canCustomerChange(scheduledAt: string | null, now: Date): boolean {
  if (!scheduledAt) return true;
  const date = scheduledAt.slice(0, 10);
  // Treat the install as starting at 8am UTC-ish on the day: generous enough
  // that "48 hours before" never lets a same-week change slip through late.
  const start = new Date(`${date}T08:00:00Z`).getTime();
  return start - now.getTime() >= CHANGE_CUTOFF_HOURS * 60 * 60 * 1000;
}
