import { describe, expect, it } from "vitest";
import { detectDensityTier, sameCountryRadius } from "./territory-tiers";
import { countryOfPostal } from "./postal";

describe("sameCountryRadius", () => {
  it("never crosses the border (Detroit ↔ Windsor)", () => {
    const detroit = sameCountryRadius("48226", 15);
    expect(detroit.length).toBeGreaterThan(0);
    expect(detroit.every((z) => countryOfPostal(z) === "US")).toBe(true);

    const windsor = sameCountryRadius("N9A", 15);
    expect(windsor.length).toBeGreaterThan(0);
    expect(windsor.every((z) => countryOfPostal(z) === "CA")).toBe(true);
  });
});

describe("detectDensityTier", () => {
  it("uses Canadian calibration for FSAs", () => {
    expect(detectDensityTier("M5V").label).toBe("urban_core"); // downtown Toronto
    expect(detectDensityTier("T2P").label).toBe("urban");      // Calgary
    expect(detectDensityTier("S7K").label).toBe("suburban");   // Saskatoon
    expect(detectDensityTier("V2C").label).toBe("rural");      // Kamloops
  });
  it("keeps US calibration for ZIPs", () => {
    expect(detectDensityTier("10001").label).toBe("urban_core");
    expect(detectDensityTier("59801").label).toBe("rural");
  });
});
