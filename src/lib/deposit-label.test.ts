import { describe, it, expect } from "vitest";
import { depositPercentLabel } from "./deposit-label";

describe("depositPercentLabel", () => {
  it("returns the real percentage for whole-percent deposits", () => {
    expect(depositPercentLabel(160, 400)).toBe("40%");
    expect(depositPercentLabel(150, 1000)).toBe("15%");
    expect(depositPercentLabel(250, 1000)).toBe("25%");
  });

  it("tolerates cent rounding", () => {
    expect(depositPercentLabel(52.35, 349)).toBe("15%");
  });

  it("returns null when the deposit isn't a whole percentage (flat deposits)", () => {
    expect(depositPercentLabel(200, 1050)).toBeNull();
  });

  it("returns null for unusable input", () => {
    expect(depositPercentLabel(0, 400)).toBeNull();
    expect(depositPercentLabel(100, 0)).toBeNull();
    expect(depositPercentLabel(NaN, 400)).toBeNull();
  });
});
