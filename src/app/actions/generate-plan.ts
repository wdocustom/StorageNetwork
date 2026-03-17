"use server";

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE DIY PLAN — Server action that produces a complete, printable
// build plan for any tote organizer configuration.
//
// Combines the build engine (cut lists, shopping lists, bin-packing)
// with the assembly step system (instructions, tools, pro tips)
// into a single comprehensive plan document ready for rendering.
// ═══════════════════════════════════════════════════════════════════════════

import { generateBuildManifest } from "@/lib/buildEngine";
import type { BuildManifest, QuoteUnit } from "@/lib/buildEngine.types";
import type { PlanConfig } from "@/lib/plans";
import {
  getStepsForConfig,
  computeMaterials,
  resolveTokens,
  type AssemblyStep,
  type MaterialItem,
  type BuildConfig,
} from "@/components/visualizer/assemblySteps";
import { toFraction } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// Output Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PlanDimensions {
  totalWidth: string;
  totalHeight: string;
  totalHeightWithWheels: string | null;
  depth: string;
  slotWidth: string;
  tierSpacing: string;
  firstRailHeight: string;
  postWidth: string;
  railStripWidth: string;
  railStripThickness: string;
  uprightHeight: string;
  plateLength: string;
}

export interface PlanAssemblyStep {
  stepNumber: number;
  title: string;
  instruction: string;
  materials: MaterialItem[];
  tools: { name: string; detail?: string }[];
  screwType?: { label: string; length: number; description: string };
  proTip?: string;
}

export interface PlanCutDiagram {
  boardIndex: number;
  stockLength: number;
  cuts: { length: number; label: string }[];
  remainder: number;
}

export interface CompleteDIYPlan {
  // ── Header ─────────────────────────────────────────────────────────────
  unitName: string;
  cols: number;
  rows: number;
  toteCount: number;
  toteType: "HDX" | "GM";
  orientation: "standard" | "sideways";
  hasWheels: boolean;
  hasTop: boolean;

  // ── Dimensions ──────────────────────────────────────────────────────────
  dimensions: PlanDimensions;

  // ── Materials Shopping List ─────────────────────────────────────────────
  shoppingList: BuildManifest["shopping_list"];
  totals: BuildManifest["totals"];

  // ── Cut Plans (visual board layout) ────────────────────────────────────
  cutDiagrams: PlanCutDiagram[];
  plywoodNotes: string[];

  // ── Step-by-Step Assembly ──────────────────────────────────────────────
  assemblySteps: PlanAssemblyStep[];

  // ── Aggregated Tool List ───────────────────────────────────────────────
  allTools: string[];

