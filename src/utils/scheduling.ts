// ═══════════════════════════════════════════════════════════════════════════
// Scheduling Engine — Capacity-Based Date Availability
//
// Weight System:
//   Small Unit (totalCols < 5)  → 1 point
//   Large Unit (totalCols >= 5) → 3 points
//   Max 3 points per installer per day
//
// Wheel Rule:
//   If hasWheels → minimum 3 business day lead time (for sourcing casters)
//   Standard     → installer's configured lead_time_days (default 1)
//
// ═══════════════════════════════════════════════════════════════════════════

export interface SchedulingConfig {
  totalCols: number;
  hasWheels: boolean;
}

export interface InstallerSchedule {
  leadTimeDays: number;
  workingDays: string[];
  maxDailyCapacity: number;
}

export interface ExistingJob {
  scheduled_at: string; // ISO date
  weight: number;
}

// ── Weight Calculation ────────────────────────────────────────────────────

export function calculateWeight(totalCols: number): number {
  return totalCols >= 5 ? 3 : 1;
}

// ── Lead Time (Wheel Rule) ────────────────────────────────────────────────

const WHEEL_LEAD_TIME = 3; // 3 business days for caster sourcing

export function getEffectiveLeadTime(
  installerLeadTime: number,
  hasWheels: boolean
): number {
  return hasWheels
    ? Math.max(installerLeadTime, WHEEL_LEAD_TIME)
    : installerLeadTime;
}

// ── Working Day Helpers ───────────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function isWorkingDay(date: Date, workingDayIndices: Set<number>): boolean {
  return workingDayIndices.has(date.getDay());
}

function toWorkingDaySet(workingDays: string[]): Set<number> {
  return new Set(workingDays.map((d) => DAY_MAP[d] ?? -1).filter((n) => n >= 0));
}

/**
 * Advance `n` business days from a start date.
 * Only counts days that fall on working days.
 */
export function addBusinessDays(
  start: Date,
  days: number,
  workingDays: string[]
): Date {
  const wdSet = toWorkingDaySet(workingDays);
  const result = new Date(start);
  let added = 0;

  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isWorkingDay(result, wdSet)) {
      added++;
    }
  }

  return result;
}

// ── Date String Helpers ───────────────────────────────────────────────────

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Capacity Check ────────────────────────────────────────────────────────

/**
 * Get the total weight already booked for a specific date.
 */
export function getDateWeight(dateStr: string, existingJobs: ExistingJob[]): number {
  return existingJobs
    .filter((j) => j.scheduled_at.startsWith(dateStr))
    .reduce((sum, j) => sum + (j.weight || 1), 0);
}

/**
 * Check if a specific date is available for a job of a given weight.
 */
export function isDateAvailable(
  dateStr: string,
  jobWeight: number,
  installer: InstallerSchedule,
  existingJobs: ExistingJob[],
  config: SchedulingConfig
): boolean {
  const date = parseDateStr(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Must be a working day
  const wdSet = toWorkingDaySet(installer.workingDays);
  if (!isWorkingDay(date, wdSet)) return false;

  // Must be past lead time (including wheel rule)
  const effectiveLeadTime = getEffectiveLeadTime(
    installer.leadTimeDays,
    config.hasWheels
  );
  const earliest = addBusinessDays(today, effectiveLeadTime, installer.workingDays);
  earliest.setHours(0, 0, 0, 0);

  if (date < earliest) return false;

  // Capacity check: existing weight + new job weight <= max
  const currentWeight = getDateWeight(dateStr, existingJobs);
  const maxCapacity = installer.maxDailyCapacity || 3;
  if (currentWeight + jobWeight > maxCapacity) return false;

  return true;
}

/**
 * Get the first available date for a job.
 * Scans up to 60 days ahead.
 */
export function getFirstAvailableDate(
  installer: InstallerSchedule,
  existingJobs: ExistingJob[],
  config: SchedulingConfig
): string | null {
  const jobWeight = calculateWeight(config.totalCols);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const effectiveLeadTime = getEffectiveLeadTime(
    installer.leadTimeDays,
    config.hasWheels
  );
  const start = addBusinessDays(today, effectiveLeadTime, installer.workingDays);

  for (let i = 0; i < 60; i++) {
    const candidate = new Date(start);
    candidate.setDate(candidate.getDate() + i);
    const ds = toDateStr(candidate);

    if (isDateAvailable(ds, jobWeight, installer, existingJobs, config)) {
      return ds;
    }
  }

  return null;
}
