import Stripe from "stripe";

// ═══════════════════════════════════════════════════════════════════════════
// Direct charges — shared helpers
//
// WHY THIS EXISTS
// ─────────────────────────────────────────────────────────────────────────
// We used to create every customer charge on the PLATFORM account with
// `transfer_data.destination` pointing at the installer (a "destination
// charge"). Under that model Stripe debits the platform balance for
// disputes, dispute fees and processing fees — always, and setting
// `on_behalf_of` does NOT change that. A single chargeback pulled the full
// amount plus $15 out of the platform while the installer kept the money
// that had already transferred to them.
//
// Direct charges invert this: the charge is created ON the connected
// account (via the Stripe-Account header, i.e. `{ stripeAccount }` request
// options). The connected account is the merchant of record, so Stripe
// debits THEM for disputes, dispute fees and processing fees. The platform
// still earns revenue via `application_fee_amount`, which is collected from
// the charge into the platform balance.
//
// Practical consequences every caller must respect:
//   • `transfer_data` / `on_behalf_of` must NOT be set — they are
//     destination-charge concepts and Stripe rejects them here.
//   • The full amount lands in the connected account; the platform's cut is
//     `application_fee_amount`. Net platform revenue is unchanged, but the
//     installer now bears Stripe's processing fees.
//   • Every subsequent read/write for that charge (retrieve, refund,
//     capture) must pass the SAME `{ stripeAccount }` options, or Stripe
//     404s — the object does not exist on the platform account.
//   • Customers and PaymentMethods are account-scoped. A platform Customer
//     cannot be charged on a connected account; see cloneCardToAccount.
//   • Webhook events fire on the CONNECT endpoint with `event.account` set,
//     not the platform endpoint.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Request options that route a Stripe call at a connected account.
 * Passing these is what makes a charge a DIRECT charge.
 */
export function onAccount(
  accountId: string,
  extra?: Stripe.RequestOptions
): Stripe.RequestOptions {
  return { ...extra, stripeAccount: accountId };
}

// ── Capability gate ────────────────────────────────────────────────────────
// A connected account can only be the merchant of record once Stripe has
// activated `card_payments` (and `transfers`, which we still need for the
// application fee to settle). Accounts onboarded for destination charges may
// never have completed the extra verification direct charges require, so we
// check before routing a charge at them rather than letting the charge throw
// in front of a paying customer.

type CapabilityVerdict =
  | { ready: true }
  | { ready: false; reason: string };

// accountId → { verdict, expiresAt }. Accounts flip to active rarely, so a
// short TTL keeps a per-charge round trip off the checkout path without
// stranding a freshly-verified installer for long.
const CAPABILITY_TTL_MS = 5 * 60 * 1000;
const capabilityCache = new Map<string, { verdict: CapabilityVerdict; expiresAt: number }>();

export async function assertDirectChargeReady(
  stripe: Stripe,
  accountId: string
): Promise<CapabilityVerdict> {
  const cached = capabilityCache.get(accountId);
  if (cached && cached.expiresAt > Date.now()) return cached.verdict;

  let verdict: CapabilityVerdict;
  try {
    const account = await stripe.accounts.retrieve(accountId);
    if (account.capabilities?.card_payments !== "active") {
      verdict = {
        ready: false,
        reason:
          "This installer's Stripe account can't accept card payments yet. They need to finish Stripe onboarding before you can charge on their behalf.",
      };
    } else if (!account.charges_enabled) {
      verdict = {
        ready: false,
        reason:
          "This installer's Stripe account has charges disabled. They need to resolve the outstanding requirements in their Stripe dashboard.",
      };
    } else {
      verdict = { ready: true };
    }
  } catch (err) {
    console.error(`[DirectCharge] Capability lookup failed for ${accountId}:`, err);
    // Don't cache a lookup failure as a hard no — a transient Stripe error
    // shouldn't wedge an installer's checkout for the whole TTL.
    return {
      ready: false,
      reason: "Couldn't verify the installer's Stripe account. Please try again.",
    };
  }

  capabilityCache.set(accountId, { verdict, expiresAt: Date.now() + CAPABILITY_TTL_MS });
  return verdict;
}

/** Test seam — capability verdicts are process-cached for CAPABILITY_TTL_MS. */
export function clearCapabilityCache(): void {
  capabilityCache.clear();
}

// ── Saved cards across the account boundary ────────────────────────────────

export interface ScopedCard {
  customerId: string;
  paymentMethodId: string;
}

/**
 * Clone a card saved on the PLATFORM account onto a connected account so it
 * can back a direct charge.
 *
 * Customers and PaymentMethods live on exactly one account. Every card saved
 * before this migration belongs to the platform, so an off-session charge on
 * the connected account can't reference it directly — Stripe returns "No such
 * PaymentMethod". Stripe's supported path is to re-create the PaymentMethod
 * on the connected account from the platform-held original, then attach it to
 * a Customer over there.
 *
 * Returns null when the clone isn't possible (card since removed, account not
 * permitted to clone, etc.) — callers fall back to a payment link rather than
 * failing the job outright.
 */
export async function cloneCardToAccount(
  stripe: Stripe,
  accountId: string,
  platformCustomerId: string,
  platformPaymentMethodId: string,
  opts?: { email?: string | null; name?: string | null }
): Promise<ScopedCard | null> {
  try {
    // Re-create the platform card on the connected account. Passing both
    // `customer` and `payment_method` is what tells Stripe to clone rather
    // than expect raw card details.
    const cloned = await stripe.paymentMethods.create(
      {
        customer: platformCustomerId,
        payment_method: platformPaymentMethodId,
      },
      onAccount(accountId)
    );

    // The cloned PaymentMethod needs a Customer on the SAME account to be
    // chargeable off-session.
    const customer = await stripe.customers.create(
      {
        email: opts?.email || undefined,
        name: opts?.name || undefined,
        payment_method: cloned.id,
        metadata: {
          cloned_from_platform_customer: platformCustomerId,
          cloned_from_platform_payment_method: platformPaymentMethodId,
        },
      },
      onAccount(accountId)
    );

    return { customerId: customer.id, paymentMethodId: cloned.id };
  } catch (err) {
    console.error(
      `[DirectCharge] Could not clone platform card ${platformPaymentMethodId} to ${accountId}:`,
      err
    );
    return null;
  }
}

/**
 * Resolve a saved card into one chargeable on `accountId`.
 *
 * `savedAccountId` records which account the stored ids belong to: null means
 * the platform (every row written before the direct-charge migration), and a
 * value means the card already lives on that connected account. Cards saved
 * against a DIFFERENT connected account can't be reused — installers don't
 * share customer records — so those fall back to a payment link.
 */
export async function resolveCardForAccount(
  stripe: Stripe,
  accountId: string,
  saved: {
    customerId: string;
    paymentMethodId: string;
    savedAccountId: string | null;
  },
  opts?: { email?: string | null; name?: string | null }
): Promise<ScopedCard | null> {
  if (saved.savedAccountId === accountId) {
    return { customerId: saved.customerId, paymentMethodId: saved.paymentMethodId };
  }
  if (saved.savedAccountId && saved.savedAccountId !== accountId) {
    console.warn(
      `[DirectCharge] Saved card belongs to ${saved.savedAccountId}, not ${accountId} — not reusable.`
    );
    return null;
  }
  return cloneCardToAccount(
    stripe,
    accountId,
    saved.customerId,
    saved.paymentMethodId,
    opts
  );
}
