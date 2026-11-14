// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — lengths as builders read and type them
//
// Everything in a scene is stored in decimal inches. On screen a length is a
// tape-measure fraction to the nearest 1/16" ("34-1/2"), and every length
// field accepts whatever a builder would type: 34.5, 34 1/2, 34-1/2, 2' 6",
// 8ft, 30in.
//
// Client-safe: no imports.
// ═══════════════════════════════════════════════════════════════════════════

const SIXTEENTH = 16;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** 34.5 → "34-1/2", 0.75 → "3/4", 96 → "96". Nearest 1/16". */
export function formatFraction(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  let whole = Math.floor(abs);
  let sixteenths = Math.round((abs - whole) * SIXTEENTH);
  if (sixteenths === SIXTEENTH) {
    whole += 1;
    sixteenths = 0;
  }
  if (sixteenths === 0) return `${sign}${whole}`;
  const d = gcd(sixteenths, SIXTEENTH);
  const frac = `${sixteenths / d}/${SIXTEENTH / d}`;
  return whole === 0 ? `${sign}${frac}` : `${sign}${whole}-${frac}`;
}

/** 34.5 → `34-1/2"` */
export function formatInches(value: number): string {
  return `${formatFraction(value)}"`;
}

/** 102 → `8' 6"`, 96 → `8'`, 30 → `30"` (under 4 ft stays in inches). */
export function formatFeetInches(value: number): string {
  const rounded = Math.round(value * SIXTEENTH) / SIXTEENTH;
  if (Math.abs(rounded) < 48) return formatInches(rounded);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  const feet = Math.floor(abs / 12);
  const rest = abs - feet * 12;
  return rest === 0 ? `${sign}${feet}'` : `${sign}${feet}' ${formatInches(rest)}`;
}

/** "1/2" → 0.5, "34" → 34, "34.5" → 34.5; null when it isn't a number. */
function parseNumberOrFraction(text: string): number | null {
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (frac) {
    const den = Number(frac[2]);
    return den === 0 ? null : Number(frac[1]) / den;
  }
  return /^\d*\.?\d+$/.test(text) || /^\d+\.$/.test(text) ? Number(text) : null;
}

/** Inches part: "6", "6.5", "6 1/2", "6-1/2", "1/2". */
function parseInchesPart(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const mixed = /^(\d+)(?:\s+|-)(\d+\s*\/\s*\d+)$/.exec(t);
  if (mixed) {
    const frac = parseNumberOrFraction(mixed[2]);
    return frac === null ? null : Number(mixed[1]) + frac;
  }
  return parseNumberOrFraction(t);
}

/**
 * Read a typed length as inches. Returns null when it can't be read, so a
 * field can keep its last good value instead of jumping to zero.
 */
export function parseLength(input: string): number | null {
  let text = input.trim().toLowerCase();
  if (!text) return null;
  let sign = 1;
  if (text.startsWith("-")) {
    sign = -1;
    text = text.slice(1).trim();
  }
  text = text
    .replace(/[“”″]/g, '"')
    .replace(/[‘’′]/g, "'")
    .replace(/\s*(feet|foot|ft)\.?\s*/g, "' ")
    .replace(/\s*(inches|inch|in)\.?\s*/g, '"')
    .trim();

  const feetSplit = text.indexOf("'");
  if (feetSplit >= 0) {
    const feet = parseNumberOrFraction(text.slice(0, feetSplit).trim());
    if (feet === null) return null;
    const rest = text.slice(feetSplit + 1).replace(/"/g, "").replace(/^[\s-]+/, "").trim();
    if (!rest) return sign * feet * 12;
    const inches = parseInchesPart(rest);
    return inches === null ? null : sign * (feet * 12 + inches);
  }

  const inches = parseInchesPart(text.replace(/"/g, ""));
  return inches === null ? null : sign * inches;
}

/** Round to the nearest `step` inches; step 0 leaves the value alone. */
export function snapTo(value: number, step: number): number {
  if (!(step > 0)) return value;
  return Math.round(value / step) * step;
}
