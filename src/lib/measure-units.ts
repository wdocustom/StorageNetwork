// ═══════════════════════════════════════════════════════════════════════════
// Imperial / metric for the DIY build plans, 3D guide and PDF
//
// Plans are designed and stored in inches, and every measurement reaches the
// screen as text a builder reads: 69-1/4", 3/4" plywood, 2×4×8', 8 ft studs.
// Rather than reformat each of those at its source, metricText() rewrites the
// measurements inside any such text:
//
//   inches              → millimetres          69-1/4"  → 1759 mm
//   feet + inches       → millimetres          8' 6"    → 2591 mm
//   feet alone (stock)  → metres               8 ft, 8' → 2.44 m
//
// Store-bought items keep the size printed on the box: with { keep: true }
// the original follows in brackets (19 mm (3/4") plywood).
//
// The choice is per device (localStorage) and shared live by every place
// that shows it — flip it in the 3D guide and the plan page follows.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useSyncExternalStore } from "react";

export type Units = "imperial" | "metric";

const KEY = "sn_units";
const MM_PER_IN = 25.4;

// A number of inches as written: 34, 34.5, 34-1/2, 34 1/2, 1/2
const INCH_NUM = String.raw`(?:\d+(?:\.\d+)?(?:[- ]\d+\/\d+)?|\d+\/\d+)`;
const INCH_MARK = `(?:"|″|”)`;

function inchValue(text: string): number {
  const t = text.trim();
  const mixed = /^(\d+(?:\.\d+)?)[- ](\d+)\/(\d+)$/.exec(t);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(t);
}

export function formatMm(inches: number): string {
  return `${Math.round(inches * MM_PER_IN)} mm`;
}

function formatM(feet: number): string {
  return `${((feet * 12 * MM_PER_IN) / 1000).toFixed(2)} m`;
}

/** A length in inches, in the chosen units: 34.5 → `34-1/2"` or `876 mm`. */
export function formatLengthIn(inches: number, units: Units): string {
  if (units === "metric") return formatMm(inches);
  const whole = Math.floor(inches);
  const sixteenths = Math.round((inches - whole) * 16);
  if (sixteenths === 0) return `${whole}"`;
  if (sixteenths === 16) return `${whole + 1}"`;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(sixteenths, 16);
  const frac = `${sixteenths / d}/${16 / d}`;
  return whole === 0 ? `${frac}"` : `${whole}-${frac}"`;
}

/**
 * Rewrite the imperial measurements inside `text` as metric. Text without
 * any is returned unchanged; numbers that aren't lengths (counts, 2×4) stay.
 */
export function metricText(text: string, opts: { keep?: boolean } = {}): string {
  if (!text) return text;
  // The kept original is written "3/4 in", which this never reads, so
  // converting the result again (the PDF does) changes nothing.
  const out = (metric: string, original: string) =>
    opts.keep ? `${metric} (${original.trim().replace(/\s?["″”]/g, " in")})` : metric;
  // One pass, so nothing written here is converted twice.
  return text.replace(MEASURE_RE, (m, lumber?: string, lumberFt?: string, ft1?: string, in1?: string, ra?: string, rb?: string, in2?: string, ft2?: string) => {
    if (lumber !== undefined && lumberFt !== undefined) return `${lumber} (${formatM(Number(lumberFt))})`;
    if (ft1 !== undefined && in1 !== undefined) return out(formatMm(Number(ft1) * 12 + inchValue(in1)), m);
    if (ra !== undefined && rb !== undefined)
      return out(`${Math.round(inchValue(ra) * MM_PER_IN)}–${Math.round(inchValue(rb) * MM_PER_IN)} mm`, m);
    if (in2 !== undefined) return out(formatMm(inchValue(in2)), m);
    if (ft2 !== undefined) return out(formatM(Number(ft2)), m);
    return m;
  });
}

const MEASURE_RE = new RegExp(
  [
    // Lumber stock: 2×4×8' → 2×4 (2.44 m)
    String.raw`(?<![\d.])(\d+\s*[×x]\s*\d+)\s*[×x]\s*(\d+)\s?(?:'|′|’|ft\b\.?)`,
    // Feet and inches: 8' 6", 2'-6", 8 ft 6 in
    String.raw`(?<![\d.])(\d+)\s*(?:'|′|’|ft\.?|feet)\s*-?\s*(${INCH_NUM})\s*(?:${INCH_MARK}|in\.?(?![a-z])|inches\b)`,
    // Inch ranges: 12–16"
    String.raw`(?<![\d/.])(${INCH_NUM})\s*[–—]\s*(${INCH_NUM})${INCH_MARK}`,
    // Inches: 69-1/4", 3/4", 30", 1.5", 8-inch, 30 inches, 30 in.
    String.raw`(?<![\d/.])(${INCH_NUM})\s?(?:${INCH_MARK}|-?inch(?:es)?\b|in\.(?=\s|$))`,
    // Feet alone (lumber stock): 8 ft, 8-ft, 8 feet, 2×4×8'
    String.raw`(?<![\d.])(\d+(?:\.\d+)?)\s?-?(?:ft\b\.?|feet\b|foot\b|'|′|’)(?![a-z])`,
  ].join("|"),
  "gi",
);

// ── The shared setting ──────────────────────────────────────────────────────

const listeners = new Set<() => void>();
let current: Units | null = null;

/** Regions that build in imperial; everyone else starts in metric. */
const IMPERIAL_REGIONS = new Set(["US", "CA", "LR", "MM", "PR", "GU", "VI", "AS", "MP"]);

function initialUnits(): Units {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "imperial" || saved === "metric") return saved;
  } catch {
    /* storage blocked */
  }
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    if (region && !IMPERIAL_REGIONS.has(region)) return "metric";
  } catch {
    /* old browser: imperial */
  }
  return "imperial";
}

function read(): Units {
  if (current === null) current = initialUnits();
  return current;
}

export function setUnits(units: Units): void {
  current = units;
  try {
    localStorage.setItem(KEY, units);
  } catch {
    /* storage blocked: still applies for this visit */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && (e.newValue === "imperial" || e.newValue === "metric")) {
      current = e.newValue;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The current units, kept in step everywhere on the page. */
export function useUnits(): Units {
  return useSyncExternalStore(subscribe, read, () => "imperial");
}

/** For one-off reads outside React (the PDF writer). */
export function currentUnits(): Units {
  return typeof window === "undefined" ? "imperial" : read();
}

/**
 * `m(text)` shows text in the chosen units (unchanged in imperial).
 * `m(text, { keep: true })` keeps the store size in brackets.
 */
export function useMeasure(): (text: string | null | undefined, opts?: { keep?: boolean }) => string {
  const units = useUnits();
  return useCallback(
    (text, opts) => (text ? (units === "metric" ? metricText(text, opts) : text) : ""),
    [units],
  );
}
