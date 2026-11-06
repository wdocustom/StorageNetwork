import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { checkTransferEligibility, clearTransferEligibilityCache } from "./cross-border";
import { localeFromAccount } from "./account-locale";

function fakeStripe(country: string | null) {
  const retrieve = vi.fn(async (id: string) => ({ id, country }));
  return { stripe: { accounts: { retrieve } } as unknown as Stripe, retrieve };
}

afterEach(() => clearTransferEligibilityCache());

describe("checkTransferEligibility", () => {
  it("allows USD transfers to US accounts", async () => {
    const { stripe } = fakeStripe("US");
    expect(await checkTransferEligibility(stripe, "acct_us")).toEqual({ ok: true });
  });

  it("parks transfers to Canadian Standard accounts", async () => {
    const { stripe } = fakeStripe("CA");
    const verdict = await checkTransferEligibility(stripe, "acct_ca");
    expect(verdict).toMatchObject({ ok: false, reason: "cross_border_manual_payout" });
  });

  it("parks amounts computed from a CAD charge without asking Stripe", async () => {
    const { stripe, retrieve } = fakeStripe("US");
    const verdict = await checkTransferEligibility(stripe, "acct_us", "cad");
    expect(verdict).toMatchObject({ ok: false, reason: "currency_mismatch_manual_payout" });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("caches the account country", async () => {
    const { stripe, retrieve } = fakeStripe("US");
    await checkTransferEligibility(stripe, "acct_cached");
    await checkTransferEligibility(stripe, "acct_cached");
    expect(retrieve).toHaveBeenCalledTimes(1);
  });
});

describe("localeFromAccount", () => {
  it("reads supported country + default currency", () => {
    expect(localeFromAccount({ id: "a", country: "CA", default_currency: "cad" })).toEqual({ country: "CA", currency: "cad" });
    expect(localeFromAccount({ id: "a", country: "US", default_currency: "usd" })).toEqual({ country: "US", currency: "usd" });
  });
  it("ignores unsupported accounts", () => {
    expect(localeFromAccount({ id: "a", country: "GB", default_currency: "gbp" })).toBeNull();
    expect(localeFromAccount({ id: "a", country: undefined, default_currency: undefined })).toBeNull();
  });
});
