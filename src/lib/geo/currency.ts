// ═══════════════════════════════════════════════════════════════════════════
// Currency — per-installer settlement currency
//
// Every customer charge is a DIRECT charge on the installer's connected
// account (see @/lib/stripe/direct-charges), so it must be presented in the
// currency that account settles in. Otherwise the customer pays foreign-
// transaction fees on their card and Stripe converts the funds again at
// payout, costing the installer ~1–2% per job.
//
//   US installer → USD        CA installer → CAD
//
// profiles.currency holds the installer's currency (migration 152). It is
// set from the home postal code at onboarding and re-synced from the Stripe
// account's `default_currency` whenever the account is (re)checked.
//
// Pure module — safe to import from server actions AND client components.
// ═══════════════════════════════════════════════════════════════════════════

import type { CountryCode } from "./postal";

export type CurrencyCode = "usd" | "cad";

export const DEFAULT_CURRENCY: CurrencyCode = "usd";
export const DEFAULT_COUNTRY: CountryCode = "US";

const CURRENCY_BY_COUNTRY: Record<CountryCode, CurrencyCode> = {
  US: "usd",
  CA: "cad",
};

export function currencyForCountry(country: string | null | undefined): CurrencyCode {
  return CURRENCY_BY_COUNTRY[(country ?? "").toUpperCase() as CountryCode] ?? DEFAULT_CURRENCY;
}

/** Narrow an arbitrary DB/Stripe value to a supported currency (default USD). */
export function normalizeCurrency(value: string | null | undefined): CurrencyCode {
  const v = (value ?? "").toLowerCase();
  return v === "cad" ? "cad" : "usd";
}

/** Narrow an arbitrary DB/Stripe value to a supported country (default US). */
export function normalizeCountry(value: string | null | undefined): CountryCode {
  return (value ?? "").toUpperCase() === "CA" ? "CA" : "US";
}

/**
 * Format a dollar amount. USD renders as "$1,234.50" (unchanged from the
 * rest of the app); CAD renders as "CA$1,234.50" so a cross-border reader
 * (admin, US affiliate) is never ambiguous about which dollar it is.
 */
export function formatMoney(
  amount: number,
  currency: CurrencyCode | string | null | undefined = DEFAULT_CURRENCY,
  opts: { cents?: boolean } = {}
): string {
  const cur = normalizeCurrency(currency);
  const showCents = opts.cents ?? !Number.isInteger(amount);
  const body = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  const sign = amount < 0 ? "-" : "";
  return `${sign}${currencySymbol(cur)}${body}`;
}

/** Money symbol: "$" for USD, "CA$" for CAD. */
export function currencySymbol(currency: CurrencyCode | string | null | undefined): string {
  return normalizeCurrency(currency) === "cad" ? "CA$" : "$";
}

/**
 * Rewrite every "$<amount>" in already-rendered text (an email body, an SMS)
 * as "CA$<amount>" when the job is in CAD. Templates keep writing plain "$"
 * so US output is byte-for-byte unchanged; only CAD sends are localized.
 * Matches a "$" directly before a digit (optionally after a minus sign),
 * and leaves any "$" already prefixed ("CA$", "US$") alone.
 */
export function localizeMoneyText(
  text: string,
  currency: CurrencyCode | string | null | undefined
): string {
  if (!text) return text;
  if (normalizeCurrency(currency) !== "cad") return text.split(USD_MARK).join("");
  return text
    .replace(/(?<![A-Za-z\u2060])\$(?=\s?\d)/g, "CA$")
    .replace(new RegExp(`${USD_MARK}\\$`, "g"), "US$")
    .split(USD_MARK)
    .join("");
}

/**
 * Invisible marker (U+2060 WORD JOINER) for an amount that is ALWAYS US
 * dollars even inside a CAD email — e.g. a DIY plan price, which the
 * platform sells in USD. localizeMoneyText renders "⁠$9" as "US$9" in a CAD
 * send and strips the marker otherwise, so US emails are unchanged.
 */
export const USD_MARK = "\u2060";

/** Mark a pre-formatted "$…" string as always-USD (see USD_MARK). */
export function usdMoney(formatted: string): string {
  return formatted.startsWith("$") ? USD_MARK + formatted : formatted;
}

/** Uppercase ISO code for UI badges ("USD" / "CAD"). */
export function currencyLabel(currency: CurrencyCode | string | null | undefined): string {
  return normalizeCurrency(currency).toUpperCase();
}
