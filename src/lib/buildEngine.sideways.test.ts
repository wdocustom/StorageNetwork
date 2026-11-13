import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateBuildManifest } from "./buildEngine";
import type { QuoteUnit } from "./buildEngine.types";
import { splitModuleWidths } from "./module-split";

const unit = (over: Partial<QuoteUnit>): QuoteUnit => ({
  cols: 4,
  rows: 4,
  toteType: "HDX",
  unitType: "standard",
  orientation: "standard",
  hasTotes: false,
  hasWheels: false,
  hasTop: false,
  price: 0,
  totalW: 0,
  totalH: 0,
  depth: 30,
  desc: "",
  ...over,
});

const longestCut = (q: QuoteUnit) =>
  Math.max(...(generateBuildManifest([q]).stock_boards ?? []).flatMap((b) => b.cuts.map((c) => c.len)));

describe("installer cut list — sideways racks", () => {
  it("splits sideways racks at 2 wide, standard at 4", () => {
    expect(splitModuleWidths(5, "sideways")).toEqual([2, 2, 1]);
    expect(splitModuleWidths(5, "standard")).toEqual([4, 1]);
    expect(splitModuleWidths(5)).toEqual([4, 1]);
  });

  it("never asks for a plate longer than an 8' board, with either rail style", () => {
    for (const use2x4Rails of [false, true]) {
      for (const cols of [2, 3, 4, 7]) {
        const q = unit({ cols, orientation: "sideways", depth: 20, use2x4Rails });
        expect(longestCut(q), `${cols} wide, 2x4 rails ${use2x4Rails}`).toBeLessThanOrEqual(96);
        expect((generateBuildManifest([q]).stock_boards ?? []).every((b) => b.rem >= 0)).toBe(true);
      }
    }
  });

  it("leaves standard racks as they were (4 wide = one 91-1/2\" plate)", () => {
    expect(longestCut(unit({ cols: 4, use2x4Rails: true }))).toBe(91.5);
  });
});
