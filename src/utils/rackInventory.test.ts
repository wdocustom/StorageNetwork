import { describe, it, expect } from "vitest";
import { isInventoryRackUnit } from "./rackInventory";

const rack = (over: Record<string, unknown> = {}) => ({
  cols: 4, rows: 3, hasTotes: true, ...over,
});

describe("isInventoryRackUnit", () => {
  it("qualifies a rack the installer supplied totes for", () => {
    expect(isInventoryRackUnit(rack())).toBe(true);
  });

  it("qualifies a rack sold WITHOUT installer-supplied totes", () => {
    // The whole point: hasTotes records who bought the bins, not whether the
    // customer wants to catalog them. This was 17 of 44 paid jobs.
    expect(isInventoryRackUnit(rack({ hasTotes: false }))).toBe(true);
  });

  it("qualifies a frame-only 2x4-rail build", () => {
    expect(
      isInventoryRackUnit(rack({ hasTotes: false, use2x4Rails: true, hasTop: true, hasWheels: true }))
    ).toBe(true);
  });

  it("qualifies regardless of who created the quote", () => {
    // source lives on the lead, not the unit — nothing here may depend on it.
    expect(isInventoryRackUnit(rack({ hasTotes: false }))).toBe(true);
    expect(isInventoryRackUnit(rack({ hasTotes: true }))).toBe(true);
  });

  it("accepts the legacy width/height aliases", () => {
    expect(isInventoryRackUnit({ width: 5, height: 2 })).toBe(true);
  });

  // ── Non-rack products: all written with cols: 0, rows: 0 ────────────────
  it.each([
    ["open shelving", { cols: 0, rows: 0, shelvingConfigId: "shelf-8ft" }],
    ["adirondack chair", { cols: 0, rows: 0, chairId: "low-boy" }],
    ["raised bed", { cols: 0, rows: 0 }],
    ["custom line item", { cols: 0, rows: 0 }],
  ])("excludes %s", (_label, unit) => {
    expect(isInventoryRackUnit(unit)).toBe(false);
  });

  it("excludes overhead ceiling grids even though they carry cols/rows", () => {
    expect(
      isInventoryRackUnit({ cols: 3, rows: 2, overheadGridPresetId: "overhead-3x2" })
    ).toBe(false);
  });

  it("excludes a shelving unit that still carries cols/rows", () => {
    expect(isInventoryRackUnit({ cols: 4, rows: 3, shelvingConfigId: "x" })).toBe(false);
  });

  it("handles missing and malformed units", () => {
    expect(isInventoryRackUnit(null)).toBe(false);
    expect(isInventoryRackUnit(undefined)).toBe(false);
    expect(isInventoryRackUnit({})).toBe(false);
    expect(isInventoryRackUnit({ cols: 4 })).toBe(false);
    expect(isInventoryRackUnit({ rows: 3 })).toBe(false);
  });
});
