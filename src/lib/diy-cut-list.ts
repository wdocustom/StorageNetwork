// ═══════════════════════════════════════════════════════════════════════════
// DIY CUT LIST GENERATOR — Color-coded parts matrix for blueprint PDFs
//
// Calculates exact lengths and quantities of every 2×4 and plywood piece
// based on the user's configuration. Assigns a unique letter + color to
// each distinct part length for visual reference in assembly diagrams.
//
// Uses the same dimension constants as the 3D engine (Rack3D.tsx) and
// the build engine (buildEngine.ts).
// ═══════════════════════════════════════════════════════════════════════════

import { toFraction } from "@/lib/utils";

// ── Dimension constants (match Rack3D.tsx / generate-plan.ts) ───────────

const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const SIDEWAYS_OPENING = 30.25;
const POST_WIDTH = 1.5;
const TIER_SPACING = 16;
const DEPTH_STANDARD = 30;
const DEPTH_SIDEWAYS = 20;
const RAIL_STRIP_WIDTH = 1.875; // 1-7/8"
const CASTER_HEIGHT = 2.75;
const PLY_TOP_THICKNESS = 0.75;
const STOCK_LENGTH = 96; // 8' board
const KERF = 0.125;

// ── Color palette for part labels (high-contrast, print-friendly) ──────

const PART_COLORS = [
  { bg: "#3B82F6", fg: "#FFFFFF", name: "Blue" },     // A
  { bg: "#EF4444", fg: "#FFFFFF", name: "Red" },      // B
  { bg: "#22C55E", fg: "#FFFFFF", name: "Green" },    // C
  { bg: "#F59E0B", fg: "#000000", name: "Amber" },    // D
  { bg: "#8B5CF6", fg: "#FFFFFF", name: "Purple" },   // E
  { bg: "#EC4899", fg: "#FFFFFF", name: "Pink" },     // F
  { bg: "#14B8A6", fg: "#FFFFFF", name: "Teal" },     // G
  { bg: "#F97316", fg: "#FFFFFF", name: "Orange" },   // H
] as const;

// ── Types ──────────────────────────────────────────────────────────────

export interface CutListConfig {
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  unitType: "standard" | "mini";
  orientation: "standard" | "sideways";
  hasWheels: boolean;
  hasTop: boolean;
}

export interface CutListPart {
  /** Letter label (A, B, C...) */
  label: string;
  /** Part name (e.g. "Upright Post") */
  name: string;
  /** Cut length in inches */
  length: number;
  /** Display string (e.g. '64"') */
  lengthStr: string;
  /** How many of this part to cut */
  qty: number;
  /** Material type */
  material: "2x4" | "plywood";
  /** Color for visual coding */
  color: { bg: string; fg: string; name: string };
}

export interface HardwareItem {
  name: string;
  qty: number | string;
  detail: string;
}

export interface BoardLayout {
  boardIndex: number;
  stockLength: number;
  cuts: { length: number; label: string; color: { bg: string; fg: string } }[];
  remainder: number;
}

