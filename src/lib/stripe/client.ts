import { loadStripe, type Stripe } from "@stripe/stripe-js";

// ═══════════════════════════════════════════════════════════════════════════
// Stripe.js instances, scoped to the account holding the PaymentIntent
//
// Customer payments are DIRECT charges created on the installer's connected
// account (see @/lib/stripe/direct-charges), and a PaymentIntent client secret
// can only be read by a Stripe.js instance initialized for that same account.
// A single shared instance therefore no longer works — each connected account
// needs its own.
//
// Instances are memoized per account so re-renders don't reload the script.
// The "platform" key is the un-scoped instance, used for installers with no
// Stripe connected (their deposits are still charged on the platform).
// ═══════════════════════════════════════════════════════════════════════════

const instances = new Map<string, Promise<Stripe | null>>();

export function getStripePromise(connectedAccountId?: string | null): Promise<Stripe | null> {
  const key = connectedAccountId || "platform";
  let instance = instances.get(key);
  if (!instance) {
    instance = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
      connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
    );
    instances.set(key, instance);
  }
  return instance;
}
