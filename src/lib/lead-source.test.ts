import { describe, it, expect } from "vitest";
import {
  platformFeeRateForSource,
  isDirectLeadSource,
  isLockedPlatformSource,
} from "./lead-source";

describe("platformFeeRateForSource", () => {
  it("bills the installer's own link and manual quotes at 3%", () => {
    expect(platformFeeRateForSource("partner_link")).toBe(0.03);
    expect(platformFeeRateForSource("installer_manual")).toBe(0.03);
  });

  it("bills platform-driven sources at 15%", () => {
    expect(platformFeeRateForSource("platform")).toBe(0.15);
    expect(platformFeeRateForSource("facebook_referral")).toBe(0.15);
    expect(platformFeeRateForSource("platform_campaign")).toBe(0.15);
  });

  it("never falls through to the direct rate for unknown or missing sources", () => {
    expect(platformFeeRateForSource(null)).toBe(0.15);
    expect(platformFeeRateForSource(undefined)).toBe(0.15);
    expect(platformFeeRateForSource("something_new")).toBe(0.15);
  });
});

describe("source classification", () => {
  it("treats a campaign lead as not direct", () => {
    expect(isDirectLeadSource("platform_campaign")).toBe(false);
  });

  it("locks campaign leads so a client can't downgrade them", () => {
    expect(isLockedPlatformSource("platform_campaign")).toBe(true);
    expect(isLockedPlatformSource("partner_link")).toBe(false);
    expect(isLockedPlatformSource(null)).toBe(false);
  });
});
