import { describe, expect, it } from "vitest";
import { buildQuoteEmailTemplate } from "./customerTemplates";
import { diyPlansEmailBlock, diyPlansEmailUrl } from "./plansTemplates";

describe("DIY plans links in build / quote emails", () => {
  it("links a saved quote's exact design, bestsellers included", () => {
    const url = diyPlansEmailUrl(
      [
        {
          cols: 2,
          rows: 4,
          toteType: "HDX",
          unitType: "standard",
          orientation: "standard",
          hasWheels: false,
          hasTop: true,
          desc: "Indiana Joe (2×4 + 2×2 + 2×4 — 20 slots, Totes, Top)",
        },
        { cols: 6, rows: 6, toteType: "HDX", unitType: "standard", orientation: "standard", hasWheels: false, hasTop: true },
      ],
      "quote_email",
    );
    expect(url).toMatch(/\/plans\/checkout\?design=H2x4t\.H2x2t\.H2x4t\.H6x6t&utm_source=quote_email$/);
  });

  it("has no link when nothing in the quote is plannable", () => {
    expect(diyPlansEmailUrl([{ shelvingConfigId: "shelf-48" }], "quote_email")).toBeNull();
    expect(diyPlansEmailUrl(null, "quote_email")).toBeNull();
    expect(diyPlansEmailBlock(null)).toBe("");
  });

  it("adds the footer to the quote email only when there's a link", () => {
    const base = {
      customerName: "Test Customer",
      businessName: "Rack City Totes",
      quoteItems: [{ description: "4×4", price: 480 }],
      totalPrice: 480,
      depositAmount: 72,
      checkoutUrl: "https://example.com/pay/abc",
    };
    const url = "https://example.com/plans/checkout?design=H4x4wt&utm_source=quote_email";
    expect(buildQuoteEmailTemplate({ ...base, diyPlansUrl: url })).toContain(url);
    expect(buildQuoteEmailTemplate({ ...base, diyPlansUrl: url })).toContain("Prefer to build it yourself?");
    expect(buildQuoteEmailTemplate(base)).not.toContain("Prefer to build it yourself?");
  });
});
