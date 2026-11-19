import "server-only";

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE MINI PLAN — the complete, printable plan for a Mini Tote Rack
// design (HDX 6.5 qt totes). Same shape as generateDIYPlan's output, so the
// build page, PDF and 3D guide render it the same way.
//
// Construction (@/lib/mini-rack): 2×3 uprights and plates, 3/4" plywood
// rails ripped to 1-1/4" (#8 × 1-1/4" screws, 2 per rail end), #9 × 3"
// through the plates into the uprights, optional 3/4" plywood top. No
// casters. Lumber is packed onto 8' 2×3s first-fit decreasing (the build
// engine only knows 2×4 racks); rails come out of 2' × 4' plywood panels,
// or full sheets once that's cheaper.
//
// Not a "use server" action: the plan is a paid product, so callers check
// the purchase before generating it (see generate-plan.ts).
// ═══════════════════════════════════════════════════════════════════════════

import { braceLayout2x4, computeMaterials, getStepsForConfig, resolveTokens, type BuildConfig } from "@/components/visualizer/assemblySteps";
import { toFraction } from "@/lib/utils";
import { productLinkFor } from "@/lib/plan-product-links";
import {
  MINI,
  MINI_PLY_HALF,
  MINI_PLY_PANEL,
  MINI_PLY_SHEET,
  planMiniPlywood,
  miniDepth,
  miniMaxModuleCols,
  miniMaxRowsPerTier,
  miniOpening,
  miniPiecesPer,
  miniPiecesPerStrip,
  miniRailTops,
  miniStripsPer,
  miniUpright,
} from "@/lib/mini-rack";
import {
  designModules,
  designOuterSize,
  moduleFrameHeightIn,
  moduleTypeTitle,
  moduleWidthIn,
  splitHeight,
  splitWidth,
  totePlanName,
  totePlanSummary,
  totePlanUnitLabel,
  unitDepthIn,
  unitLetter,
  unitOuterSize,
  type PlanModuleType,
  type TotePlanDesign,
} from "@/lib/tote-plans";
import type {
  CompleteDIYPlan,
  PlanAssemblyStep,
  PlanCutBoard,
  PlanCutPart,
  PlanModuleTypeBuild,
  PlanShoppingItem,
  PlanUnit,
} from "@/app/actions/generate-plan";

const SCREW_SPARE = 1.1; // ~10% for strips and misses
const SCREWS_3IN_PER_BOX = 137;
const SCREWS_1_5_8_PER_BOX = 158;
const SCREWS_2_5_PER_BOX = 150;
const SCREWS_1_25_PER_BOX = 200;
const TALL_UNIT_IN = 84;
/** Past this many panels, full 4×8 sheets are the cheaper buy. */
const MAX_PANELS = 2;

const RAIL_SCREW = '#8 × 1-1/4" Screws';
const PLATE_SCREW = '#9 × 3" Screws';
const TOP_SCREW = '#9 × 1-5/8" Screws';
const JOIN_SCREW = '#9 × 2-1/2" Screws';

const inches = (n: number) => `${toFraction(n)}"`;

function miniConfig(t: Pick<PlanModuleType, "hasTop" | "sideways">): BuildConfig {
  return { hasWheels: false, hasTop: t.hasTop, toteType: "MINI", rails: "plywood", sideways: t.sideways };
}

function moduleParts(t: PlanModuleType): PlanCutPart[] {
  const width = moduleWidthIn(t.cols, t.sideways, true);
  const depth = miniDepth(t.sideways);
  const braces = braceLayout2x4(t.cols, t.rows, t.sideways, true);
  const parts: PlanCutPart[] = [
    { name: "Upright", qty: (t.cols + 1) * 2, length: inches(miniUpright(t.rows)), material: "2×3" },
    { name: "Plate", qty: 4, length: inches(width), material: "2×3" },
    { name: "Rail", qty: t.cols * t.rows * 2, length: inches(depth), material: '3/4" plywood, 1-1/4" strip' },
    {
      name: "Back Brace",
      qty: braces.segments.length,
      length: braces.length >= depth ? inches(depth) : inches(braces.length),
      material: '3/4" plywood, 1-1/4" strip',
    },
  ];
  if (t.hasTop) parts.push({ name: "Top", qty: 1, length: `${inches(width)} × ${inches(depth)}`, material: '3/4" plywood' });
  return parts;
}

