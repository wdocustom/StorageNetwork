import { describe, it, expect } from "vitest";
import { buildQuoteEmailTemplate } from "./customerTemplates";

// Regression test for the delivery-fee double count: totalPrice passed to the
// template already includes the delivery fee (createQuote's finalTotal =
// build + indoor delivery + delivery fee), so the template must not add
// deliveryFee again when computing the total estimate.
describe("buildQuoteEmailTemplate", () => {
  const baseData = {
    customerName: "Test Customer",
    businessName: "Rack City Totes",
    quoteItems: [
      { description: "4×3 Rack w/ Wheels & Top, No Totes (custom $300)", price: 300 },
    ],
    totalPrice: 349, // $300 build + $49 delivery fee, as createQuote sends it
    depositAmount: 52.35,
    checkoutUrl: "https://example.com/pay/abc",
    deliveryFee: 49,
    estimatedTax: { amount: 15.9, rate: 0.053, stateCode: "VA" },
  };

  it("does not double-count the delivery fee in the total estimate", () => {
    const html = buildQuoteEmailTemplate(baseData);

    // Subtotal is the build-only price, delivery fee is its own line
    expect(html).toContain("$300.00");
    expect(html).toContain("$49.00");
    // Total = 349 + 15.90 tax, NOT 349 + 49 + 15.90
    expect(html).toContain("$364.90");
    expect(html).not.toContain("$413.90");
    // Remaining after deposit = 364.90 - 52.35
    expect(html).toContain("$312.55");
  });

  it("omits the delivery fee line when there is no delivery fee", () => {
    const html = buildQuoteEmailTemplate({
      ...baseData,
      totalPrice: 300,
      deliveryFee: 0,
    });

    expect(html).not.toContain("Delivery Fee");
    expect(html).toContain("$315.90"); // 300 + 15.90 tax
  });
});
