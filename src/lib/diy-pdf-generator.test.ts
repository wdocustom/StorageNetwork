import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateDIYPlan } from "@/app/actions/generate-plan";
import { generateDIYPDF, groupBoards, pdfText } from "./diy-pdf-generator";

async function plan(cols: number, rows: number, hasWheels: boolean, hasTop: boolean) {
  return generateDIYPlan(
    { cols, rows, toteType: "HDX", unitType: "standard", orientation: "standard", hasWheels, hasTop },
    `${cols}×${rows} Tote Organizer`,
  );
}

describe("generateDIYPDF", () => {
  it("gives every guide step its own page after cover, prep and cut plan", async () => {
    const p = await plan(4, 4, true, true);
    const doc = generateDIYPDF({ plan: p, snapshots: [] });
    // cover + before-you-start + cut plan (at least) + one page per step
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3 + p.assemblySteps.length);
  });

  it("covers the conditional caster and top steps only when configured", async () => {
    const full = await plan(3, 3, true, true);
    const bare = await plan(3, 3, false, false);
    const ids = (s: typeof full) => s.assemblySteps.map((step) => step.id);
    expect(ids(full)).toEqual(expect.arrayContaining(["attach-casters", "attach-top"]));
    expect(ids(bare)).not.toContain("attach-casters");
    expect(ids(bare)).not.toContain("attach-top");
  });
});

describe("groupBoards", () => {
  it("collapses identical boards and keeps first-seen order", () => {
    const board = (i: number, cuts: number[]) => ({
      boardIndex: i,
      stockLength: 96,
      cuts: cuts.map((length) => ({ length, label: length > 80 ? "Plate" : "Post" })),
      remainder: 96 - cuts.reduce((a, b) => a + b, 0),
    });
    const groups = groupBoards([board(1, [86.5]), board(2, [86.5]), board(3, [64]), board(4, [64]), board(5, [64])]);
    expect(groups.map((g) => [g.count, g.board.cuts[0].length])).toEqual([
      [2, 86.5],
      [3, 64],
    ]);
  });
});

describe("pdfText", () => {
  it("maps build-engine symbols the PDF font can't encode", () => {
    expect(pdfText('1 ⅝" screws → frame')).toBe('1 5/8" screws -> frame');
    expect(pdfText("2×4 — 86-1/2\"")).toBe("2×4 — 86-1/2\"");
    expect(pdfText("ok ✓")).toBe("ok ");
  });
});
