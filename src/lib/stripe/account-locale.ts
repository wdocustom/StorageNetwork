import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Installer locale ← Stripe account
//
// profiles.country / profiles.currency decide what currency every customer
// charge for an installer is presented in (see @/lib/geo/currency). Once the
// installer has a Connect account, Stripe is the source of truth: a direct
// charge settles on that account, so it should be in that account's
// default_currency. We re-sync whenever we read the account (status check,
// onboarding callback).
//
// Only supported values are written; an account in some other country is
// logged and left alone rather than corrupting the profile.
// ═══════════════════════════════════════════════════════════════════════════

const SUPPORTED_COUNTRIES = new Set(["US", "CA"]);
const SUPPORTED_CURRENCIES = new Set(["usd", "cad"]);

export function localeFromAccount(
  account: Pick<Stripe.Account, "id" | "country" | "default_currency">
): { country: "US" | "CA"; currency: "usd" | "cad" } | null {
  const country = account.country?.toUpperCase();
  const currency = account.default_currency?.toLowerCase();
  if (!country || !SUPPORTED_COUNTRIES.has(country)) return null;
  if (!currency || !SUPPORTED_CURRENCIES.has(currency)) return null;
  return { country: country as "US" | "CA", currency: currency as "usd" | "cad" };
}

export async function syncInstallerLocaleFromAccount(
  db: SupabaseClient,
  profileId: string,
  account: Pick<Stripe.Account, "id" | "country" | "default_currency">
): Promise<void> {
  const locale = localeFromAccount(account);
  if (!locale) {
    if (account.country || account.default_currency) {
      console.warn(
        `[AccountLocale] ${account.id} has unsupported country/currency (${account.country}/${account.default_currency}) — profile ${profileId} left unchanged`
      );
    }
    return;
  }
  const { error } = await db
    .from("profiles")
    .update({ country: locale.country, currency: locale.currency })
    .eq("id", profileId);
  if (error) console.error(`[AccountLocale] Failed to sync profile ${profileId}:`, error);
}
