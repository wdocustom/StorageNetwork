import { describe, expect, it } from "vitest";
import type { CompoundBuildResult } from "@/app/actions/calculator";
import type { UnitConfig } from "@/hooks/configurator/types";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import {
  DEFAULT_TOTE_UNIT,
  miniAvailable,
  normalizeToteUnit,
  presetOfItem,
  presetOrderItem,
  presetTotesChoice,
  pruneAddons,
  studioItemKind,
  studioPaintCost,
  studioMaxRows,
  studioSystemSize,
  toteUnitDesc,
  toteUnitSignature,
} from "./studio";

const RULES = { use2x4Rails: false, totesDisabled: false, miniEnabled: true };
const line = (over: Partial<UnitConfig> = {}): UnitConfig => ({
  ...DEFAULT_TOTE_UNIT,
  price: 320,
  totalW: 86.5,
  totalH: 69.5,
  depth: 30,
  desc: "Standard: 4W × 4H",
  addons: [],
  ...over,
});

describe("normalizeToteUnit — the configurator's effective options", () => {
  it("gives minis a top and standard orientation", () => {
    const o = normalizeToteUnit({ ...DEFAULT_TOTE_UNIT, unitType: "mini", orientation: "sideways", hasTop: false }, RULES);
    expect(o).toMatchObject({ unitType: "mini", orientation: "standard", hasTop: true });
  });

  it("only allows clear totes on included HDX totes of a standard unit", () => {
    const clear = { ...DEFAULT_TOTE_UNIT, toteColor: "clear" as const };
    expect(normalizeToteUnit({ ...clear, hasTotes: true }, RULES).toteColor).toBe("clear");
    expect(normalizeToteUnit({ ...clear, hasTotes: false }, RULES).toteColor).toBe("black");
    expect(normalizeToteUnit({ ...clear, hasTotes: true, toteType: "GM" }, RULES).toteColor).toBe("black");
  });

  it("drops totes and minis the installer doesn't offer", () => {
    expect(normalizeToteUnit({ ...DEFAULT_TOTE_UNIT, hasTotes: true }, { ...RULES, totesDisabled: true }).hasTotes).toBe(false);
    expect(normalizeToteUnit({ ...DEFAULT_TOTE_UNIT, unitType: "mini" }, { ...RULES, miniEnabled: false }).unitType).toBe("standard");
    expect(normalizeToteUnit({ ...DEFAULT_TOTE_UNIT, unitType: "mini" }, { ...RULES, use2x4Rails: true }).unitType).toBe("standard");
    expect(miniAvailable({ ...RULES, totesDisabled: true })).toBe(false);
  });

  it("keeps sizes inside the configurator's limits", () => {
    expect(studioMaxRows("standard", false)).toBe(10);
    expect(studioMaxRows("standard", true)).toBe(6);
    expect(studioMaxRows("mini", false)).toBe(4);
    expect(normalizeToteUnit({ ...DEFAULT_TOTE_UNIT, cols: 40, rows: 9 }, { ...RULES, use2x4Rails: true })).toMatchObject({ cols: 12, rows: 6 });
    expect(normalizeToteUnit({ ...DEFAULT_TOTE_UNIT, cols: 0, rows: -2 }, RULES)).toMatchObject({ cols: 1, rows: 1 });
  });
});

