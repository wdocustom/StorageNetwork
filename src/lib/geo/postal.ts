// ═══════════════════════════════════════════════════════════════════════════
// Postal codes — US ZIP codes and Canadian postal codes
//
// The platform matches customers to installers by "postal key": the string
// stored in profiles.service_zip / service_zips, territory_zips.zip,
// demand_signals.zip, etc. Keys come straight from the `zipcodes` dataset:
//
//   US  → the 5-digit ZIP              "29401"
//   CA  → the 3-character FSA          "M5V"   (Forward Sortation Area)
//
// The dataset geocodes Canada at FSA granularity (≈1,650 areas), so a full
// Canadian postal code ("M5V 2T6") is reduced to its FSA for matching, while
// the full code is kept for addresses (see `formatted`).
//
// Pure module — safe to import from server actions AND client components.
// ═══════════════════════════════════════════════════════════════════════════

export type CountryCode = "US" | "CA";

export const SUPPORTED_COUNTRIES: readonly CountryCode[] = ["US", "CA"] as const;

export interface PostalCode {
  country: CountryCode;
  /** Matching key: 5-digit ZIP or 3-char FSA. */
  key: string;
  /** Display/address form: "29401", "M5V 2T6", or "M5V" when only the FSA was given. */
  formatted: string;
}

const US_ZIP = /^(\d{5})(?:-?\d{4})?$/;
// Canada Post: first letter never D F I O Q U W Z; later letters never D F I O Q U.
const CA_FSA = /^([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])$/;
const CA_FULL = /^([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])(\d[ABCEGHJ-NPRSTV-Z]\d)$/;

/** Parse a user-entered ZIP or postal code. Returns null when invalid. */
export function parsePostalCode(input: string | null | undefined): PostalCode | null {
  if (!input) return null;
  const raw = String(input).trim().toUpperCase();
  if (!raw) return null;

  const us = US_ZIP.exec(raw);
  if (us) return { country: "US", key: us[1], formatted: us[1] };

  const compact = raw.replace(/[\s-]+/g, "");
  const full = CA_FULL.exec(compact);
  if (full) return { country: "CA", key: full[1], formatted: `${full[1]} ${full[2]}` };
  const fsa = CA_FSA.exec(compact);
  if (fsa) return { country: "CA", key: fsa[1], formatted: fsa[1] };

  return null;
}

/** The matching key for a ZIP/postal code, or null when invalid. */
export function postalKey(input: string | null | undefined): string | null {
  return parsePostalCode(input)?.key ?? null;
}

export function isValidPostalCode(input: string | null | undefined): boolean {
  return parsePostalCode(input) !== null;
}

/**
 * True once the user has typed a *complete* code: 5-digit ZIP or full
 * 6-character Canadian code. Use it to auto-fire lookups while typing, so a
 * Canadian's "M5V" (valid FSA, but they're mid-entry) doesn't fire early.
 * Submit-time validation should use isValidPostalCode, which accepts an FSA.
 */
export function isCompletePostalInput(input: string | null | undefined): boolean {
  const parsed = parsePostalCode(input);
  if (!parsed) return false;
  return parsed.country === "US" || parsed.formatted.length === 7;
}

/** Country of an already-normalized key (or of any valid postal input). */
export function countryOfPostal(input: string | null | undefined): CountryCode | null {
  return parsePostalCode(input)?.country ?? null;
}

/**
 * Keystroke sanitizer for postal inputs. Digits-first input is treated as a
 * US ZIP (max 5 digits); letter-first input as a Canadian postal code
 * ("A1A 1A1", max 7 chars incl. the space).
 */
export function sanitizePostalInput(value: string): string {
  const v = value.toUpperCase();
  const firstAlnum = v.match(/[A-Z0-9]/)?.[0];
  if (!firstAlnum) return "";
  if (/\d/.test(firstAlnum)) return v.replace(/\D/g, "").slice(0, 5);
  const compact = v.replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return compact.length > 3 ? `${compact.slice(0, 3)} ${compact.slice(3)}` : compact;
}

/** Max input length for a postal field ("A1A 1A1"). */
export const POSTAL_INPUT_MAX_LENGTH = 7;

export const POSTAL_INPUT_PLACEHOLDER = "ZIP / postal code";

export const INVALID_POSTAL_MESSAGE = "Please enter a valid ZIP or postal code.";

export function postalLabel(country: CountryCode | null | undefined): string {
  return country === "CA" ? "postal code" : "ZIP code";
}

// ── Regions ────────────────────────────────────────────────────────────────
// `zipcodes.lookup()` returns the 2-letter state for US ZIPs but the full
// province name for Canadian FSAs. Normalize both to 2-letter codes.

export const CA_PROVINCES: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

const PROVINCE_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(CA_PROVINCES).flatMap(([code, name]) => [
    [name.toLowerCase(), code],
    [code.toLowerCase(), code],
  ])
);
// Dataset / common spelling variants.
PROVINCE_BY_NAME["québec"] = "QC";
PROVINCE_BY_NAME["newfoundland"] = "NL";
PROVINCE_BY_NAME["yukon territory"] = "YT";
PROVINCE_BY_NAME["pei"] = "PE";

/** 2-letter province code from a name or code ("Ontario" → "ON"), or null. */
export function provinceCode(nameOrCode: string | null | undefined): string | null {
  if (!nameOrCode) return null;
  return PROVINCE_BY_NAME[nameOrCode.trim().toLowerCase()] ?? null;
}

// Canada Post assigns the first FSA letter by province, so the province is
// derivable from the code itself — more reliable than the dataset's `state`
// field, which holds county/district names for a few FSAs.
const PROVINCE_BY_FSA_LETTER: Record<string, string> = {
  A: "NL", B: "NS", C: "PE", E: "NB",
  G: "QC", H: "QC", J: "QC",
  K: "ON", L: "ON", M: "ON", N: "ON", P: "ON",
  R: "MB", S: "SK", T: "AB", V: "BC", Y: "YT",
};

/** 2-letter province code for a Canadian postal code / FSA, or null. */
export function provinceFromPostal(input: string | null | undefined): string | null {
  const parsed = parsePostalCode(input);
  if (!parsed || parsed.country !== "CA") return null;
  const fsa = parsed.key;
  if (fsa[0] === "X") return /^X0[ABC]$/.test(fsa) ? "NU" : "NT";
  return PROVINCE_BY_FSA_LETTER[fsa[0]] ?? null;
}

/**
 * 2-letter region (US state / CA province) for a `zipcodes.lookup()` result.
 * Accepts the minimal shape so callers don't need the module's types.
 */
export function regionCodeFromLookup(
  info: { zip?: string | null; state?: string | null; country?: string | null } | null | undefined
): string | null {
  if (!info) return null;
  if (info.country === "Canada") {
    return provinceFromPostal(info.zip) ?? provinceCode(info.state);
  }
  return info.state && info.state.length === 2 ? info.state.toUpperCase() : null;
}

/** Country of a `zipcodes.lookup()` result. */
export function countryFromLookup(
  info: { country?: string | null } | null | undefined
): CountryCode | null {
  if (!info?.country) return null;
  if (info.country === "Canada") return "CA";
  if (info.country === "US") return "US";
  return null;
}
