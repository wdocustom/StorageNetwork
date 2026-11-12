import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

import { CHECKOUT_BRANDING, createEmbeddedCheckoutSession } from "./embedded-checkout";

const hosted: Stripe.Checkout.SessionCreateParams = {
  mode: "payment",
  line_items: [{ price_data: { currency: "usd", product_data: { name: "Plan" }, unit_amount: 1400 }, quantity: 1 }],
  success_url: "https://storage-network.app/plans/jig?session_id={CHECKOUT_SESSION_ID}",
  cancel_url: "https://storage-network.app/plans/jig?cancelled=1",
  metadata: { type: "ladder_jig" },
};

const stripeWith = (create: ReturnType<typeof vi.fn>) => ({ checkout: { sessions: { create } } }) as unknown as Stripe;

describe("createEmbeddedCheckoutSession", () => {
  it("turns hosted params into an embedded, branded session", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cs_1", client_secret: "sec_1" });
    const session = await createEmbeddedCheckoutSession(stripeWith(create), hosted);
    expect(session.client_secret).toBe("sec_1");
    const [params] = create.mock.calls[0];
    expect(params.ui_mode).toBe("embedded");
    expect(params.return_url).toBe(hosted.success_url);
    expect(params).not.toHaveProperty("success_url");
    expect(params).not.toHaveProperty("cancel_url");
    expect(params.branding_settings).toEqual(CHECKOUT_BRANDING);
    // Everything else is passed through untouched.
    expect(params.metadata).toEqual({ type: "ladder_jig" });
    expect(params.line_items).toEqual(hosted.line_items);
  });

  it("keeps an explicit return_url", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cs_1", client_secret: "sec_1" });
    const { success_url: _s, cancel_url: _c, ...rest } = hosted;
    await createEmbeddedCheckoutSession(stripeWith(create), { ...rest, return_url: "https://example.test/done" });
    expect(create.mock.calls[0][0].return_url).toBe("https://example.test/done");
  });

  it("retries without branding rather than lose the sale", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("Received unknown parameter: branding_settings"))
      .mockResolvedValueOnce({ id: "cs_2", client_secret: "sec_2" });
    const session = await createEmbeddedCheckoutSession(stripeWith(create), hosted);
    expect(session.id).toBe("cs_2");
    expect(create.mock.calls[1][0]).not.toHaveProperty("branding_settings");
    expect(create.mock.calls[1][0].ui_mode).toBe("embedded");
  });
});
