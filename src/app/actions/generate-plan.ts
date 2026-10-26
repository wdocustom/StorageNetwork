import "server-only";

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE DIY PLAN — Server module that produces the complete, printable
// build plan for a tote organizer design (one unit or many, any size).
//
// DIY plans are built with 2×4 RAILS: 2×4s ripped in half carry the totes
// in a universal 21" bay, so the whole frame comes from 2×4×8' studs and
// plywood is only needed for worktops.
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
  RAILS_2X4,
  braceLayout2x4,
  getStepsForConfig,
  computeMaterials,
  railTopMarks2x4,
  resolveTokens,
  upright2x4,
  type MaterialItem,
  type BuildConfig,
} from "@/components/visualizer/assemblySteps";
import { toFraction } from "@/lib/utils";
import { productLinkFor, type ProductStore } from "@/lib/plan-product-links";
import {
  BAY_OPENING_IN,
  UNIT_DEPTH_IN,
  casterPositions,
  designModules,
  designOuterSize,
  moduleFrameHeightIn,
  moduleWidthIn,
  splitHeight,
  splitWidth,
  totePlanName,
  totePlanSummary,
  totePlanUnitLabel,
  unitLetter,
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

export interface PlanShoppingItem {
  name: string;
  detail: string;
  qty: number | string;
  /** Where to buy it (affiliate link) — hardware only */
  url?: string;
  store?: ProductStore;
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
  /** "A", "B"… */
  letter: string;
  /** Size, e.g. "2×4" */
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
  shoppingList: PlanShoppingItem[];
  totals: BuildManifest["totals"];
  /** Every 2×4×8' board for uprights + plates, packed exactly as the build engine packs them */
  cutBoards: PlanCutBoard[];
  /** 2×4×8' boards ripped into rails and back braces (6 pieces per board) */
  railBoards: { boards: number; rails: number; braces: number };
  /** Ripping and plywood notes for the cut plan */
  plywoodNotes: string[];
  allTools: string[];
  safetyNotes: string[];
  generalNotes: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants (must match the build engine)
// ═══════════════════════════════════════════════════════════════════════════

const CASTER_SCREWS_EACH = 4;
const CASTERS_PER_KIT = 4;
const STRUCTURAL_SCREWS_PER_BOX = 95;
const SCREWS_3IN_PER_BOX = 137; // engine box sizes
const SCREWS_1_5_8_PER_BOX = 158;
const SCREW_SPARE = 1.1; // ~10% for strips and misses
const TALL_UNIT_IN = 84; // anchor anything taller than 7'

const BUILD_CONFIG_BASE = { rails: "2x4" } as const;

const inches = (n: number) => `${toFraction(n)}"`;

// ═══════════════════════════════════════════════════════════════════════════
// Module type → parts + steps
// ═══════════════════════════════════════════════════════════════════════════

function moduleParts(t: PlanModuleType): PlanCutPart[] {
  const width = moduleWidthIn(t.cols);
  const upright = upright2x4(t.rows);
  const braces = braceLayout2x4(t.cols, t.rows);
  const parts: PlanCutPart[] = [
    {
      name: "Upright",
      qty: (t.cols + 1) * 2,
      length: upright >= RAILS_2X4.stock ? `${inches(upright)} (full stud, no cut)` : inches(upright),
      material: "2×4",
    },
    { name: "Plate", qty: 4, length: inches(width), material: "2×4" },
    { name: "Rail", qty: t.cols * t.rows * 2, length: `${UNIT_DEPTH_IN}"`, material: "2×4 ripped in half" },
    {
      name: "Back Brace",
      qty: braces.segments.length,
      length: braces.length >= UNIT_DEPTH_IN ? `${UNIT_DEPTH_IN}"` : inches(braces.length),
      material: "2×4 ripped in half",
    },
  ];
  if (t.hasTop) parts.push({ name: "Worktop", qty: 1, length: `${inches(width)} × ${UNIT_DEPTH_IN}"`, material: '3/4" plywood' });
  return parts;
}

function moduleSteps(t: PlanModuleType): PlanAssemblyStep[] {
  const config: BuildConfig = { ...BUILD_CONFIG_BASE, hasWheels: t.hasWheels, hasTop: t.hasTop, toteType: t.toteType };
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
    unit.modules.filter((m) => m.tierIndex === tier).map((m) => m.name).join(" + ");

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

  // Units wider than one module get their casters once the bottom tier is
  // joined, spaced along the whole length (see casterPositions).
  if (unit.hasWheels && seams > 0) {
    const positions = casterPositions(unit);
    const count = positions.length * 2;
    const marks = positions.map((x) => inches(x));
    const markList = marks.length > 1 ? `${marks.slice(0, -1).join(", ")} and ${marks[marks.length - 1]}` : marks[0];
    steps.push({
      id: "attach-unit-casters",
      title: "Attach the Casters",
      instruction:
        `With a helper, tip the joined ${tiers.length > 1 ? "bottom tier" : "unit"} onto its back on a moving blanket or cardboard. ` +
        `Measuring from the left end, mark caster centerlines on the front and back bottom plates at ${markList} — each mark lands under an upright. ` +
        `Center a 5" swivel caster on every mark, front and back (${count} casters), and fasten each caster plate with 4 1/4" × 1" structural screws. Stand it back up and lock the casters.`,
      materials: [
        { name: '5" Swivel Casters', qty: String(count), detail: `${positions.length} pairs, front and back` },
        { name: '1/4" × 1" Structural Screws', qty: String(count * CASTER_SCREWS_EACH), detail: "4 per caster plate" },
      ],
      tools: [
        { name: "Drill/Driver" },
        { name: "Tape Measure" },
        { name: "Moving Blanket", detail: "or cardboard, to protect the frame" },
      ],
      screwType: { label: '1/4" × 1" Structural Screw', length: 1, description: "Through the caster plate into the 2×4 bottom plate." },
      proTip: "A caster at every mark keeps long units from sagging between ends. Lock them all before you stack, load, or lean anything on the unit.",
    });
  }

  for (let tier = 1; tier < tiers.length; tier++) {
    const perModulePlate = widths.map((c) => moduleWidthIn(c));
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
  // Cut labels name the module type by the modules it covers ("A, C"),
  // shortened when long so it fits on the board bar.
  const typeLabel = new Map(types.map((t) => [t.letter, t.label.length > 12 ? `${t.moduleNames[0]}…` : t.label]));
  const letterByKey = new Map(modules.map((m) => [m.key, typeLabel.get(m.type) ?? m.name]));

  // ── Build engine in 2×4-rail mode — what an installer building with 2×4
  //    rails gets. The engine keeps 2×4-rail units to one tier, so each
  //    stacked tier goes in as its own band (casters on the bottom band,
  //    worktop on the top band) and its module keys are mapped back.
  const bands: { unitIndex: number; tierIndex: number }[] = [];
  const quoteUnits: QuoteUnit[] = [];
  design.units.forEach((u, unitIndex) => {
    const tiers = splitHeight(u.rows);
    tiers.forEach((rows, tierIndex) => {
      bands.push({ unitIndex, tierIndex });
      quoteUnits.push({
        cols: u.cols,
        rows,
        toteType: u.toteType,
        unitType: "standard",
        orientation: "standard",
        hasTotes: true,
        hasWheels: u.hasWheels && tierIndex === 0,
        hasTop: u.hasTop && tierIndex === tiers.length - 1,
        price: 0, // not relevant for DIY plans
        totalW: unitOuterSize(u).widthIn,
        totalH: moduleFrameHeightIn(rows),
        depth: UNIT_DEPTH_IN,
        desc: totePlanUnitLabel(u),
        use2x4Rails: true,
      });
    });
  });
  const manifest = generateBuildManifest(quoteUnits);
  // Engine key "<band>-<widthModIndex>-0" → plan key "<unit>-<widthModIndex>-<tier>"
  const planKey = (engineKey: string) => {
    const [band, width] = engineKey.split("-").map(Number);
    const b = bands[band];
    return b ? `${b.unitIndex}-${width}-${b.tierIndex}` : engineKey;
  };

  // ── Cut boards — the engine's global packing, labeled by module type ─
  const cutBoards: PlanCutBoard[] = (manifest.stock_boards ?? []).map((b) => ({
    cuts: b.cuts.map((c) => ({
      length: c.len,
      // Engine names parts "Post"/"Plate" (+ " T2" for tiers); plans call posts uprights
      label: `${letterByKey.get(planKey(c.modKey)) ?? ""} ${c.name.replace(/ T\d+$/, "").replace(/^Post$/, "Upright")}`.trim(),
    })),
    remainder: Math.round(b.rem * 100) / 100,
  }));
  const railCount = modules.reduce((s, m) => s + m.cols * m.rows * 2, 0);
  const braceCount = modules.reduce((s, m) => s + braceLayout2x4(m.cols, m.rows).segments.length, 0);
  const railBoards = {
    boards: Math.ceil((railCount + braceCount) / RAILS_2X4.railsPerBoard),
    rails: railCount,
    braces: braceCount,
  };

  // ── Module types ─────────────────────────────────────────────────────
  const moduleTypes: PlanModuleTypeBuild[] = types.map((t) => ({
    ...t,
    widthIn: moduleWidthIn(t.cols),
    frameHeightIn: moduleFrameHeightIn(t.rows),
    parts: moduleParts(t),
    steps: moduleSteps(t),
  }));

  // ── Units ────────────────────────────────────────────────────────────
  const units: PlanUnit[] = design.units.map((u, index) => {
    const size = unitOuterSize(u);
    const unit: PlanUnit = {
      index,
      letter: unitLetter(index),
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

  // ── Shopping list — engine lumber/plywood/totes; casters and screws
  //    counted from the plan's own steps so the list matches the build.
  const casterCount = design.units.reduce((s, u) => s + casterPositions(u).length * 2, 0);
  const screwCount = (label: string) => {
    const fromSteps = (steps: PlanAssemblyStep[], times: number) =>
      steps.reduce(
        (sum, step) =>
          sum +
          step.materials
            .filter((m) => m.name === label)
            .reduce((n, m) => n + (Number.parseInt(m.qty, 10) || 0), 0) * times,
        0,
      );
    return (
      moduleTypes.reduce((s, t) => s + fromSteps(t.steps, t.count), 0) +
      units.reduce((s, u) => s + fromSteps(u.assemblySteps, 1), 0)
    );
  };
  const screws3 = Math.ceil(screwCount('#9 × 3" Screws') * SCREW_SPARE);
  const screws158 = Math.ceil(screwCount('#9 × 1-5/8" Screws') * SCREW_SPARE);
  const shoppingList: PlanShoppingItem[] = [];
  for (const item of manifest.shopping_list) {
    if (item.name === "2x4 Lumber" && /ripped/i.test(item.detail)) {
      shoppingList.push({ ...item, qty: railBoards.boards, detail: `8 ft — rip into ${railBoards.rails} rails + ${railBoards.braces} back braces (6 per board)` });
    } else if (item.name === "2x4 Lumber") {
      shoppingList.push({ ...item, detail: "8 ft studs — uprights and plates" });
    } else if (item.name === "Plywood") {
      if (Number(item.qty) > 0) shoppingList.push({ ...item, detail: '3/4" sheets — worktops' });
    } else if (item.name === "Caster Kits") {
      const kits = Math.ceil(casterCount / CASTERS_PER_KIT);
      shoppingList.push({
        ...item,
        qty: kits,
        detail: `5" swivel casters, 4pk — ${casterCount} casters needed${kits * CASTERS_PER_KIT > casterCount ? ` (${kits * CASTERS_PER_KIT - casterCount} spare)` : ""}`,
      });
      const structural = screwCount('1/4" × 1" Structural Screws');
      shoppingList.push({
        name: '1/4" × 1" Structural Screws',
        detail: `${structural} for caster plates (${STRUCTURAL_SCREWS_PER_BOX}ct box)`,
        qty: `${Math.ceil(structural / STRUCTURAL_SCREWS_PER_BOX)} Box`,
      });
    } else if (/Screws/.test(item.name)) {
      // replaced by step-derived counts below
    } else {
      shoppingList.push(item);
    }
  }
  shoppingList.push({
    name: '#9 × 3" Star-Drive Screws',
    detail: `${screws3} incl. ~10% spare (${SCREWS_3IN_PER_BOX}ct box)`,
    qty: `${Math.ceil(screws3 / SCREWS_3IN_PER_BOX)} Box`,
  });
  if (screws158 > 0) {
    shoppingList.push({
      name: '#9 × 1-5/8" Star-Drive Screws',
      detail: `${screws158} incl. ~10% spare — worktops (${SCREWS_1_5_8_PER_BOX}ct box)`,
      qty: `${Math.ceil(screws158 / SCREWS_1_5_8_PER_BOX)} Box`,
    });
  }
  for (const item of shoppingList) {
    const link = productLinkFor(item.name);
    if (link) Object.assign(item, link);
  }
  const totals = { ...manifest.totals, wheelKits: Math.ceil(casterCount / CASTERS_PER_KIT) };

  // ── Rail + plywood notes ─────────────────────────────────────────────
  const topSheets = units.reduce((s, u) => s + (u.hasTop ? topSheetsFor(u.widthIn) : 0), 0);
  const plywoodNotes = [
    `Rails: rip ${railBoards.boards} straight 2×4×8' board${railBoards.boards === 1 ? "" : "s"} down the middle (fence at 1-11/16"), then crosscut each half into 3 rails at ${UNIT_DEPTH_IN}". That makes ${railBoards.boards * RAILS_2X4.railsPerBoard} pieces — you need ${railBoards.rails} rails plus ${railBoards.braces} back braces (same 30" piece).`,
    `Rail heights (top edge, measured up from the bottom of each upright): ${railTopMarks2x4(6).map((m) => inches(m)).join(", ")} — use as many as the module is tall.`,
  ];
  if (topSheets > 0) {
    plywoodNotes.push(
      `Worktop${topSheets > 1 ? "s" : ""}: ${topSheets} piece${topSheets > 1 ? "s" : ""} of 3/4" plywood, ${UNIT_DEPTH_IN}" deep — see the top step for exact widths. Plywood to buy: ${manifest.totals.sheets} sheet${manifest.totals.sheets === 1 ? "" : "s"}.`,
    );
  } else {
    plywoodNotes.push("No plywood needed — the whole frame is 2×4.");
  }

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
    `Every bay is a universal ${inches(BAY_OPENING_IN)} opening between uprights, so it fits ${brands.size > 1 || brands.has("HDX") ? "HDX (Home Depot / Walmart / Menards)" : ""}${brands.size > 1 ? " and " : ""}${brands.size > 1 || brands.has("GM") ? "Greenmade (Costco)" : ""} 27-gallon totes. Each tote hangs by its rim on two 2×4 rails.`,
    'Built from standard 2×4s (actual 1-1/2" × 3-1/2"). Rails are 2×4s ripped in half; plywood is only used for worktops.',
    "Screws are #9 star-drive construction screws. No pilot holes needed in 2×4 or plywood.",
    `Finished size: ${inches(size.widthIn)} W × ${inches(size.heightIn)} H × ${UNIT_DEPTH_IN}" D${design.units.length > 1 ? " (all units side by side, tallest unit)" : ""}.`,
    "Use the cut plan to cut parts for every module at once — it's packed to waste the fewest boards. Step quantities are for ONE module.",
  ];
  if (modules.length > 1) {
    generalNotes.push(
      "Big walls are built from self-contained modules: no more than 4 totes wide (so plates fit an 8' board) and 6 tall (so uprights do). Units are lettered A, B, C…; a unit made of several modules numbers them A1, A2… Identical modules are grouped so you build one, then repeat it.",
    );
  }
  if (casterCount > 0) {
    generalNotes.push(
      `Casters: ${casterCount} 5" swivel casters in all — 4 on units up to 4 totes wide, 6 on units over 8', plus a pair for every further 48" of length. Every caster sits under an upright.`,
    );
  }

  return {
    name: totePlanName(design),
    railBoards,
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
