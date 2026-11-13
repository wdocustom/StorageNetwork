import type Stripe from "stripe";

// ═══════════════════════════════════════════════════════════════════════════
// Checkout Sessions that render inside our own pages
//
// Plan purchases use Stripe Embedded Checkout: the payment form opens in a
// panel on storage-network.app (EmbeddedCheckoutPanel) instead of sending
// the buyer to checkout.stripe.com. Callers pass the same params they would
// for the hosted page; this turns success_url into return_url, drops
// cancel_url (closing the panel is the cancel), and styles the form to
// match the site.
// ═══════════════════════════════════════════════════════════════════════════

/** Dark slate and yellow, like the rest of the site. Stripe picks readable text colors. */
export const CHECKOUT_BRANDING: Stripe.Checkout.SessionCreateParams.BrandingSettings = {
  background_color: "#0f172a",
  button_color: "#facc15",
  border_style: "rounded",
  font_family: "inter",
  display_name: "Storage Network",
};

/**
 * Shown above the Pay button on digital plan purchases. Access is granted
 * the moment payment confirms, so the plans can't be "returned": all sales
 * are final, and the buyer sees that before paying (dispute evidence too).
 */
export const FINAL_SALE_TEXT: Stripe.Checkout.SessionCreateParams.CustomText = {
  submit: {
    message:
      "Digital plans: you get instant access as soon as payment is confirmed, so all sales are final and no refunds are given.",
  },
};

export async function createEmbeddedCheckoutSession(
  stripe: Stripe,
  params: Stripe.Checkout.SessionCreateParams,
  options?: Stripe.RequestOptions
): Promise<Stripe.Checkout.Session> {
  const { success_url, cancel_url: _cancel, ...rest } = params;
  const base: Stripe.Checkout.SessionCreateParams = {
    ...rest,
    ui_mode: "embedded",
    return_url: params.return_url ?? success_url,
  };
  try {
    return await stripe.checkout.sessions.create({ ...base, branding_settings: CHECKOUT_BRANDING }, options);
  } catch (err) {
    // Looks must never cost a sale: if Stripe rejects the branding, sell
    // with the account's default look.
    console.error("[EmbeddedCheckout] Session with branding failed; retrying without:", err);
    return stripe.checkout.sessions.create(base, options);
  }
}
