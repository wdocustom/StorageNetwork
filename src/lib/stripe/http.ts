import Stripe from "stripe";

// ═══════════════════════════════════════════════════════════════════════════
// Options every server-side Stripe client must use
//
// The app runs on Cloudflare Workers. There the Stripe Node library's
// default network client (Node's https with keep-alive) can hand one
// request a connection that belongs to another; the request then waits
// forever and the runtime kills it ("Worker's code had hung"). That broke
// plan checkout on storage-network.app from Nov 12, 2026: the first
// purchase on a fresh server worked, later ones failed with a 500.
//
// Stripe's documented fix for Workers is to use fetch. Always build clients
// as `new Stripe(key, stripeConfig({ ...options }))`.
// ═══════════════════════════════════════════════════════════════════════════

export function stripeConfig(config: Stripe.StripeConfig = {}): Stripe.StripeConfig {
  // Absent when a test replaces the stripe module with a mock.
  const createFetchHttpClient = (Stripe as unknown as { createFetchHttpClient?: () => Stripe.HttpClient })
    .createFetchHttpClient;
  return typeof createFetchHttpClient === "function" ? { ...config, httpClient: createFetchHttpClient() } : config;
}
