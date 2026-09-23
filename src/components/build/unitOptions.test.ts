import { describe, it, expect } from "vitest";
import { optionPriceDelta, slotsOf } from "./unitOptions";

describe("slotsOf", () => {
  it("uses cols × rows for a plain unit", () => {
    expect(slotsOf({ cols: 4, rows: 4, desc: "4W × 4H Standard Unit" })).toBe(16);
  });
  it("reads the real slot count from a saved bestseller line", () => {
    expect(slotsOf({ cols: 4, rows: 4, desc: "Indiana Joe (4×4 + 4×4 + 4×4 — 48 slots, Totes)" })).toBe(48);
  });
});

describe("optionPriceDelta", () => {
  const unit = { cols: 4, rows: 4, desc: "4W × 4H Standard Unit" };

  it("prices a top or wheels as the calculator difference", () => {
    expect(optionPriceDelta("top", 555, 650, unit)).toBe(95);
    expect(optionPriceDelta("wheels", 555, 620, unit)).toBe(65);
  });

  it("prices totes for the unit's slots", () => {
    expect(optionPriceDelta("totes", 480, 672, unit)).toBe(192); // 16 × $12
  });

  it("scales totes to a bestseller's full slot count", () => {
    const preset = { cols: 4, rows: 4, desc: "Indiana Joe (4×4 + 4×4 + 4×4 — 48 slots)" };
    expect(optionPriceDelta("totes", 480, 672, preset)).toBe(576); // 48 × $12
  });
});
