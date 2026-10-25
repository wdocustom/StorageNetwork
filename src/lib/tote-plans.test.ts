import { describe, expect, it } from "vitest";
import {
  TOTE_PLAN_TIERS,
  TOTE_PLAN_UPGRADE_PRICE,
  decodeTotePlanConfig,
  encodeTotePlanConfig,
  formatPlanPrice,
  isTotePlanTier,
  parseTotePlanConfig,
} from "./tote-plans";

const base = { cols: 4, rows: 4, toteType: "HDX", hasWheels: true, hasTop: true };

describe("parseTotePlanConfig", () => {
  it("keeps only the fields the plan needs", () => {
    expect(
      parseTotePlanConfig({ ...base, unitType: "standard", orientation: "standard", totalW: 86.5, installerName: "X" }),
    ).toEqual(base);
  });

  it("rejects units the guide can't model", () => {
    expect(parseTotePlanConfig({ ...base, unitType: "mini" })).toBeNull();
    expect(parseTotePlanConfig({ ...base, orientation: "sideways" })).toBeNull();
    expect(parseTotePlanConfig({ ...base, cols: 5 })).toBeNull();
    expect(parseTotePlanConfig({ ...base, rows: 7 })).toBeNull();
    expect(parseTotePlanConfig({ ...base, cols: 0 })).toBeNull();
    expect(parseTotePlanConfig({ ...base, cols: 2.5 })).toBeNull();
    expect(parseTotePlanConfig({ ...base, toteType: "Sterilite" })).toBeNull();
    expect(parseTotePlanConfig(null)).toBeNull();
    expect(parseTotePlanConfig("4x4")).toBeNull();
  });

  it("treats anything but literal true as no casters / no top", () => {
    expect(parseTotePlanConfig({ ...base, hasWheels: "true", hasTop: 1 })).toMatchObject({
      hasWheels: false,
      hasTop: false,
    });
  });
});

describe("encode/decode", () => {
  it("round-trips through a URL param, raw or already decoded", () => {
    const config = parseTotePlanConfig(base)!;
    const encoded = encodeTotePlanConfig(config);
    expect(decodeTotePlanConfig(encoded)).toEqual(config);
    expect(decodeTotePlanConfig(decodeURIComponent(encoded))).toEqual(config);
  });

  it("returns null for junk", () => {
    expect(decodeTotePlanConfig(null)).toBeNull();
    expect(decodeTotePlanConfig("%E0%A4%A")).toBeNull();
    expect(decodeTotePlanConfig("{not json")).toBeNull();
  });
});

describe("tiers", () => {
  it("prices the upgrade as the difference between tiers", () => {
    expect(TOTE_PLAN_UPGRADE_PRICE).toBe(TOTE_PLAN_TIERS.interactive.price - TOTE_PLAN_TIERS.pdf.price);
    expect(TOTE_PLAN_UPGRADE_PRICE).toBeGreaterThan(0);
  });

  it("recognizes tier ids", () => {
    expect(isTotePlanTier("pdf")).toBe(true);
    expect(isTotePlanTier("interactive")).toBe(true);
    expect(isTotePlanTier("pro")).toBe(false);
    expect(isTotePlanTier(undefined)).toBe(false);
  });

  it("formats prices", () => {
    expect(formatPlanPrice(1900)).toBe("$19");
    expect(formatPlanPrice(1950)).toBe("$19.50");
  });
});

describe("wall fit", () => {
  it("matches the plan generator's finished size", async () => {
    const { totePlanOuterSize } = await import("./tote-plans");
    // 4×4 HDX on casters: 86-1/2" W × 72-1/4" H (same as the PDF cover)
    expect(totePlanOuterSize({ cols: 4, rows: 4, toteType: "HDX", hasWheels: true, hasTop: true })).toEqual({
      widthIn: 86.5,
      heightIn: 72.25,
    });
  });

  it("picks the largest grid that fits, capped at plan limits", async () => {
    const { fitTotePlanToWall } = await import("./tote-plans");
    expect(fitTotePlanToWall(86.5, 72.25, { toteType: "HDX", hasWheels: true })).toEqual({ cols: 4, rows: 4 });
    expect(fitTotePlanToWall(86, 72, { toteType: "HDX", hasWheels: true })).toEqual({ cols: 3, rows: 3 });
    expect(fitTotePlanToWall(400, 200, { toteType: "GM", hasWheels: false })).toEqual({ cols: 4, rows: 6 });
    expect(fitTotePlanToWall(15, 100, { toteType: "HDX", hasWheels: false })).toBeNull();
    expect(fitTotePlanToWall(NaN, 100, { toteType: "HDX", hasWheels: false })).toBeNull();
  });
});
