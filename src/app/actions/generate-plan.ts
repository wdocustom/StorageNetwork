import "server-only";

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE DIY PLAN — Server module that produces the complete, printable
// build plan for a tote organizer design (one unit or many, any size).
//
// Combines:
//   • the build engine — shopping list, global 8' board packing, plywood
//     (exactly what installers get for the same build)
//   • the assembly step system — the interactive guide's steps, generated
//     once per MODULE TYPE (identical modules are built the same way)
//   • unit-level steps for what happens after modules exist — joining
//     side-by-side modules, stacking tiers, the full-width worktop, and
//     anchoring tall units
//
// Deliberately NOT a "use server" action: the plan is a paid product, so
// callers (tote-plan-access.ts) check the purchase before generating it.
// ═══════════════════════════════════════════════════════════════════════════

import { generateBuildManifest } from "@/lib/buildEngine";
import type { BuildManifest, QuoteUnit } from "@/lib/buildEngine.types";
import {
  getStepsForConfig,
  computeMaterials,
  resolveTokens,
  type MaterialItem,
  type BuildConfig,
} from "@/components/visualizer/assemblySteps";
import { toFraction } from "@/lib/utils";
import {
  TOTE_OPENING_IN,
  UNIT_DEPTH_IN,
  designModules,
  designOuterSize,
  moduleFrameHeightIn,
  moduleWidthIn,
  splitHeight,
  splitWidth,
  totePlanName,
  totePlanSummary,
  totePlanUnitLabel,
  unitOuterSize,
  type PlanModule,
  type PlanModuleType,
  type TotePlanDesign,
} from "@/lib/tote-plans";

// ═══════════════════════════════════════════════════════════════════════════
// Output Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PlanAssemblyStep {
  /** Guide step id (module steps match AssemblyStepSnapshots output) */
  id: string;
  stepNumber: number;
  title: string;
  instruction: string;
  materials: MaterialItem[];
  tools: { name: string; detail?: string }[];
  screwType?: { label: string; length: number; description: string };
  proTip?: string;
}

export interface PlanCutPart {
  name: string;
  qty: number;
  length: string;
  material: string;
}

export interface PlanModuleTypeBuild extends PlanModuleType {
  /** Outside width of one module, inches */
  widthIn: number;
  /** Frame height of one module (without casters), inches */
  frameHeightIn: number;
  /** Parts to cut for ONE module of this type */
  parts: PlanCutPart[];
  /** Build steps for ONE module of this type */
  steps: PlanAssemblyStep[];
}

export interface PlanUnit {
  index: number;
  label: string;
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  hasWheels: boolean;
  hasTop: boolean;
  widthIn: number;
  heightIn: number;
  /** This unit's modules, bottom tier first, left to right */
  modules: PlanModule[];
  /** Steps after the modules are built (empty for single-module units) */
  assemblySteps: PlanAssemblyStep[];
}

export interface PlanCutBoard {
  cuts: { length: number; label: string }[];
  remainder: number;
}

