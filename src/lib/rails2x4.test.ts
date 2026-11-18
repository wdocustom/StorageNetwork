import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { RAIL_2X4_H, railCenterFromBottom, railTopFromBottom, railTops2x4 } from "./rails2x4";
import { frameGeometry } from "@/components/visualizer/AssemblyGuide";

const PLY_H = 1.875;
const topsOf = (centers: number[], h: number) => centers.map((c) => +(c + h / 2).toFixed(4));

describe("rails are placed by their TOP edge, from the bottom of the upright", () => {
  it("13\", then every 16\"", () => {
    expect([0, 1, 2, 3, 4, 5].map(railTopFromBottom)).toEqual([13, 29, 45, 61, 77, 93]);
    expect(railTops2x4(4)).toEqual([13, 29, 45, 61]);
    expect(railCenterFromBottom(0, PLY_H)).toBeCloseTo(13 - PLY_H / 2);
  });

  it("2×4 and plywood rails land at the same top edges in the 3D guide", () => {
    for (const rows of [1, 4, 6]) {
      const ply = frameGeometry(4, rows, "HDX", "plywood");
      const two = frameGeometry(4, rows, "HDX", "2x4");
      const expected = Array.from({ length: rows }, (_, r) => railTopFromBottom(r));
      expect(topsOf(ply.railCenters, ply.railH)).toEqual(expected);
      expect(topsOf(two.railCenters, two.railH)).toEqual(expected);
    }
  });

  it("keeps the plywood upright length (rows × 16\")", () => {
    const ply = frameGeometry(4, 4, "HDX", "plywood");
    expect(ply.postH).toBe(64);
    expect(RAIL_2X4_H).toBeLessThan(PLY_H);
  });
});
