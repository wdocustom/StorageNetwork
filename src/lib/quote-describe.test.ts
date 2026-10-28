import { describe, expect, it } from "vitest";
import { describeQuote } from "./quote-describe";

describe("describeQuote", () => {
  it("strips prices and groups identical units", () => {
    const q = [
      { desc: "4×2 Work Bench w/ Totes, Wheels & Top (custom $0.02)" },
      { desc: "4×2 Work Bench w/ Totes, Wheels & Top (custom $0.02)" },
    ];
    expect(describeQuote(q)).toBe("2 × 4×2 Work Bench w/ Totes, Wheels & Top");
  });

  it("keeps a count already in the desc and drops 'total' prices", () => {
    expect(describeQuote([{ desc: "22 × 4x2 Work Benches w/ Wheels (total $5907)" }])).toBe("22 × 4x2 Work Benches w/ Wheels");
  });

  it("caps long quotes and ignores junk", () => {
    const q = ["A", "B", "C", "D"].map((d) => ({ desc: `Unit ${d}` }));
    expect(describeQuote(q, 2)).toBe("Unit A + Unit B + more");
    expect(describeQuote(null)).toBe("");
    expect(describeQuote([{ nope: 1 }])).toBe("");
  });
});