  // ── Safety & Notes ─────────────────────────────────────────────────────
  safetyNotes: string[];
  generalNotes: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Dimension constants (must match build engine — duplicated intentionally
// since buildEngine.ts is server-only and we need the raw numbers here)
// ═══════════════════════════════════════════════════════════════════════════

const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const SIDEWAYS_OPENING = 30.25;
const POST_WIDTH = 1.5;
const TIER_SPACING = 16;
const FIRST_RAIL_HEIGHT = 13;
const DEPTH_STANDARD = 30;
const DEPTH_SIDEWAYS = 20;
const CASTER_HEIGHT = 2.75;
const RAIL_STRIP_WIDTH = 1.875; // 1-7/8"
const RAIL_STRIP_THICKNESS = 0.75;

function getOpeningForConfig(config: PlanConfig): number {
  if (config.orientation === "sideways") return SIDEWAYS_OPENING;
  return config.toteType === "HDX" ? OPENING_HDX : OPENING_GM;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Generator
// ═══════════════════════════════════════════════════════════════════════════

export async function generateDIYPlan(
  config: PlanConfig,
  planName: string,
): Promise<CompleteDIYPlan> {
  const { cols, rows, toteType, orientation, hasWheels, hasTop } = config;
  const opening = getOpeningForConfig(config);
  const depth = orientation === "sideways" ? DEPTH_SIDEWAYS : DEPTH_STANDARD;

  // ── Calculate dimensions ─────────────────────────────────────────────
  const totalW = cols * opening + (cols + 1) * POST_WIDTH;
  const uprightH = rows * TIER_SPACING;
  const plateThickness = POST_WIDTH; // 2×4 laid flat = 1.5"
  const topGap = 2.5;
  const totalH = uprightH + 2 * plateThickness + topGap;
  const totalHWithWheels = hasWheels ? totalH + CASTER_HEIGHT : null;

  const dimensions: PlanDimensions = {
    totalWidth: toFraction(totalW) + '"',
    totalHeight: toFraction(totalH) + '"',
    totalHeightWithWheels: totalHWithWheels ? toFraction(totalHWithWheels) + '"' : null,
    depth: depth + '"',
    slotWidth: toFraction(opening) + '"',
    tierSpacing: TIER_SPACING + '"',
    firstRailHeight: FIRST_RAIL_HEIGHT + '"',
    postWidth: toFraction(POST_WIDTH) + '"',
    railStripWidth: toFraction(RAIL_STRIP_WIDTH) + '"',
    railStripThickness: toFraction(RAIL_STRIP_THICKNESS) + '"',
    uprightHeight: uprightH + '"',
    plateLength: toFraction(totalW) + '"',
  };

  // ── Generate build manifest (shopping list + cut plans) ──────────────
  const quoteUnit: QuoteUnit = {
    cols,
    rows,
    toteType,
    unitType: config.unitType,
    orientation,
    hasTotes: true,
    hasWheels,
    hasTop,
    price: 0, // not relevant for DIY plans
    totalW,
    totalH,
    depth,
    desc: planName,
  };

  const manifest = generateBuildManifest([quoteUnit]);

  // ── Convert cut plan modules into simplified diagrams ────────────────
  const cutDiagrams: PlanCutDiagram[] = [];
  for (const mod of manifest.cut_plan_visuals) {
    for (let i = 0; i < mod.boards.length; i++) {
      const board = mod.boards[i];
      cutDiagrams.push({
        boardIndex: cutDiagrams.length + 1,
        stockLength: 96,
        cuts: board.cuts.map((c) => ({ length: c.len, label: c.name })),
        remainder: board.rem,
      });
    }
  }

  // ── Plywood notes ────────────────────────────────────────────────────
  const plywoodNotes: string[] = [];
  const numRails = cols * rows * 2;
  plywoodNotes.push(
    `Rip ${numRails} strips at ${toFraction(RAIL_STRIP_WIDTH)}" wide × ${depth}" long from 3/4" plywood.`,
  );
  plywoodNotes.push(
    `From each 4'×8' sheet: rip a ${depth}" wide offcut along the 96" side, then crosscut into ${depth}"×${depth}" squares. Each square yields 16 strips at ${toFraction(RAIL_STRIP_WIDTH)}".`,
  );
  const sheetsNeeded = Math.ceil(numRails / 48); // ~48 strips per sheet
  plywoodNotes.push(
    `You need approximately ${sheetsNeeded} sheet${sheetsNeeded > 1 ? "s" : ""} of 3/4" plywood for rail strips.`,
  );
  if (hasTop) {
    const topSheets = totalW > 96 ? 2 : 1;
    plywoodNotes.push(
      `Plywood top: Cut ${topSheets} piece${topSheets > 1 ? "s" : ""} to ${toFraction(totalW)}" × ${depth}" from the same 3/4" plywood.`,
    );
  }

  // ── Assembly steps ───────────────────────────────────────────────────
  const buildConfig: BuildConfig = { hasWheels, hasTop, toteType };
  const rawSteps = getStepsForConfig(buildConfig);
  const assemblySteps: PlanAssemblyStep[] = rawSteps.map((step, idx) => ({
    stepNumber: idx + 1,
    title: resolveTokens(step.title, cols, rows, buildConfig),
    instruction: resolveTokens(step.instruction, cols, rows, buildConfig),
    materials: computeMaterials(step, cols, rows, buildConfig),
    tools: step.tools,
    screwType: step.screwType,
    proTip: step.proTip ? resolveTokens(step.proTip, cols, rows, buildConfig) : undefined,
  }));

  // ── Aggregate all tools ──────────────────────────────────────────────
  const toolSet = new Set<string>();
  for (const step of assemblySteps) {
    for (const tool of step.tools) {
      toolSet.add(tool.name);
    }
  }
  const allTools = Array.from(toolSet).sort();

  // ── Safety notes ─────────────────────────────────────────────────────
  const safetyNotes = [
    "Always wear safety glasses when operating power tools.",
    "Use a push stick when ripping narrow strips on the table saw.",
    "Keep fingers at least 6\" from saw blades at all times.",
    "Work on a flat, stable surface to keep assemblies square.",
    "Get a helper to stand the unit upright if it's taller than 5 feet.",
    "Wear hearing protection when using a miter saw or table saw.",
  ];

  // ── General notes ────────────────────────────────────────────────────
  const generalNotes = [
    `This plan is designed for ${toteType === "HDX" ? "HDX / Home Depot / Menards / Walmart" : "Greenmade / Costco"} 27-gallon totes.`,
    `Tote opening width: ${toFraction(opening)}". Do NOT substitute totes from a different brand without recalculating slot widths.`,
    'All lumber is standard 2×4 (actual 1-1/2" × 3-1/2") and 3/4" plywood.',
    'Screws are #9 star-drive construction screws. No pilot holes needed in 2×4 or plywood.',
    `Finished unit dimensions: ${toFraction(totalW)}" W × ${toFraction(totalH)}" H × ${depth}" D${hasWheels ? ` (${toFraction(totalHWithWheels!)}" H with casters)` : ""}.`,
    "Cut all pieces before starting assembly. Verify lengths by stacking identical parts.",
  ];

  if (hasWheels) {
    generalNotes.push(
      'Industrial 5" swivel casters are mounted at the four corners of the bottom plate. Position swivel pivots directly over post locations for maximum strength.',
    );
  }

  return {
    unitName: planName,
    cols,
    rows,
    toteCount: cols * rows,
    toteType,
    orientation,
    hasWheels,
    hasTop,
    dimensions,
    shoppingList: manifest.shopping_list,
    totals: manifest.totals,
    cutDiagrams,
    plywoodNotes,
    assemblySteps,
    allTools,
    safetyNotes,
    generalNotes,
  };
}