function moduleSteps(t: PlanModuleType): PlanAssemblyStep[] {
  const config = miniConfig(t);
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

/** Top pieces for a unit: one per 8' of width. */
function topPiecesFor(widthIn: number): number {
  return Math.max(1, Math.ceil(widthIn / MINI.stock));
}

function unitSteps(unit: PlanUnit): PlanAssemblyStep[] {
  const widths = splitWidth(unit.cols, unit.sideways, true);
  const tiers = splitHeight(unit.rows, true);
  const singleModule = widths.length === 1 && tiers.length === 1;
  const depth = inches(unitDepthIn(unit.sideways, true));
  const seams = widths.length - 1;
  const steps: Omit<PlanAssemblyStep, "stepNumber">[] = [];
  const letters = (tier: number) => unit.modules.filter((m) => m.tierIndex === tier).map((m) => m.name).join(" + ");
  const joinScrew = { label: '#9 × 2-1/2" Star Drive', length: 2.5, description: "Through one 2×3 upright into the next. No pilot hole required." };

  const joinStep = (tier: number, tierLabel: string): Omit<PlanAssemblyStep, "stepNumber"> => ({
    id: `join-tier-${tier + 1}`,
    title: `Join the ${tierLabel} Modules`,
    instruction:
      `Stand the ${tierLabel.toLowerCase()} modules (${letters(tier)}, left to right) in their final spot. ` +
      "Push them together so the touching uprights meet face to face, then line up the fronts and the top plates so they're flush. " +
      'Clamp each pair of touching uprights and drive #9 × 2-1/2" screws through one upright into the other — 3 per pair (near the top, middle and bottom), at the front and at the back.',
    materials: [{ name: JOIN_SCREW, qty: String(seams * 2 * 3), detail: "3 per pair of touching uprights, front and back" }],
    tools: [{ name: "Clamps", detail: "to pull uprights tight" }, { name: "Drill/Driver" }, { name: "T-25 Star Bit" }, { name: "Level" }],
    screwType: joinScrew,
    proTip: "Check that the fronts are flush and the tops are level before the first screw — shim under a low module rather than forcing it.",
  });

  if (seams > 0) steps.push(joinStep(0, tiers.length > 1 ? "Bottom-Tier" : "Side-by-Side"));

  for (let tier = 1; tier < tiers.length; tier++) {
    const screws = widths.reduce((s, c) => s + Math.max(2, Math.ceil(moduleWidthIn(c, unit.sideways, true) / 12)) * 2, 0);
    steps.push({
      id: `stack-tier-${tier + 1}`,
      title: tiers.length > 2 ? `Stack Tier ${tier + 1}` : "Stack the Upper Tier",
      instruction:
        `With a helper, lift each upper module (${letters(tier)}) onto the module directly below it. ` +
        "Line the uprights up with the uprights underneath and keep the fronts flush. " +
        'Drive #9 × 2-1/2" screws down through the upper module\'s bottom plate into the top plate below, about every 12" along the front and back plates.',
      materials: [{ name: JOIN_SCREW, qty: String(screws), detail: 'about every 12" along front and back plates' }],
      tools: [{ name: "Step Ladder" }, { name: "Drill/Driver" }, { name: "T-25 Star Bit" }, { name: "Clamps", detail: "hold plates together while fastening" }],
      screwType: { ...joinScrew, description: "Through the upper 2×3 bottom plate into the 2×3 top plate below." },
      proTip: "Never lift a module overhead alone. Screw the bottom tier to the wall studs first (see the anchoring step) so it can't tip while you stack.",
    });
    if (seams > 0) steps.push(joinStep(tier, tiers.length > 2 ? `Tier ${tier + 1}` : "Upper-Tier"));
  }

  if (unit.hasTop && !singleModule) {
    const pieces = topPiecesFor(unit.widthIn);
    const postCount = widths.reduce((s, c) => s + c + 1, 0);
    steps.push({
      id: "attach-unit-top",
      title: "Attach the Plywood Top",
      instruction:
        pieces === 1
          ? `Cut one piece of 3/4" plywood to ${inches(unit.widthIn)} × ${depth} and set it on the top plates, flush with the front and both ends. ` +
            'Drive #9 × 1-5/8" screws down through the plywood into the top plates at every upright location, front and back.'
          : `The top spans ${inches(unit.widthIn)}, longer than one 8' piece. Cut ${pieces} pieces of 3/4" plywood, each about ${inches(unit.widthIn / pieces)} × ${depth}, ` +
            'adjusting the cut so every seam lands over a pair of joined uprights. Set them flush with the front and ends, then drive #9 × 1-5/8" screws through the plywood into the top plates at every upright location, front and back — plus one extra screw on each side of every seam.',
      materials: [
        { name: '3/4" Plywood', qty: String(pieces), detail: `cut to ${depth} deep` },
        { name: TOP_SCREW, qty: String(postCount * 2 + (pieces - 1) * 4), detail: "every upright, front and back" },
      ],
      tools: [{ name: "Circular Saw", detail: "or Table Saw" }, { name: "Tape Measure" }, { name: "Drill/Driver" }, { name: "T-25 Star Bit" }],
      screwType: { label: '#9 × 1-5/8" Star Drive', length: 1.625, description: "Through the plywood top into the 2×3 top plate." },
      proTip: "Sand the edges and corners, especially if this will be a work surface.",
    });
  }

  if (tiers.length > 1 || unit.heightIn > TALL_UNIT_IN) {
    steps.push({
      id: "anchor-to-wall",
      title: "Anchor It to the Wall",
      instruction:
        "Tall units must be fastened to the wall so they can't tip. Find the wall studs behind the unit with a stud finder. " +
        'At each stud the unit\'s back uprights cross, drive a #9 × 3" screw through the back upright into the stud — one near the top of every tier.',
      materials: [{ name: PLATE_SCREW, qty: "1 per stud per tier", detail: "through back uprights into wall studs" }],
      tools: [{ name: "Stud Finder" }, { name: "Drill/Driver" }, { name: "T-25 Star Bit" }, { name: "Level" }],
      screwType: { label: '#9 × 3" Star Drive', length: 3, description: "Through a back upright into a wall stud." },
      proTip: "If a stud doesn't line up with an upright, screw a 2×4 cleat across the studs first and fasten the uprights to the cleat.",
    });
  }

  return steps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
}

/** First-fit decreasing onto 8' 2×3s, with the saw kerf between cuts. */
function packBoards(parts: { length: number; label: string }[]): PlanCutBoard[] {
  const boards: { cuts: { length: number; label: string }[]; rem: number }[] = [];
  for (const part of [...parts].sort((a, b) => b.length - a.length)) {
    const fit = boards.find((b) => b.rem >= part.length + (b.cuts.length ? MINI.kerf : 0));
    if (fit) {
      fit.rem -= part.length + MINI.kerf;
      fit.cuts.push(part);
    } else {
      boards.push({ cuts: [part], rem: MINI.stock - part.length });
    }
  }
  return boards.map((b) => ({ cuts: b.cuts, remainder: Math.max(0, Math.round(b.rem * 100) / 100) }));
}

export async function generateMiniPlan(design: TotePlanDesign): Promise<CompleteDIYPlan> {
  const { modules, types } = designModules(design);
  const typeLabel = new Map(types.map((t) => [t.letter, t.label.length > 12 ? `${t.moduleNames[0]}…` : t.label]));

  // ── Module types ─────────────────────────────────────────────────────
  const moduleTypes: PlanModuleTypeBuild[] = types.map((t) => ({
    ...t,
    widthIn: moduleWidthIn(t.cols, t.sideways, true),
    frameHeightIn: moduleFrameHeightIn(t.rows, true),
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
      sideways: u.sideways === true,
      hasWheels: false,
      hasTop: u.hasTop,
      widthIn: size.widthIn,
      heightIn: size.heightIn,
      modules: modules.filter((m) => m.unitIndex === index),
      assemblySteps: [],
    };
    unit.assemblySteps = unitSteps(unit);
    return unit;
  });

  // ── 2×3 cut plan: every upright and plate, packed onto 8' boards ──────
  const lumberParts: { length: number; label: string }[] = [];
  for (const m of modules) {
    const label = typeLabel.get(m.type) ?? m.name;
    for (let i = 0; i < (m.cols + 1) * 2; i++) lumberParts.push({ length: miniUpright(m.rows), label: `${label} Upright` });
    for (let i = 0; i < 4; i++) lumberParts.push({ length: moduleWidthIn(m.cols, m.sideways, true), label: `${label} Plate` });
  }
  const cutBoards = packBoards(lumberParts);

  // ── Plywood: rails + back braces (1-1/4" strips) and any tops, all from
  //    ONE stock size — the smallest that holds everything: a 2' × 4' panel,
  //    then a 4' × 4', then 4' × 8' sheets (planMiniPlywood).
  const pieceGroups = [false, true]
    .map((sideways) => {
      const ms = modules.filter((m) => m.sideways === sideways);
      return {
        sideways,
        pieceLength: miniDepth(sideways),
        rails: ms.reduce((s, m) => s + m.cols * m.rows * 2, 0),
        braces: ms.reduce((s, m) => s + braceLayout2x4(m.cols, m.rows, sideways, true).segments.length, 0),
      };
    })
    .filter((g) => g.rails > 0);
  const topPieces = units.flatMap((u) =>
    u.hasTop ? Array.from({ length: topPiecesFor(u.widthIn) }, () => ({ w: u.widthIn / topPiecesFor(u.widthIn), d: unitDepthIn(u.sideways, true) })) : [],
  );
  const plywood = planMiniPlywood(
    pieceGroups.map((g) => ({ length: g.pieceLength, count: g.rails + g.braces })),
    topPieces,
  );
  const railGroups = pieceGroups.map((g) => ({
    ...g,
    stockName: plywood.stock.name,
    pieces: plywood.count,
    strips: Math.ceil((g.rails + g.braces) / miniPiecesPerStrip(plywood.stock, g.pieceLength)),
    piecesPerStrip: miniPiecesPerStrip(plywood.stock, g.pieceLength),
  }));
  const plywoodItem =
    plywood.stock === MINI_PLY_PANEL
      ? { name: '3/4" Plywood Panel', size: "2' × 4' panel" }
      : plywood.stock === MINI_PLY_HALF
        ? { name: '3/4" Plywood Half Sheet', size: "4' × 4' sheet" }
        : { name: '3/4" Plywood Sheet', size: "4' × 8' sheet" };

  // ── Shopping list — screws counted from the plan's own steps ─────────
  const screwCount = (label: string) => {
    const fromSteps = (steps: PlanAssemblyStep[], times: number) =>
      steps.reduce(
        (sum, step) => sum + step.materials.filter((m) => m.name === label).reduce((n, m) => n + (Number.parseInt(m.qty, 10) || 0), 0) * times,
        0,
      );
    return moduleTypes.reduce((s, t) => s + fromSteps(t.steps, t.count), 0) + units.reduce((s, u) => s + fromSteps(u.assemblySteps, 1), 0);
  };
  const toteCount = design.units.reduce((s, u) => s + u.cols * u.rows, 0);
  const railCount = railGroups.reduce((s, g) => s + g.rails, 0);
  const braceCount = railGroups.reduce((s, g) => s + g.braces, 0);

  const shoppingList: PlanShoppingItem[] = [
    { name: "2×3 Lumber", detail: "8 ft — uprights and plates", qty: cutBoards.length },
  ];
  shoppingList.push({
    name: plywoodItem.name,
    detail: `3/4" ${plywoodItem.size} — rails + back braces${topPieces.length ? ` and the top${topPieces.length > 1 ? "s" : ""}` : ""}, all from ${plywood.count > 1 ? "these" : "one piece"}`,
    qty: plywood.count,
  });
  shoppingList.push({ name: `${MINI.tote.name} Totes`, detail: "HDX 6.5 qt clear totes with yellow lids — on sale 5 for $10 at Home Depot", qty: toteCount });
  const screwLines: [string, string, number, string][] = [
    [RAIL_SCREW, '#8 × 1-1/4" Star-Drive Screws', SCREWS_1_25_PER_BOX, "rails and back braces"],
    [PLATE_SCREW, '#9 × 3" Star-Drive Screws', SCREWS_3IN_PER_BOX, "plates into uprights"],
    [JOIN_SCREW, '#9 × 2-1/2" Star-Drive Screws', SCREWS_2_5_PER_BOX, "joining and stacking modules"],
    [TOP_SCREW, '#9 × 1-5/8" Star-Drive Screws', SCREWS_1_5_8_PER_BOX, "plywood top"],
  ];
  for (const [label, name, perBox, use] of screwLines) {
    const n = Math.ceil(screwCount(label) * SCREW_SPARE);
    if (n > 0) shoppingList.push({ name, detail: `${n} incl. ~10% spare — ${use} (${perBox}ct box)`, qty: `${Math.ceil(n / perBox)} Box` });
  }
  for (const item of shoppingList) {
    const link = productLinkFor(item.name);
    if (link) Object.assign(item, link);
  }

  // ── Notes ────────────────────────────────────────────────────────────
  const braceNotes = moduleTypes.map((t) => {
    const b = braceLayout2x4(t.cols, t.rows, t.sideways, true);
    const depth = miniDepth(t.sideways);
    const how = b.length >= depth ? `at ${inches(depth)} (no cut)` : `cut to ${inches(b.length)}`;
    return `${moduleTypeTitle(t)}: ${b.segments.length * t.count} ${how}`;
  });
  const plywoodNotes = [
    ...railGroups.map(
      (g) =>
        `${railGroups.length > 1 ? (g.sideways ? "Sideways rails: " : "Standard rails: ") : "Rails: "}${topPieces.length ? "after cutting the top, " : ""}rip ${g.strips} strips at 1-1/4" (fence at 1-1/4") along the long side of the ${g.stockName}, then crosscut each strip into ${g.piecesPerStrip} at ${inches(g.pieceLength)}. You need ${g.rails} rails plus ${g.braces} back braces.`,
    ),
    `Back braces: ${braceNotes.join("; ")}. Same 1-1/4" plywood strip as a rail, square ends.`,
    `Rail heights (top edge, measured up from the bottom of each upright): ${miniRailTops(Math.min(4, miniMaxRowsPerTier())).map(inches).join(", ")} … — 6-1/2" apart; use as many as the module is tall. From the floor, add 1-1/2" for the bottom plate.`,
  ];
  plywoodNotes.unshift(
    `Plywood to buy: ${plywood.count} × 3/4" ${plywood.stock.name}${topPieces.length ? ` — cut the top${topPieces.length > 1 ? "s" : ""} (${[...new Set(topPieces.map((p) => `${inches(p.w)} × ${inches(p.d)}`))].join(", ")}) first as a band across the long side, then rip the rest into rails` : " — all of it ripped into rails and braces"}.`,
  );

  const allTools = Array.from(
    new Set([...moduleTypes.flatMap((t) => t.steps.flatMap((s) => s.tools.map((x) => x.name))), ...units.flatMap((u) => u.assemblySteps.flatMap((s) => s.tools.map((x) => x.name)))]),
  ).sort();

  const size = designOuterSize(design);
  const safetyNotes = [
    "Always wear safety glasses when operating power tools.",
    "Use a push stick for every narrow rip on the table saw — the rails are only 1-1/4\" wide.",
    "Keep fingers at least 6\" from saw blades at all times.",
    "Work on a flat, stable surface to keep assemblies square.",
    "Wear hearing protection when using a miter saw or table saw.",
  ];
  if (units.some((u) => u.heightIn > TALL_UNIT_IN)) safetyNotes.push("Units taller than 7 feet must be anchored to wall studs.");

  const anySideways = design.units.some((u) => u.sideways);
  const generalNotes = [
    `Every bay is an ${inches(miniOpening(false))} opening between uprights for ${MINI.tote.name} totes (${inches(MINI.tote.width)} × ${inches(MINI.tote.length)} lid). Each tote hangs by its lid lip on two 1-1/4" plywood rails.`,
    'Built from standard 2×3s (actual 1-1/2" × 2-1/2") for uprights and plates, with 3/4" plywood rails.',
    'Screws are star-drive construction screws: #8 × 1-1/4" for rails and braces, #9 × 3" for plates. No pilot holes needed.',
    `Finished size: ${inches(size.widthIn)} W × ${inches(size.heightIn)} H × ${inches(size.depthIn)} D${design.units.length > 1 ? " (all units side by side, tallest unit)" : ""}.`,
    "Use the cut plan to cut parts for every module at once — it's packed to waste the fewest boards. Step quantities are for ONE module.",
  ];
  if (anySideways) {
    generalNotes.splice(
      1,
      0,
      `Sideways turns each tote 90° so its long side faces out: bays are ${inches(miniOpening(true))} wide and the rack is only ${inches(miniDepth(true))} deep. Sideways modules are at most ${miniMaxModuleCols(true)} totes wide so every plate still comes out of an 8' 2×3.`,
    );
  }
  if (modules.length > 1) {
    generalNotes.push(
      `Big walls are built from self-contained modules: no more than ${miniMaxModuleCols(false)} totes wide (${miniMaxModuleCols(true)} sideways) so plates fit an 8' 2×3, and ${miniMaxRowsPerTier()} tall so uprights do. Units are lettered A, B, C…; a unit made of several modules numbers them A1, A2… Identical modules are grouped so you build one, then repeat it.`,
    );
  }

  return {
    kind: "mini",
    frameLumber: "2×3",
    miniRails: railGroups.map(({ sideways: _s, ...g }) => g),
    name: totePlanName(design),
    summary: totePlanSummary(design),
    design,
    toteCount,
    dimensions: { totalWidth: inches(size.widthIn), totalHeight: inches(size.heightIn), depth: inches(size.depthIn) },
    units,
    moduleTypes,
    moduleCount: modules.length,
    shoppingList,
    totals: {
      boards: cutBoards.length,
      sheets: plywood.stock === MINI_PLY_SHEET ? plywood.count : 0,
      totes: toteCount,
      wheelKits: 0,
      screwBoxes_1_5_8: 0,
      screwBoxes_3: 0,
      screwBoxes_1: 0,
    },
    cutBoards,
    railBoards: { boards: 0, rails: railCount, braces: braceCount, groups: [] },
    plywoodNotes,
    allTools,
    safetyNotes,
    generalNotes,
  };
}
