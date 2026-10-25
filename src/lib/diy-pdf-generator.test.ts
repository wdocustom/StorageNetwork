import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateDIYPlan } from "@/app/actions/generate-plan";
import { generateBuildManifest } from "@/lib/buildEngine";
import { decodeTotePlanDesign } from "@/lib/tote-plans";
import { generateDIYPDF, groupBoards, pdfText } from "./diy-pdf-generator";

const plan = (code: string) => generateDIYPlan(decodeTotePlanDesign(code)!);

describe("generateDIYPlan", () => {
  it("cuts exactly the boards the build engine counts, for every module", async () => {
    for (const code of ["H4x4wt", "H6x6t", "H2x4t.H2x2t.H2x4t", "H9x10t", "G4x8w"]) {
      const p = await plan(code);
      // uprights + plates (packed) and rail boards add up to the engine's 2×4 total
      expect(p.cutBoards.length + p.railBoards.boards).toBe(p.totals.boards);
      const labels = new Set(p.cutBoards.flatMap((b) => b.cuts.map((c) => c.label.split(" ")[0])));
      expect([...labels].sort()).toEqual(p.moduleTypes.map((t) => t.letter).sort());
    }
  });

  it("splits into the same modules as the installer cut plans", async () => {
    for (const code of ["H6x6t", "H9x10t", "H2x4t.H2x2t.H2x4t"]) {
      const design = decodeTotePlanDesign(code)!;
      const p = await generateDIYPlan(design);
      // Plywood-mode engine run: same module split rules, and it stacks tiers
      const manifest = generateBuildManifest(
        design.units.map((u) => ({
          ...u,
          unitType: "standard" as const,
          orientation: "standard" as const,
          hasTotes: true,
          price: 0,
          totalW: 0,
          totalH: 0,
          depth: 30,
          desc: "",
        })),
      );
      const engine = manifest.cut_plan_visuals.map((m) => `${m.cols}x${m.rows}`).sort();
      const ours = p.units.flatMap((u) => u.modules.map((m) => `${m.cols}x${m.rows}`)).sort();
      expect(ours).toEqual(engine);
    }
  });

  it("covers the conditional caster and top steps only when configured", async () => {
    const ids = (p: Awaited<ReturnType<typeof plan>>) => p.moduleTypes[0].steps.map((s) => s.id);
    expect(ids(await plan("H3x3wt"))).toEqual(expect.arrayContaining(["attach-casters", "attach-top"]));
    const bare = ids(await plan("H3x3"));
    expect(bare).not.toContain("attach-casters");
    expect(bare).not.toContain("attach-top");
  });

  it("adds joining, worktop and anchoring steps for a big wall", async () => {
    const p = await plan("H6x6t"); // 150" × 104" wall
    expect(p.moduleTypes.map((t) => `${t.letter}:${t.cols}x${t.rows}`)).toEqual(["A:4x6", "B:2x6"]);
    // The worktop spans both modules, so it moves out of the module steps
    expect(p.moduleTypes.every((t) => !t.steps.some((s) => s.id === "attach-top"))).toBe(true);
    expect(p.units[0].assemblySteps.map((s) => s.id)).toEqual(["join-tier-1", "attach-unit-top", "anchor-to-wall"]);
    const top = p.units[0].assemblySteps.find((s) => s.id === "attach-unit-top")!;
    expect(top.instruction).toContain("2 pieces"); // 130-1/2" is wider than one sheet
  });

  it("stacks tiers in order and never anchors a rolling unit", async () => {
    const p = await plan("H8x8w");
    expect(p.units[0].assemblySteps.map((s) => s.id)).toEqual(["join-tier-1", "stack-tier-2", "join-tier-2"]);
    expect(p.shoppingList.find((i) => i.name === "Caster Kits")?.qty).toBe(2); // one set per bottom module
  });

  it("gives short single-module units no extra assembly steps", async () => {
    const p = await plan("H2x4t.H2x2t.H2x4t");
    expect(p.units.every((u) => u.assemblySteps.length === 0)).toBe(true);
  });

  it("anchors any tall stationary unit, even a single module", async () => {
    const p = await plan("H4x6t"); // 101-1/2" tall, one module
    expect(p.units[0].assemblySteps.map((s) => s.id)).toEqual(["anchor-to-wall"]);
    expect(p.moduleTypes[0].steps.some((s) => s.id === "attach-top")).toBe(true);
  });

  it("builds every module with 2×4 rails, never plywood strips or back supports", async () => {
    for (const code of ["H4x4wt", "H6x6t", "G4x8w"]) {
      const p = await plan(code);
      for (const t of p.moduleTypes) {
        const ids = t.steps.map((s) => s.id);
        expect(ids).not.toContain("install-back-supports");
        const rip = t.steps.find((s) => s.id === "rip-rails")!;
        expect(rip.title).toBe("Rip the 2×4 Rails");
        expect(rip.instruction).toContain('1-11/16"');
        const ladders = t.steps.find((s) => s.id === "build-ladders")!;
        expect(ladders.screwType?.label).toBe('#9 × 3" Star Drive');
        expect(ladders.materials.find((m) => m.name === '#9 × 3" Screws')?.qty).toBe(String(t.cols * t.rows * 2 * 4));
        expect(t.parts.map((x) => x.name)).toEqual(t.hasTop ? ["Upright", "Plate", "Rail", "Worktop"] : ["Upright", "Plate", "Rail"]);
      }
      expect(JSON.stringify(p)).not.toMatch(/plywood (rail|strip)|back support/i);
    }
  });

  it("marks rail top edges on a 15-3/4 inch pitch and uses full studs at 6 high", async () => {
    const four = (await plan("H4x4")).moduleTypes[0];
    expect(four.steps.find((s) => s.id === "mark-posts")!.instruction).toContain('14-5/8", 30-3/8", 46-1/8" and 61-7/8"');
    expect(four.steps.find((s) => s.id === "cut-uprights")!.instruction).toContain('63-3/4"');
    const six = (await plan("H4x6")).moduleTypes[0];
    expect(six.steps.find((s) => s.id === "cut-uprights")!.instruction).toContain("no cut needed");
    expect(six.parts[0].length).toContain("full stud");
  });

  it("counts rail boards at 6 rails per board and only buys plywood for worktops", async () => {
    const p = await plan("H4x4");
    expect(p.railBoards).toEqual({ boards: 6, rails: 32 });
    expect(p.shoppingList.some((i) => i.name === "Plywood")).toBe(false);
    expect(p.shoppingList.some((i) => i.name.includes('1-5/8"'))).toBe(false);
    const withTop = await plan("H4x4t");
    expect(withTop.shoppingList.find((i) => i.name === "Plywood")?.qty).toBe(1);
  });

  it("resolves every template token in the text customers read", async () => {
    const p = await plan("H9x10t");
    const text = JSON.stringify([p.moduleTypes, p.units]);
    expect(text).not.toMatch(/OPENING_SPAN|PLATE_LENGTH|UPRIGHT_HEIGHT|UPRIGHT_CUT|UPRIGHT_DETAIL|RAIL_MARKS|_QTY|RAIL_LENGTH|UNIT_WIDTH/);
  });
});