describe("cart lines", () => {
  it("describes tote units exactly like Add to quote", () => {
    expect(toteUnitDesc(DEFAULT_TOTE_UNIT)).toBe("Standard: 4W × 4H");
    expect(toteUnitDesc({ ...DEFAULT_TOTE_UNIT, orientation: "sideways", cols: 3, rows: 5 })).toBe("Standard (Sideways): 3W × 5H");
    expect(toteUnitDesc({ ...DEFAULT_TOTE_UNIT, hasTotes: true, toteColor: "clear" })).toBe("Standard: 4W × 4H (Clear Totes)");
    expect(toteUnitDesc({ ...DEFAULT_TOTE_UNIT, unitType: "mini" })).toBe("Mini: 4W × 4H");
  });

  it("re-prices when any priced option changes, not for price or quantity", () => {
    const sig = toteUnitSignature(line());
    expect(toteUnitSignature(line({ price: 999, quantity: 3 }))).toBe(sig);
    expect(toteUnitSignature(line({ hasWheels: true }))).not.toBe(sig);
    expect(toteUnitSignature(line({ rows: 5 }))).not.toBe(sig);
  });

  it("builds a bestseller line the way the configurator always has, and finds it again", () => {
    const joe = BESTSELLER_PRESETS.find((p) => p.id === "indiana-joe")!;
    const build: CompoundBuildResult = {
      success: true,
      presetId: "indiana-joe",
      presetName: "Indiana Joe",
      totalPrice: 800,
      subUnits: [
        { cols: 2, rows: 4, price: 300, totalW: 46.5, totalH: 69.5, depth: 30, slots: 8 },
        { cols: 2, rows: 2, price: 200, totalW: 46.5, totalH: 37.5, depth: 30, slots: 4 },
        { cols: 2, rows: 4, price: 300, totalW: 46.5, totalH: 69.5, depth: 30, slots: 8 },
      ],
      combinedW: 139.5,
      maxH: 69.5,
      depth: 30,
      totalSlots: 20,
    };
    const item = presetOrderItem(joe, build, true);
    expect(item).toMatchObject({ cols: 6, rows: 4, price: 800, totalW: 139.5, desc: "Indiana Joe (2x4 + 2x2 + 2x4)", hasTotes: true, hasTop: true });
    expect(item.presetUnits).toHaveLength(3);
    expect(studioItemKind(item)).toBe("bestseller");
    expect(presetOfItem(item)?.id).toBe("indiana-joe");
    expect(presetOfItem(line())).toBeUndefined();
  });

  it("follows each bestseller's tote rules", () => {
    for (const p of BESTSELLER_PRESETS) {
      expect(presetTotesChoice(p, true)).toBe("never");
      if (p.totesDisabled) expect(presetTotesChoice(p, false)).toBe("never");
      else if (p.totesAreMandatory) expect(presetTotesChoice(p, false)).toBe("always");
      else expect(presetTotesChoice(p, false)).toBe("choice");
    }
  });
});

describe("studioSystemSize", () => {
  it("adds up racks side by side, counting quantities, and ignores other products", () => {
    const size = studioSystemSize([
      line({ quantity: 2 }),
      line({ cols: 2, rows: 2, totalW: 46.5, totalH: 37.5 }),
      line({ chairConfig: { finish: "natural" } as UnitConfig["chairConfig"], totalW: 30, totalH: 34 }),
    ]);
    expect(size).toEqual({ widthIn: 86.5 * 2 + 46.5, heightIn: 69.5, slots: 16 * 2 + 4 });
    expect(studioSystemSize([])).toBeNull();
  });
});

describe("paint and organizers on a unit", () => {
  const prices = { frame: 75, doorsPanels: 30 };

  it("prices paint per unit, the amounts the quote card lists", () => {
    expect(studioPaintCost({}, prices)).toBe(0);
    expect(studioPaintCost({ paintFrameColor: "red" }, prices)).toBe(75);
    expect(studioPaintCost({ paintFrameColor: "red", paintDoorColor: "white", paintSidePanelColor: "black" }, prices)).toBe(135);
    expect(studioPaintCost({ paintFrameColor: null, paintDoorColor: "white" }, prices)).toBe(30);
  });

  it("drops organizer add-ons for bays and tiers a resize removed", () => {
    const addons = [
      { type: "plywood_door" as const, target: "doors_on" as const },
      { type: "side_panel" as const, target: "left" as const },
      { type: "shelf" as const, target: 3, row: 1 },
      { type: "rail_removed" as const, target: 1, row: 4 },
      { type: "shelf" as const, target: 0, row: 0 },
    ];
    expect(pruneAddons(addons, 4, 5)).toEqual(addons);
    expect(pruneAddons(addons, 3, 4)).toEqual([addons[0], addons[1], addons[4]]);
    expect(pruneAddons(undefined, 4, 4)).toEqual([]);
  });
});
