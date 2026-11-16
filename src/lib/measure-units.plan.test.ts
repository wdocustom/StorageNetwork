import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateDIYPlan } from "@/app/actions/generate-plan";
import { decodeTotePlanDesign } from "@/lib/tote-plans";
import { generateDIYPDF } from "@/lib/diy-pdf-generator";
import { metricText } from "./measure-units";

// Anything still imperial after conversion: 30", 3/4", 8', 8 ft
const IMPERIAL = /\d\s?(?:"|″|”|'|′|ft\b|feet\b|inch)/;

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}

describe("metric plans", () => {
  it.each(["H4x4wt", "H4x4wts", "H4x4t.H2x4ts", "H2x4t_ij.H2x2t_ij.H2x4t_ij", "H4x4.H6x8wt", "H3x3"])("leaves no imperial measurement in plan %s", async (code) => {
    const design = decodeTotePlanDesign(code)!;
    const plan = await generateDIYPlan(design);
    const left = strings(plan)
      .map((s) => metricText(s))
      .filter((s) => IMPERIAL.test(s));
    expect(left).toEqual([]);
  });

  it("writes a metric PDF", async () => {
    const plan = await generateDIYPlan(decodeTotePlanDesign("H4x4wt.H4x4wts")!);
    const raw = generateDIYPDF({ plan, snapshots: {}, units: "metric" }).output();
    const texts = [...raw.matchAll(/\((.*?)\)\s*Tj/g)].map((m) => m[1]);
    expect(texts.some((t) => / mm/.test(t))).toBe(true);
    expect(texts.filter((t) => IMPERIAL.test(t.replace(/\\/g, "")))).toEqual([]);
  });
});

import { computeMaterials, getStepsForConfig, resolveTokens, type BuildConfig } from "@/components/visualizer/assemblySteps";

describe("metric 3D guide", () => {
  it.each([
    { hasWheels: true, hasTop: true, toteType: "HDX", rails: "2x4", sideways: false },
    { hasWheels: false, hasTop: true, toteType: "HDX", rails: "2x4", sideways: true },
    { hasWheels: true, hasTop: false, toteType: "GM", rails: "plywood", sideways: false },
  ] as BuildConfig[])("converts every step %#", (config) => {
    const left: string[] = [];
    for (const step of getStepsForConfig(config)) {
      const texts = [
        step.title,
        resolveTokens(step.instruction, 4, 4, config),
        step.proTip ?? "",
        step.screwType?.label ?? "",
        step.screwType?.description ?? "",
        ...step.tools.flatMap((t) => [t.name, t.detail ? resolveTokens(t.detail, 4, 4, config) : ""]),
        ...computeMaterials(step, 4, 4, config).flatMap((m) => [m.name, m.detail ?? ""]),
      ];
      left.push(...texts.map((t) => metricText(t)).filter((t) => IMPERIAL.test(t)));
    }
    expect(left).toEqual([]);
  });
});
