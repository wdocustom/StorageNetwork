// ═══════════════════════════════════════════════════════════════════════════
// PLAN BESTSELLERS — the installer bestseller presets as DIY plan designs
//
// Presets whose defining feature the DIY plan doesn't build (drawer slides)
// are left out, so a plan named after a bestseller always matches it.
// Client-safe: no server imports.
// ═══════════════════════════════════════════════════════════════════════════

import { BESTSELLER_PRESETS, type BestsellerPreset } from "@/lib/presets";
import {
  designOuterSize,
  parseTotePlanDesign,
  totePlanDesignHref,
  totePlanUnitLabel,
  type TotePlanDesign,
} from "@/lib/tote-plans";
import { toFraction } from "@/lib/utils";

/** One line on the shape of each bestseller (sizes come from the preset). */
const BLURBS: Record<string, string> = {
  "indiana-joe": "Two tall towers with a low worktop unit between them.",
  "long-ranger": "A tall 2-wide tower beside a long, low bench.",
  "gas-station": "Single-column towers on both sides of a long, low center.",
  "rack-city-roller": "A compact rolling unit with a plywood top.",
  "mayor-of-rack-city": "A 4-wide rolling unit with a plywood top, a mobile worktop.",
};

export interface PlanBestseller {
  preset: BestsellerPreset;
  design: TotePlanDesign;
  blurb: string;
  totes: number;
  spec: string;
  /** Plans designer pre-filled with this bestseller */
  href: string;
}

function presetDesign(preset: BestsellerPreset): TotePlanDesign | null {
  return parseTotePlanDesign({
    name: preset.name,
    units: preset.units.map((u) => ({ ...u, toteType: preset.toteModel, unitType: "standard", orientation: "standard" })),
  });
}

export const PLAN_BESTSELLERS: PlanBestseller[] = BESTSELLER_PRESETS.filter(
  (p) => p.unitType === "standard" && p.orientation === "standard" && !p.drawerSlideColumns && !p.drawerSlideRows,
).flatMap((preset) => {
  const design = presetDesign(preset);
  if (!design) return [];
  const size = designOuterSize(design);
  const totes = design.units.reduce((s, u) => s + u.cols * u.rows, 0);
  const extras = [
    design.units.some((u) => u.hasWheels) ? "casters" : "",
    design.units.some((u) => u.hasTop) ? "worktop" : "",
  ].filter(Boolean);
  return [
    {
      preset,
      design,
      blurb: BLURBS[preset.id] ?? "",
      totes,
      spec: [
        design.units.map(totePlanUnitLabel).join(" + "),
        `${totes} totes`,
        `${toFraction(size.widthIn)}" W × ${toFraction(size.heightIn)}" H`,
        ...extras,
      ].join(" · "),
      href: totePlanDesignHref(design),
    },
  ];
});