export interface CutListResult {
  parts: CutListPart[];
  hardware: HardwareItem[];
  boardLayouts: BoardLayout[];
  plywoodNotes: string[];
  /** Total 2×4×8' boards needed */
  totalBoards: number;
  /** Total 3/4" plywood sheets needed */
  totalSheets: number;
  /** Finished dimensions */
  dimensions: {
    totalW: number;
    totalWStr: string;
    totalH: number;
    totalHStr: string;
    totalHWithWheels: number | null;
    totalHWithWheelsStr: string | null;
    depth: number;
    depthStr: string;
    uprightH: number;
    uprightHStr: string;
    plateLen: number;
    plateLenStr: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main generator
// ═══════════════════════════════════════════════════════════════════════════

export function generateCutList(config: CutListConfig): CutListResult {
  const { cols, rows, toteType, orientation, hasWheels, hasTop } = config;

  // ── Calculate dimensions ────────────────────────────────────────────
  const opening =
    orientation === "sideways"
      ? SIDEWAYS_OPENING
      : toteType === "HDX"
      ? OPENING_HDX
      : OPENING_GM;
  const depth = orientation === "sideways" ? DEPTH_SIDEWAYS : DEPTH_STANDARD;
  const plateLen = cols * opening + (cols + 1) * POST_WIDTH;
  const uprightH = rows * TIER_SPACING;
  const totalH = uprightH + 2 * POST_WIDTH + 2.5; // 2 plates + gap
  const totalHWithWheels = hasWheels ? totalH + CASTER_HEIGHT : null;

  // ── Build parts list ────────────────────────────────────────────────
  const parts: CutListPart[] = [];
  let partIdx = 0;

  function addPart(name: string, length: number, qty: number, material: "2x4" | "plywood") {
    const color = PART_COLORS[partIdx % PART_COLORS.length];
    parts.push({
      label: String.fromCharCode(65 + partIdx), // A, B, C...
      name,
      length,
      lengthStr: toFraction(length) + '"',
      qty,
      material,
      color: { bg: color.bg, fg: color.fg, name: color.name },
    });
    partIdx++;
  }

  // Uprights
  const numPosts = (cols + 1) * 2; // front + back
  addPart("Upright Post", uprightH, numPosts, "2x4");

  // Plates (top + bottom, front + back)
  addPart("Bottom/Top Plate", plateLen, 4, "2x4");

  // Plywood rail strips
  const numRails = cols * rows * 2; // left + right per bay per tier
  addPart("Plywood Rail Strip", depth, numRails, "plywood");

  // Back supports (diagonal bracing)
  const backSupports = cols <= 4 ? 4 : 6;
  addPart("Back Support Brace", depth, backSupports, "plywood");

  // Plywood top (if applicable)
  if (hasTop) {
    const topSheets = plateLen > 96 ? 2 : 1;
    addPart("Plywood Top", plateLen, topSheets, "plywood");
  }

  // ── Hardware list ───────────────────────────────────────────────────
  const hardware: HardwareItem[] = [];

  // Rail screws: 2 per rail end × 2 ends = 4 per rail
  const railScrews = numRails * 4;
  hardware.push({
    name: '#9 × 1-5/8" Star Drive Screws',
    qty: railScrews + backSupports * 4 + (hasTop ? (cols + 1) * 2 : 0),
    detail: "For rails, back supports" + (hasTop ? ", and plywood top" : ""),
  });

  // Plate screws: 2 per connection × (cols+1) posts × 2 plates × 2 (top+bottom)
  const plateScrews = (cols + 1) * 2 * 2 * 2;
  hardware.push({
    name: '#9 × 3" Star Drive Screws',
    qty: plateScrews,
    detail: "For attaching plates to uprights",
  });

  if (hasWheels) {
    hardware.push({
      name: '5" Heavy-Duty Swivel Casters',
      qty: 4,
      detail: "Industrial grade, 4 corner-mounted",
    });
    hardware.push({
      name: '1/4" × 1-1/2" Lag Screws',
      qty: 16,
      detail: "4 per caster mounting plate",
    });
  }

  // ── Board layout (bin-packing for 2×4s) ─────────────────────────────
  // Collect all 2×4 cuts with their labels
  const allCuts: { length: number; label: string; color: { bg: string; fg: string } }[] = [];
  for (const part of parts) {
    if (part.material !== "2x4") continue;
    for (let i = 0; i < part.qty; i++) {
      allCuts.push({ length: part.length, label: part.label, color: { bg: part.color.bg, fg: part.color.fg } });
    }
  }
  // Sort longest first for better packing
  allCuts.sort((a, b) => b.length - a.length);

  const bins: { remaining: number; cuts: typeof allCuts }[] = [];
  for (const cut of allCuts) {
    let placed = false;
    for (const bin of bins) {
      if (bin.remaining >= cut.length + KERF) {
        bin.cuts.push(cut);
        bin.remaining -= cut.length + KERF;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bins.push({
        remaining: STOCK_LENGTH - cut.length,
        cuts: [cut],
      });
    }
  }

  const boardLayouts: BoardLayout[] = bins.map((bin, i) => ({
    boardIndex: i + 1,
    stockLength: STOCK_LENGTH,
    cuts: bin.cuts,
    remainder: Math.round(bin.remaining * 100) / 100,
  }));

  // ── Plywood notes ───────────────────────────────────────────────────
  const plywoodNotes: string[] = [];
  plywoodNotes.push(
    `Rip ${numRails} strips at ${toFraction(RAIL_STRIP_WIDTH)}" wide × ${depth}" long from 3/4" plywood.`
  );
  plywoodNotes.push(
    `From each 4'×8' sheet: rip a ${depth}" wide offcut along the 96" side, then crosscut into ${depth}"×${depth}" squares.`
  );
  const sheetsNeeded = Math.ceil(numRails / 48) + (hasTop ? (plateLen > 96 ? 2 : 1) : 0);
  plywoodNotes.push(
    `Total plywood sheets needed: ${sheetsNeeded} sheet${sheetsNeeded > 1 ? "s" : ""} of 3/4" plywood.`
  );

  return {
    parts,
    hardware,
    boardLayouts,
    plywoodNotes,
    totalBoards: bins.length,
    totalSheets: sheetsNeeded,
    dimensions: {
      totalW: plateLen,
      totalWStr: toFraction(plateLen) + '"',
      totalH,
      totalHStr: toFraction(totalH) + '"',
      totalHWithWheels,
      totalHWithWheelsStr: totalHWithWheels ? toFraction(totalHWithWheels) + '"' : null,
      depth,
      depthStr: depth + '"',
      uprightH,
      uprightHStr: uprightH + '"',
      plateLen,
      plateLenStr: toFraction(plateLen) + '"',
    },
  };
}
