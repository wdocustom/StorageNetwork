import Stripe from "stripe";

// ═══════════════════════════════════════════════════════════════════════════
// Cross-border transfer guard
//
// WHY THIS EXISTS
// ─────────────────────────────────────────────────────────────────────────
// Bounties, promoter commissions, affiliate cuts, plan splits and realtor
// fulfillment payouts are separate TRANSFERS from the platform balance
// (US, USD) to a connected account. Stripe only allows a transfer to a
// connected account in another country when that account is on the
// "recipient" service agreement — and our installers are STANDARD accounts,
// which are always on the "full" agreement. A transfer from the US platform
// to a Canadian Standard account is therefore rejected by Stripe.
//
// Separately, an amount computed from a CAD charge (e.g. 30% of a CAD
// deposit) must never be sent as the same number of USD cents.
//
// So before any transfer we check both, and when either fails the payout is
// parked for manual handling (status/failure_reason say why) instead of
// erroring mid-webhook or sending the wrong amount. Customer charges are
// unaffected: they're direct charges on the installer's own account and
// never cross the border.
// ═══════════════════════════════════════════════════════════════════════════

/** The platform's own country / settlement currency. */
export const PLATFORM_COUNTRY = "US";
export const PLATFORM_CURRENCY = "usd";

/** failure_reason / log tag used when a payout is parked for manual payment. */
export const CROSS_BORDER_FAILURE_REASON = "cross_border_manual_payout";
export const CURRENCY_MISMATCH_FAILURE_REASON = "currency_mismatch_manual_payout";

export type TransferVerdict =
  | { ok: true }
  | { ok: false; reason: typeof CROSS_BORDER_FAILURE_REASON | typeof CURRENCY_MISMATCH_FAILURE_REASON; detail: string };

const COUNTRY_TTL_MS = 60 * 60 * 1000; // an account's country never changes
const countryCache = new Map<string, { country: string | null; expiresAt: number }>();

async function accountCountry(stripe: Stripe, accountId: string): Promise<string | null> {
  const cached = countryCache.get(accountId);
  if (cached && cached.expiresAt > Date.now()) return cached.country;
  const account = await stripe.accounts.retrieve(accountId);
  const country = account.country ?? null;
  countryCache.set(accountId, { country, expiresAt: Date.now() + COUNTRY_TTL_MS });
  return country;
}

/**
 * Can the platform transfer `sourceCurrency`-denominated money to
 * `accountId`? Pure decision — callers decide how to park the payout.
 *
 * A Stripe lookup failure is rethrown: callers already treat Stripe errors
 * as "retry later", which is right for a transient failure.
 */
export async function checkTransferEligibility(
  stripe: Stripe,
  accountId: string,
  sourceCurrency: string = PLATFORM_CURRENCY
): Promise<TransferVerdict> {
  if (sourceCurrency.toLowerCase() !== PLATFORM_CURRENCY) {
    return {
      ok: false,
      reason: CURRENCY_MISMATCH_FAILURE_REASON,
      detail: `payout derived from a ${sourceCurrency.toUpperCase()} charge; platform transfers are ${PLATFORM_CURRENCY.toUpperCase()}`,
    };
  }
  const country = await accountCountry(stripe, accountId);
  if (country && country !== PLATFORM_COUNTRY) {
    return {
      ok: false,
      reason: CROSS_BORDER_FAILURE_REASON,
      detail: `destination account ${accountId} is in ${country}; Standard accounts can't receive cross-border transfers`,
    };
  }
  return { ok: true };
}

/** Test seam. */
export function clearTransferEligibilityCache(): void {
  countryCache.clear();
}
