/**
 * Direct-charge helper tests.
 *
 * These guard the two rules that make direct charges safe:
 *   1. We never route a charge at a connected account that can't accept one
 *      (the customer would hit a Stripe error mid-checkout).
 *   2. A saved card is only ever charged on the account that actually holds
 *      it — Customers and PaymentMethods are account-scoped, so getting this
 *      wrong means charging against an account where the card doesn't exist.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import type Stripe from "stripe";
import {
  onAccount,
  assertDirectChargeReady,
  clearCapabilityCache,
  resolveCardForAccount,
} from "./direct-charges";

const ACCOUNT = "acct_installer_1";
const OTHER_ACCOUNT = "acct_installer_2";

function stripeWithAccount(account: Partial<Stripe.Account>) {
  return {
    accounts: { retrieve: vi.fn().mockResolvedValue(account) },
  } as unknown as Stripe;
}

beforeEach(() => {
  clearCapabilityCache();
});

describe("onAccount", () => {
  it("sets stripeAccount, which is what makes a charge a direct charge", () => {
    expect(onAccount(ACCOUNT)).toEqual({ stripeAccount: ACCOUNT });
  });

  it("preserves other request options such as the idempotency key", () => {
    expect(onAccount(ACCOUNT, { idempotencyKey: "deposit-123" })).toEqual({
      idempotencyKey: "deposit-123",
      stripeAccount: ACCOUNT,
    });
  });
});

describe("assertDirectChargeReady", () => {
  it("accepts an account with card_payments active and charges enabled", async () => {
    const stripe = stripeWithAccount({
      capabilities: { card_payments: "active" } as Stripe.Account.Capabilities,
      charges_enabled: true,
    });
    await expect(assertDirectChargeReady(stripe, ACCOUNT)).resolves.toEqual({ ready: true });
  });

  it("rejects an account that never completed card_payments onboarding", async () => {
    const stripe = stripeWithAccount({
      capabilities: { card_payments: "inactive" } as Stripe.Account.Capabilities,
      charges_enabled: true,
    });
    const verdict = await assertDirectChargeReady(stripe, ACCOUNT);
    expect(verdict.ready).toBe(false);
  });

  it("rejects an account with charges disabled", async () => {
    const stripe = stripeWithAccount({
      capabilities: { card_payments: "active" } as Stripe.Account.Capabilities,
      charges_enabled: false,
    });
    const verdict = await assertDirectChargeReady(stripe, ACCOUNT);
    expect(verdict.ready).toBe(false);
  });

  it("caches a verdict so checkout doesn't pay for a lookup per charge", async () => {
    const stripe = stripeWithAccount({
      capabilities: { card_payments: "active" } as Stripe.Account.Capabilities,
      charges_enabled: true,
    });
    await assertDirectChargeReady(stripe, ACCOUNT);
    await assertDirectChargeReady(stripe, ACCOUNT);
    expect(stripe.accounts.retrieve).toHaveBeenCalledTimes(1);
  });

  it("does not cache a lookup failure — a transient error must not wedge checkout", async () => {
    const stripe = {
      accounts: { retrieve: vi.fn().mockRejectedValue(new Error("network")) },
    } as unknown as Stripe;

    const first = await assertDirectChargeReady(stripe, ACCOUNT);
    expect(first.ready).toBe(false);

    // Second call must hit Stripe again rather than serving a cached "no".
    await assertDirectChargeReady(stripe, ACCOUNT);
    expect(stripe.accounts.retrieve).toHaveBeenCalledTimes(2);
  });
});

describe("resolveCardForAccount", () => {
  it("uses a card already saved on the charging account as-is", async () => {
    const stripe = {
      paymentMethods: { create: vi.fn() },
      customers: { create: vi.fn() },
    } as unknown as Stripe;

    const resolved = await resolveCardForAccount(stripe, ACCOUNT, {
      customerId: "cus_on_account",
      paymentMethodId: "pm_on_account",
      savedAccountId: ACCOUNT,
    });

    expect(resolved).toEqual({
      customerId: "cus_on_account",
      paymentMethodId: "pm_on_account",
    });
    // No clone needed — the card already lives there.
    expect(stripe.paymentMethods.create).not.toHaveBeenCalled();
  });

  it("clones a platform-saved card onto the connected account", async () => {
    const stripe = {
      paymentMethods: { create: vi.fn().mockResolvedValue({ id: "pm_cloned" }) },
      customers: { create: vi.fn().mockResolvedValue({ id: "cus_cloned" }) },
    } as unknown as Stripe;

    const resolved = await resolveCardForAccount(
      stripe,
      ACCOUNT,
      {
        customerId: "cus_platform",
        paymentMethodId: "pm_platform",
        savedAccountId: null, // null = platform (pre-migration row)
      },
      { email: "customer@test.com", name: "Customer" }
    );

    expect(resolved).toEqual({ customerId: "cus_cloned", paymentMethodId: "pm_cloned" });
    expect(stripe.paymentMethods.create).toHaveBeenCalledWith(
      { customer: "cus_platform", payment_method: "pm_platform" },
      { stripeAccount: ACCOUNT }
    );
    expect(stripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: "pm_cloned" }),
      { stripeAccount: ACCOUNT }
    );
  });

  it("refuses to reuse a card saved on a DIFFERENT installer's account", async () => {
    const stripe = {
      paymentMethods: { create: vi.fn() },
      customers: { create: vi.fn() },
    } as unknown as Stripe;

    const resolved = await resolveCardForAccount(stripe, ACCOUNT, {
      customerId: "cus_other",
      paymentMethodId: "pm_other",
      savedAccountId: OTHER_ACCOUNT,
    });

    expect(resolved).toBeNull();
    expect(stripe.paymentMethods.create).not.toHaveBeenCalled();
  });

  it("returns null when the clone fails, so callers fall back to a payment link", async () => {
    const stripe = {
      paymentMethods: { create: vi.fn().mockRejectedValue(new Error("no such PaymentMethod")) },
      customers: { create: vi.fn() },
    } as unknown as Stripe;

    const resolved = await resolveCardForAccount(stripe, ACCOUNT, {
      customerId: "cus_platform",
      paymentMethodId: "pm_gone",
      savedAccountId: null,
    });

    expect(resolved).toBeNull();
  });
});

// ── Canadian pre-authorized debit (PAD) ────────────────────────────────────
import {
  PAD_INTENT_PARAMS,
  canAcceptPad,
  clearPadCache,
  createDirectCheckoutSession,
  isCardPaymentMethod,
} from "./direct-charges";

describe("Canadian pre-authorized debit", () => {
  beforeEach(() => {
    clearPadCache();
  });

  const padAccount = { capabilities: { card_payments: "active", acss_debit_payments: "active" } } as Partial<Stripe.Account>;
  const cardOnlyAccount = { capabilities: { card_payments: "active" } } as Partial<Stripe.Account>;

  function stripeFor(account: Partial<Stripe.Account>, create = vi.fn().mockResolvedValue({ id: "cs_1", url: "https://stripe.test/cs_1" })) {
    return {
      stripe: {
        accounts: { retrieve: vi.fn().mockResolvedValue(account) },
        checkout: { sessions: { create } },
      } as unknown as Stripe,
      create,
    };
  }

  const sessionParams = (currency: string): Stripe.Checkout.SessionCreateParams => ({
    mode: "payment",
    line_items: [{ price_data: { currency, product_data: { name: "Deposit" }, unit_amount: 50000 }, quantity: 1 }],
    payment_intent_data: { application_fee_amount: 2500 },
    success_url: "https://example.test/ok",
    metadata: { lead_id: "lead_1", type: "deposit" },
  });

  describe("canAcceptPad", () => {
    it("is offered only for CAD on an account with the capability active", async () => {
      expect(await canAcceptPad(stripeFor(padAccount).stripe, ACCOUNT, "cad")).toBe(true);
      clearPadCache();
      expect(await canAcceptPad(stripeFor(cardOnlyAccount).stripe, ACCOUNT, "cad")).toBe(false);
      clearPadCache();
      expect(
        await canAcceptPad(stripeFor({ capabilities: { acss_debit_payments: "pending" } } as Partial<Stripe.Account>).stripe, ACCOUNT, "cad")
      ).toBe(false);
    });

    it("never looks at Stripe for a US-dollar charge or a platform charge", async () => {
      const { stripe } = stripeFor(padAccount);
      expect(await canAcceptPad(stripe, ACCOUNT, "usd")).toBe(false);
      expect(await canAcceptPad(stripe, null, "cad")).toBe(false);
      expect(stripe.accounts.retrieve).not.toHaveBeenCalled();
    });

    it("falls back to cards only when the lookup fails", async () => {
      const stripe = { accounts: { retrieve: vi.fn().mockRejectedValue(new Error("stripe down")) } } as unknown as Stripe;
      expect(await canAcceptPad(stripe, ACCOUNT, "cad")).toBe(false);
    });

    it("caches the answer per account", async () => {
      const { stripe } = stripeFor(padAccount);
      await canAcceptPad(stripe, ACCOUNT, "cad");
      await canAcceptPad(stripe, ACCOUNT, "CAD");
      expect(stripe.accounts.retrieve).toHaveBeenCalledTimes(1);
    });
  });

  describe("createDirectCheckoutSession", () => {
    it("adds bank debit next to cards for a Canadian account that supports it", async () => {
      const { stripe, create } = stripeFor(padAccount);
      await createDirectCheckoutSession(stripe, sessionParams("cad"), ACCOUNT);
      expect(create).toHaveBeenCalledTimes(1);
      const [params, opts] = create.mock.calls[0];
      expect(opts).toEqual({ stripeAccount: ACCOUNT });
      expect(params.payment_method_types).toEqual(["card", "acss_debit"]);
      expect(params.payment_method_options.acss_debit.mandate_options).toEqual({
        payment_schedule: "sporadic",
        transaction_type: "personal",
      });
      // The rest of the session is untouched — fee and metadata included.
      expect(params.payment_intent_data).toEqual({ application_fee_amount: 2500 });
      expect(params.metadata).toEqual({ lead_id: "lead_1", type: "deposit" });
    });

    it("leaves a US session exactly as it was", async () => {
      const { stripe, create } = stripeFor(padAccount);
      const params = sessionParams("usd");
      await createDirectCheckoutSession(stripe, params, ACCOUNT);
      expect(create).toHaveBeenCalledWith(params, { stripeAccount: ACCOUNT });
    });

    it("leaves a Canadian session as it was when the account has no bank-debit capability", async () => {
      const { stripe, create } = stripeFor(cardOnlyAccount);
      const params = sessionParams("cad");
      await createDirectCheckoutSession(stripe, params, ACCOUNT);
      expect(create).toHaveBeenCalledWith(params, { stripeAccount: ACCOUNT });
    });

    it("retries cards-only if Stripe rejects the bank-debit version", async () => {
      const create = vi
        .fn()
        .mockRejectedValueOnce(new Error("acss_debit is not available"))
        .mockResolvedValueOnce({ id: "cs_2", url: "https://stripe.test/cs_2" });
      const { stripe } = stripeFor(padAccount, create);
      const params = sessionParams("cad");
      const session = await createDirectCheckoutSession(stripe, params, ACCOUNT);
      expect(session.id).toBe("cs_2");
      expect(create).toHaveBeenCalledTimes(2);
      expect(create.mock.calls[1]).toEqual([params, { stripeAccount: ACCOUNT }]);
    });
  });

  it("in-page deposits offer card and bank debit with the same agreement terms", () => {
    expect(PAD_INTENT_PARAMS.payment_method_types).toEqual(["card", "acss_debit"]);
    expect(PAD_INTENT_PARAMS.payment_method_options.acss_debit.mandate_options.payment_schedule).toBe("sporadic");
  });

  describe("isCardPaymentMethod", () => {
    const stripeWithPm = (type: string) =>
      ({ paymentMethods: { retrieve: vi.fn().mockResolvedValue({ id: "pm_1", type }) } }) as unknown as Stripe;

    it("tells a card from a bank debit, looking on the charging account", async () => {
      const card = stripeWithPm("card");
      expect(await isCardPaymentMethod(card, "pm_1", ACCOUNT)).toBe(true);
      expect(card.paymentMethods.retrieve).toHaveBeenCalledWith("pm_1", { stripeAccount: ACCOUNT });
      expect(await isCardPaymentMethod(stripeWithPm("acss_debit"), "pm_1", ACCOUNT)).toBe(false);
    });
  });
});