describe("generateDIYPDF", () => {
  it("gives every step of every module type its own page", async () => {
    const p = await plan("H2x4t.H2x2t.H2x4t");
    const steps = p.moduleTypes.reduce((s, t) => s + t.steps.length, 0);
    const doc = generateDIYPDF({ plan: p, snapshots: {} });
    // cover + before-you-start + system + cut plan + a section intro per type + one page per step
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(4 + p.moduleTypes.length + steps);
  });

  it("links PDF buyers to the $10 upgrade, guide owners to their guide", async () => {
    const p = await plan("H4x4wt");
    const upgrade = generateDIYPDF({ plan: p, snapshots: {}, links: { upgradeUrl: "https://x.test/plans/build?token=t&upgrade=1" } });
    const upgradeOut = upgrade.output();
    expect(upgradeOut).toContain("https://x.test/plans/build?token=t&upgrade=1");
    expect(upgradeOut).toContain("$10");

    const guide = generateDIYPDF({ plan: p, snapshots: {}, links: { guideUrl: "https://x.test/plans/build?token=t&guide=1" } }).output();
    expect(guide).toContain("guide=1");
    expect(guide).not.toContain("Upgrade my plan");

    expect(generateDIYPDF({ plan: p, snapshots: {} }).output()).not.toContain("/plans/build");
  });
});

describe("groupBoards", () => {
  it("collapses identical boards and keeps first-seen order", () => {
    const board = (cuts: number[]) => ({
      cuts: cuts.map((length) => ({ length, label: length > 80 ? "A Plate" : "A Post" })),
      remainder: 96 - cuts.reduce((a, b) => a + b, 0),
    });
    const groups = groupBoards([board([86.5]), board([86.5]), board([64]), board([64]), board([64])]);
    expect(groups.map((g) => [g.count, g.board.cuts[0].length])).toEqual([
      [2, 86.5],
      [3, 64],
    ]);
  });
});

describe("pdfText", () => {
  it("maps build-engine symbols the PDF font can't encode", () => {
    expect(pdfText('1 ⅝" screws → frame')).toBe('1 5/8" screws -> frame');
    expect(pdfText('2×4 — 86-1/2"')).toBe('2×4 — 86-1/2"');
    expect(pdfText("ok ✓")).toBe("ok ");
  });
});
