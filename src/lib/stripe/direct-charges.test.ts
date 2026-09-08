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
