import { describe, it, expect } from "vitest";
import { computeBookingTakeHome } from "./bookingTakeHome";

// Regression: the new-booking alert showed totalPrice × 0.85 on every job.
// An installer's $1,499 direct lead (3% fee) was emailed "$1,274 take-home"
// when the real take-home was $1,454.03.
describe("computeBookingTakeHome", () => {
  it("uses the actual Stripe split on a direct lead (the reported job)", () => {
    const r = computeBookingTakeHome({
      totalPrice: 1499,
      depositPaid: 224.85,
      balanceDue: 1274.15,
      source: "partner_link",
      metadata: {
        source: "partner_link",
        platform_fee_cents: "4497",
        platform_fee_rate: "3%",
        installer_receives_cents: "17988",
        installer_stripe_id: "acct_123",
      },
    });
    expect(r.isDirect).toBe(true);
    expect(r.takeHome).toBe(1454.03);
    expect(r.platformFee).toBe(44.97);
    expect(r.feeRateLabel).toBe("3%");
    expect(r.fromDeposit).toBe(179.88);
    expect(r.balanceToCollect).toBe(1274.15);
  });

  it("network lead keeps the 15% fee", () => {
    const r = computeBookingTakeHome({
      totalPrice: 1000,
      depositPaid: 150,
      balanceDue: 850,
      source: "platform",
      metadata: { platform_fee_cents: "15000", platform_fee_rate: "15%", installer_receives_cents: "0", installer_stripe_id: "acct_1" },
    });
    expect(r.isDirect).toBe(false);
    expect(r.takeHome).toBe(850);
    expect(r.platformFee).toBe(150);
  });

  it("waived first-job fee shows the full price as take-home", () => {
    const r = computeBookingTakeHome({
      totalPrice: 1000,
      depositPaid: 150,
      balanceDue: 850,
      source: "platform",
      metadata: { fee_waived: "true", platform_fee_cents: "0", installer_receives_cents: "15000", installer_stripe_id: "acct_1" },
    });
    expect(r.feeWaived).toBe(true);
    expect(r.takeHome).toBe(1000);
    expect(r.feeRateLabel).toBeNull();
  });

  it("subtracts a referral partner cut", () => {
    const r = computeBookingTakeHome({
      totalPrice: 1000,
      depositPaid: 150,
      balanceDue: 850,
      source: "installer_manual",
      metadata: { platform_fee_cents: "3000", platform_fee_rate: "3%", partner_cut_cents: "2000", installer_receives_cents: "10000", installer_stripe_id: "acct_1" },
    });
    expect(r.takeHome).toBe(950);
    expect(r.partnerCut).toBe(20);
  });

  it("falls back to the source rate when the deposit wasn't split", () => {
    const direct = computeBookingTakeHome({ totalPrice: 1499, depositPaid: 224.85, source: "partner_link", metadata: {} });
    expect(direct.takeHome).toBe(1454.03);
    expect(direct.fromDeposit).toBeNull();
    expect(direct.balanceToCollect).toBe(1274.15);

    const network = computeBookingTakeHome({ totalPrice: 1000, depositPaid: 150, source: null });
    expect(network.isDirect).toBe(false);
    expect(network.takeHome).toBe(850);
  });
});