export interface CompleteDIYPlan {
  name: string;
  summary: string;
  design: TotePlanDesign;
  toteCount: number;
  dimensions: { totalWidth: string; totalHeight: string; depth: string };
  units: PlanUnit[];
  moduleTypes: PlanModuleTypeBuild[];
  moduleCount: number;
  shoppingList: BuildManifest["shopping_list"];
  totals: BuildManifest["totals"];
  /** Every 2×4×8' board, packed exactly as the build engine counts them */
  cutBoards: PlanCutBoard[];
  plywoodNotes: string[];
  allTools: string[];
  safetyNotes: string[];
  generalNotes: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants (must match the build engine)
// ═══════════════════════════════════════════════════════════════════════════

const RAIL_STRIP_WIDTH = 1.875; // 1-7/8"
const BACK_SUPPORTS_PER_MODULE = 4; // engine: cols <= 4 ? 4 : 6, and modules are <= 4 wide
const SCREWS_PER_CASTER_KIT = 16;
const SCREWS_1IN_PER_BOX = 90;
const TALL_UNIT_IN = 84; // anchor anything taller than 7'

const inches = (n: number) => `${toFraction(n)}"`;

// ═══════════════════════════════════════════════════════════════════════════
// Module type → parts + steps
// ═══════════════════════════════════════════════════════════════════════════

function moduleParts(t: PlanModuleType): PlanCutPart[] {
  const width = moduleWidthIn(t.cols, t.toteType);
  const parts: PlanCutPart[] = [
    { name: "Upright", qty: (t.cols + 1) * 2, length: inches(t.rows * 16), material: "2×4" },
    { name: "Plate", qty: 4, length: inches(width), material: "2×4" },
    { name: "Rail strip", qty: t.cols * t.rows * 2, length: `${UNIT_DEPTH_IN}" × ${inches(RAIL_STRIP_WIDTH)}`, material: '3/4" plywood' },
    { name: "Back support", qty: BACK_SUPPORTS_PER_MODULE, length: "diagonal, cut to fit", material: '3/4" plywood' },
  ];
  if (t.hasTop) parts.push({ name: "Worktop", qty: 1, length: `${inches(width)} × ${UNIT_DEPTH_IN}"`, material: '3/4" plywood' });
  return parts;
}

function moduleSteps(t: PlanModuleType): PlanAssemblyStep[] {
  const config: BuildConfig = { hasWheels: t.hasWheels, hasTop: t.hasTop, toteType: t.toteType };
  return getStepsForConfig(config).map((step, idx) => ({
    id: step.id,
    stepNumber: idx + 1,
    title: resolveTokens(step.title, t.cols, t.rows, config),
    instruction: resolveTokens(step.instruction, t.cols, t.rows, config),
    materials: computeMaterials(step, t.cols, t.rows, config),
    tools: step.tools.map((tool) => ({
      ...tool,
      detail: tool.detail ? resolveTokens(tool.detail, t.cols, t.rows, config) : undefined,
    })),
    screwType: step.screwType,
    proTip: step.proTip ? resolveTokens(step.proTip, t.cols, t.rows, config) : undefined,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Unit-level steps — joining, stacking and the full-width worktop for
// multi-module units, plus wall anchoring for any tall stationary unit
// ═══════════════════════════════════════════════════════════════════════════

function topSheetsFor(widthIn: number): number {
  // Same thresholds as the build engine's top sheet count
  return widthIn > 192 ? 3 : widthIn > 96 ? 2 : 1;
}

function unitSteps(unit: PlanUnit): PlanAssemblyStep[] {
  const widths = splitWidth(unit.cols);
  const tiers = splitHeight(unit.rows);
  const singleModule = widths.length === 1 && tiers.length === 1;

  const steps: Omit<PlanAssemblyStep, "stepNumber">[] = [];
  const seams = widths.length - 1;
  const letters = (tier: number) =>
    unit.modules.filter((m) => m.tierIndex === tier).map((m) => m.type).join(" + ");

  const joinStep = (tier: number, tierLabel: string): Omit<PlanAssemblyStep, "stepNumber"> => ({
    id: `join-tier-${tier + 1}`,
    title: `Join the ${tierLabel} Modules`,
    instruction:
      `Stand the ${tierLabel.toLowerCase()} modules (${letters(tier)}, left to right) in their final spot. ` +
      "Push them together so the touching uprights meet face to face, then line up the fronts and the top plates so they're flush. " +
      "Clamp each pair of touching uprights and drive #9 × 3\" screws through one upright into the other — 3 screws per pair (near the top, middle and bottom), at the front and at the back.",
    materials: [
      { name: '#9 × 3" Screws', qty: String(seams * 2 * 3), detail: "3 per pair of touching uprights, front and back" },
    ],
    tools: [
      { name: "Clamps", detail: "to pull uprights tight" },
      { name: "Drill/Driver" },
      { name: "T-25 Star Bit" },
      { name: "Level" },
    ],
    screwType: { label: '#9 × 3" Star Drive', length: 3, description: "Construction screw — through one upright into the next. No pilot hole required." },
    proTip: "Check that the fronts are flush and the tops are level before the first screw — shim under a low module rather than forcing it.",
  });

  const bottomLabel = tiers.length > 1 ? "Bottom-Tier" : "";
  if (seams > 0) steps.push(joinStep(0, bottomLabel ? "Bottom-Tier" : "Side-by-Side"));

  for (let tier = 1; tier < tiers.length; tier++) {
    const perModulePlate = widths.map((c) => moduleWidthIn(c, unit.toteType));
    const screws = perModulePlate.reduce((s, w) => s + Math.max(2, Math.ceil(w / 12)) * 2, 0);
    steps.push({
      id: `stack-tier-${tier + 1}`,
      title: tiers.length > 2 ? `Stack Tier ${tier + 1}` : "Stack the Upper Tier",
      instruction:
        `With a helper, lift each upper module (${letters(tier)}) onto the module directly below it. ` +
        "Line the uprights up with the uprights underneath and keep the fronts flush. " +
        "Drive #9 × 3\" screws down through the upper module's bottom plate into the top plate below, about every 12\" along the front and back plates.",
      materials: [{ name: '#9 × 3" Screws', qty: String(screws), detail: "about every 12\" along front and back plates" }],
      tools: [
        { name: "Step Ladder" },
        { name: "Drill/Driver" },
        { name: "T-25 Star Bit" },
        { name: "Clamps", detail: "hold plates together while fastening" },
      ],
      screwType: { label: '#9 × 3" Star Drive', length: 3, description: "Construction screw — through the upper bottom plate into the lower top plate." },
      proTip: unit.hasWheels
        ? "Never lift a module overhead alone. Lock every caster before you stack, and load the bottom tier first so the unit stays bottom-heavy."
        : "Never lift a module overhead alone. Screw the bottom tier to the wall studs first (see the anchoring step) so it can't tip while you stack.",
    });
    if (seams > 0) steps.push(joinStep(tier, tiers.length > 2 ? `Tier ${tier + 1}` : "Upper-Tier"));
  }

  // A single-module unit's worktop is part of the module's own steps
  if (unit.hasTop && !singleModule) {
    const sheets = topSheetsFor(unit.widthIn);
    const pieceW = unit.widthIn / sheets;
    const postCount = widths.reduce((s, c) => s + c + 1, 0);
    steps.push({
      id: "attach-unit-top",
      title: "Attach the Plywood Top",
      instruction:
        sheets === 1
          ? `Cut one piece of 3/4" plywood to ${inches(unit.widthIn)} × ${UNIT_DEPTH_IN}" and set it on the top plates, flush with the front and both ends. ` +
            "Drive #9 × 1-5/8\" screws down through the plywood into the top plates at every upright location, front and back."
          : `The top spans ${inches(unit.widthIn)}, wider than one sheet. Cut ${sheets} pieces of 3/4" plywood, each about ${inches(pieceW)} × ${UNIT_DEPTH_IN}", ` +
            "adjusting the cut so every seam lands over a pair of joined uprights. Set them flush with the front and ends, then drive #9 × 1-5/8\" screws through the plywood into the top plates at every upright location, front and back — plus one extra screw on each side of every seam.",
      materials: [
        { name: '3/4" Plywood', qty: String(sheets), detail: `cut to ${UNIT_DEPTH_IN}" deep` },
        { name: '#9 × 1-5/8" Screws', qty: String(postCount * 2 + (sheets - 1) * 4), detail: "every upright, front and back" },
      ],
      tools: [
        { name: "Circular Saw", detail: "or Table Saw" },
        { name: "Tape Measure" },
        { name: "Drill/Driver" },
        { name: "T-25 Star Bit" },
      ],
      screwType: { label: '#9 × 1-5/8" Star Drive', length: 1.625, description: "Through the plywood top into the 2×4 top plate." },
      proTip: "Sand the edges and corners, especially if this will be a work surface.",
    });
  }

  if (!unit.hasWheels && (tiers.length > 1 || unit.heightIn > TALL_UNIT_IN)) {
    steps.push({
      id: "anchor-to-wall",
      title: "Anchor It to the Wall",
      instruction:
        "Tall units must be fastened to the wall so they can't tip. Find the wall studs behind the unit with a stud finder. " +
        "At each stud the unit's back uprights cross, drive a #9 × 3\" screw through the back upright into the stud — one near the top of every tier.",
      materials: [{ name: '#9 × 3" Screws', qty: "1 per stud per tier", detail: "through back uprights into wall studs" }],
      tools: [{ name: "Stud Finder" }, { name: "Drill/Driver" }, { name: "T-25 Star Bit" }, { name: "Level" }],
      screwType: { label: '#9 × 3" Star Drive', length: 3, description: "Through a back upright into a wall stud." },
      proTip: "If a stud doesn't line up with an upright, screw a 2×4 cleat across the studs first and fasten the uprights to the cleat.",
    });
  }

  return steps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Generator
// ═══════════════════════════════════════════════════════════════════════════

export async function generateDIYPlan(design: TotePlanDesign): Promise<CompleteDIYPlan> {
  const { modules, types } = designModules(design);
  const letterByKey = new Map(modules.map((m) => [m.key, m.type]));

  // ── Build engine — the same manifest an installer gets ───────────────
  const quoteUnits: QuoteUnit[] = design.units.map((u) => {
    const size = unitOuterSize(u);
    return {
      cols: u.cols,
      rows: u.rows,
      toteType: u.toteType,
      unitType: "standard",
      orientation: "standard",
      hasTotes: true,
      hasWheels: u.hasWheels,
      hasTop: u.hasTop,
      price: 0, // not relevant for DIY plans
      totalW: size.widthIn,
      totalH: size.heightIn,
      depth: UNIT_DEPTH_IN,
      desc: totePlanUnitLabel(u),
    };
  });
  const manifest = generateBuildManifest(quoteUnits);

  // ── Casters: every bottom-tier module is its own frame, so each rolls
  //    on its own four. (The engine prices one kit per unit.)
  const casterKits = modules.filter((m) => m.hasWheels).length;
  const shoppingList = manifest.shopping_list.map((item) => {
    if (item.name === "Caster Kits") return { ...item, qty: casterKits, detail: "4pk Sets — one set per bottom module" };
    if (item.name === '1" Screws') {
      const boxes = Math.ceil((casterKits * SCREWS_PER_CASTER_KIT) / SCREWS_1IN_PER_BOX);
      return { ...item, qty: `${boxes} Box` };
    }
    return item;
  });
  const totals = { ...manifest.totals, wheelKits: casterKits };

  // ── Cut boards — the engine's global packing, labeled by module type ─
  const cutBoards: PlanCutBoard[] = (manifest.stock_boards ?? []).map((b) => ({
    cuts: b.cuts.map((c) => ({
      length: c.len,
      // Engine names parts "Post"/"Plate" (+ " T2" for tiers); plans call posts uprights
      label: `${letterByKey.get(c.modKey) ?? ""} ${c.name.replace(/ T\d+$/, "").replace(/^Post$/, "Upright")}`.trim(),
    })),
    remainder: Math.round(b.rem * 100) / 100,
  }));

  // ── Module types ─────────────────────────────────────────────────────
  const moduleTypes: PlanModuleTypeBuild[] = types.map((t) => ({
    ...t,
    widthIn: moduleWidthIn(t.cols, t.toteType),
    frameHeightIn: moduleFrameHeightIn(t.rows),
    parts: moduleParts(t),
    steps: moduleSteps(t),
  }));

  // ── Units ────────────────────────────────────────────────────────────
  const units: PlanUnit[] = design.units.map((u, index) => {
    const size = unitOuterSize(u);
    const unit: PlanUnit = {
      index,
      label: totePlanUnitLabel(u),
      cols: u.cols,
      rows: u.rows,
      toteType: u.toteType,
      hasWheels: u.hasWheels,
      hasTop: u.hasTop,
      widthIn: size.widthIn,
      heightIn: size.heightIn,
      modules: modules.filter((m) => m.unitIndex === index),
      assemblySteps: [],
    };
    unit.assemblySteps = unitSteps(unit);
    return unit;
  });

  // ── Plywood notes ────────────────────────────────────────────────────
  const railStrips = modules.reduce((s, m) => s + m.cols * m.rows * 2, 0);
  const backSupports = modules.length * BACK_SUPPORTS_PER_MODULE;
  const topSheets = units.reduce((s, u) => s + (u.hasTop ? topSheetsFor(u.widthIn) : 0), 0);
  const plywoodNotes = [
    `Rip ${railStrips} rail strips at ${inches(RAIL_STRIP_WIDTH)} wide × ${UNIT_DEPTH_IN}" long from 3/4" plywood.`,
    `From each 4'×8' sheet: rip a ${UNIT_DEPTH_IN}" wide offcut along the 96" side, then crosscut it into ${UNIT_DEPTH_IN}"×${UNIT_DEPTH_IN}" squares. Each square yields 16 strips at ${inches(RAIL_STRIP_WIDTH)}.`,
    `Cut ${backSupports} back supports (${BACK_SUPPORTS_PER_MODULE} per module) from the leftover plywood.`,
  ];
  if (topSheets > 0) {
    plywoodNotes.push(
      `Worktop${topSheets > 1 ? "s" : ""}: ${topSheets} piece${topSheets > 1 ? "s" : ""} of 3/4" plywood, ${UNIT_DEPTH_IN}" deep — see the top step for exact widths.`,
    );
  }
  plywoodNotes.push(`Plywood to buy, all in: ${manifest.totals.sheets} sheet${manifest.totals.sheets === 1 ? "" : "s"} of 3/4" plywood (rails, supports and tops share sheets).`);

  // ── Tools ────────────────────────────────────────────────────────────
  const toolSet = new Set<string>();
  for (const t of moduleTypes) for (const step of t.steps) for (const tool of step.tools) toolSet.add(tool.name);
  for (const u of units) for (const step of u.assemblySteps) for (const tool of step.tools) toolSet.add(tool.name);
  const allTools = Array.from(toolSet).sort();

  // ── Notes ────────────────────────────────────────────────────────────
  const size = designOuterSize(design);
  const brands = new Set(design.units.map((u) => u.toteType));
  const safetyNotes = [
    "Always wear safety glasses when operating power tools.",
    "Use a push stick when ripping narrow strips on the table saw.",
    "Keep fingers at least 6\" from saw blades at all times.",
    "Work on a flat, stable surface to keep assemblies square.",
    "Get a helper to stand any module upright if it's taller than 5 feet.",
    "Wear hearing protection when using a miter saw or table saw.",
  ];
  if (units.some((u) => u.heightIn > TALL_UNIT_IN)) {
    safetyNotes.push("Units taller than 7 feet must be anchored to wall studs (stationary) or kept with casters locked and loaded bottom-heavy (rolling).");
  }

  const generalNotes = [
    ...Array.from(brands).map(
      (b) =>
        `${b === "HDX" ? "HDX / Home Depot / Menards / Walmart" : "Greenmade / Costco"} 27-gallon totes need a ${inches(TOTE_OPENING_IN[b])} opening. Don't substitute a different brand without recalculating.`,
    ),
    'All lumber is standard 2×4 (actual 1-1/2" × 3-1/2") and 3/4" plywood.',
    "Screws are #9 star-drive construction screws. No pilot holes needed in 2×4 or plywood.",
    `Finished size: ${inches(size.widthIn)} W × ${inches(size.heightIn)} H × ${UNIT_DEPTH_IN}" D${design.units.length > 1 ? " (all units side by side, tallest unit)" : ""}.`,
    "Use the cut plan to cut parts for every module at once — it's packed to waste the fewest boards. Step quantities are for ONE module.",
  ];
  if (modules.length > 1) {
    generalNotes.push(
      "Big walls are built from self-contained modules: no more than 4 totes wide (so plates fit an 8' board) and 6 tall (so uprights do). Identical modules share a letter — build one, then repeat it.",
    );
  }
  if (casterKits > 0) {
    generalNotes.push(`Casters: one set of four 5" swivel casters under every bottom module (${casterKits} set${casterKits > 1 ? "s" : ""}). Position each caster's swivel pivot directly under an upright.`);
  }

  return {
    name: totePlanName(design),
    summary: totePlanSummary(design),
    design,
    toteCount: design.units.reduce((s, u) => s + u.cols * u.rows, 0),
    dimensions: {
      totalWidth: inches(size.widthIn),
      totalHeight: inches(size.heightIn),
      depth: `${UNIT_DEPTH_IN}"`,
    },
    units,
    moduleTypes,
    moduleCount: modules.length,
    shoppingList,
    totals,
    cutBoards,
    plywoodNotes,
    allTools,
    safetyNotes,
    generalNotes,
  };
}
