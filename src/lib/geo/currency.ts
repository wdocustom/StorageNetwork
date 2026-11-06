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
  return `${sign}${cur === "cad" ? "CA$" : "$"}${body}`;
}

/** Uppercase ISO code for UI badges ("USD" / "CAD"). */
export function currencyLabel(currency: CurrencyCode | string | null | undefined): string {
  return normalizeCurrency(currency).toUpperCase();
}
