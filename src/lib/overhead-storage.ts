// ═══════════════════════════════════════════════════════════════════════════
// Overhead Ceiling Tote Rail System — Configuration & Pricing Engine
//
// 4-layer system lagged to ceiling joists:
//   Layer 1 — Nailer/Ledger (2×4 belly-flat) lag-screwed to joists
//   Layer 2 — Padding 1 (2×4 perpendicular to nailer) for lid clearance
//   Layer 3 — Padding 2 (2×4 perpendicular to nailer) doubles clearance
//   Layer 4 — Rail strip (3/4" plywood, 6" wide, centered on padding
//             for 1-1/4" ledges on each side where tote rims rest)
//
// Double padding gives 3" clearance (1.5" × 2) above the rail strip,
// enough for the tote lid/lip to pass (~2" from lip to top of lid).
//
// Rails run perpendicular to nailers. Totes hang between adjacent rail
// assemblies by their rim/lip. Slot spacing matches the standard tote
// widths (HDX 19-3/4", Greenmade 20-3/4") used in the wall units.
// ═══════════════════════════════════════════════════════════════════════════

// ── Tote & Slot Dimensions (shared with wall-unit system) ────────────────

import { roundMoney } from "@/utils/mathHelpers";

export type OverheadToteType = "HDX" | "GM";

/** Full tote width including lip/rim */
const TOTE_FULL_W: Record<OverheadToteType, number> = {
  HDX: 19.75,
  GM: 20.75,
};

const TOTE_LIP_OVERHANG = 1.0;   // Lip extends 1" past body per side
const SLOT_CLEARANCE = 0.25;     // Tolerance per side
const TOTE_SLOT_LENGTH = 30.5;   // ~30" per tote position along the rail + gap

/** Clear opening between adjacent rail ledges (tote body drops through) */
export function getSlotWidth(toteType: OverheadToteType): number {
  return TOTE_FULL_W[toteType] - 2 * TOTE_LIP_OVERHANG + 2 * SLOT_CLEARANCE;
}

// ── Rail Assembly Dimensions ─────────────────────────────────────────────

export const NAILER_WIDTH = 3.5;      // 2×4 wide face against ceiling
export const NAILER_HEIGHT = 1.5;     // 2×4 mounted belly-flat, 1.5" drop
export const PADDING_LAYERS = 2;      // Two 2×4 padding layers for lid clearance
export const PADDING_HEIGHT = 1.5;    // Each 2×4 padding layer, 1.5" drop
export const PADDING_WIDTH = 3.5;     // 2×4 wide face down
export const RAIL_OVERHANG = 1.25;    // Plywood ledge per side
export const RAIL_STRIP_WIDTH = PADDING_WIDTH + 2 * RAIL_OVERHANG; // 6.0"
export const RAIL_THICKNESS = 0.75;   // 3/4" plywood

/** Total assembly drop from ceiling = nailer + (2 × padding) + rail */
export const TOTAL_DROP = NAILER_HEIGHT + PADDING_LAYERS * PADDING_HEIGHT + RAIL_THICKNESS; // 5.25"

/** Clearance above rail strip for tote lid/lip = 2 × padding height */
export const LID_CLEARANCE = PADDING_LAYERS * PADDING_HEIGHT; // 3.0"

/** Center-to-center distance between adjacent rail assemblies */
export function getRailSpacing(toteType: OverheadToteType): number {
  return getSlotWidth(toteType) + RAIL_STRIP_WIDTH;
}

// ── Grid Presets ─────────────────────────────────────────────────────────

export interface OverheadGridPreset {
  id: string;
  label: string;
  slotsWide: number;
  slotsDeep: number;
  toteCount: number;
}

export const OVERHEAD_GRID_PRESETS: OverheadGridPreset[] = [
  { id: "2x2", label: "2 × 2", slotsWide: 2, slotsDeep: 2, toteCount: 4 },
  { id: "2x3", label: "2 × 3", slotsWide: 2, slotsDeep: 3, toteCount: 6 },
  { id: "3x2", label: "3 × 2", slotsWide: 3, slotsDeep: 2, toteCount: 6 },
  { id: "3x3", label: "3 × 3", slotsWide: 3, slotsDeep: 3, toteCount: 9 },
  { id: "3x4", label: "3 × 4", slotsWide: 3, slotsDeep: 4, toteCount: 12 },
  { id: "4x4", label: "4 × 4", slotsWide: 4, slotsDeep: 4, toteCount: 16 },
];

// ── Configuration ────────────────────────────────────────────────────────

export interface OverheadStorageConfig {
  gridPresetId: string | null;
  toteType: OverheadToteType;
  hasTotes: boolean;
}

// ── Result ───────────────────────────────────────────────────────────────

export interface OverheadStorageResult {
  slotsWide: number;
  slotsDeep: number;
  toteCount: number;
  toteType: OverheadToteType;
  hasTotes: boolean;
  systemWidthIn: number;
  systemDepthIn: number;
  price: number;
  totePrice: number;
  materials: OverheadMaterial[];
}

export interface OverheadMaterial {
  name: string;
  qty: number;
  unit: string;
}

// ── Pricing Keys ─────────────────────────────────────────────────────────

/** InstallerPricing keys for overhead grid presets */
export const OVERHEAD_PRICING_KEYS = [
  "overhead_2x2",
  "overhead_2x3",
  "overhead_3x2",
  "overhead_3x3",
  "overhead_3x4",
  "overhead_4x4",
] as const;

// ── System Dimension Helpers ─────────────────────────────────────────────

/** Compute overall system width in inches */
export function getSystemWidth(slotsWide: number, toteType: OverheadToteType): number {
  // (slotsWide + 1) rail assemblies + slotsWide slot gaps
  return (slotsWide + 1) * RAIL_STRIP_WIDTH + slotsWide * getSlotWidth(toteType);
}

/** Compute overall system depth in inches (along the rail direction) */
export function getSystemDepth(slotsDeep: number): number {
  return slotsDeep * TOTE_SLOT_LENGTH;
}

// ── Calculator ───────────────────────────────────────────────────────────

export function calculateOverheadStorage(
  config: OverheadStorageConfig,
  installerPricing?: Record<string, number | boolean | undefined>,
  platformOverheadDefaults?: Record<string, number>,
  basePricePerSlot?: number,
  defaultTotePrice?: number,
): OverheadStorageResult {
  const preset = OVERHEAD_GRID_PRESETS.find((p) => p.id === config.gridPresetId);
  if (!preset) throw new Error(`Unknown overhead grid preset: ${config.gridPresetId}`);

  const { slotsWide, slotsDeep, toteCount } = preset;
  const { toteType } = config;

  const systemWidthIn = getSystemWidth(slotsWide, toteType);
  const systemDepthIn = getSystemDepth(slotsDeep);

  // Lag bolt estimation uses 16" OC (standard residential) as default
  const joistSpacingIn = 16;

  // Price — check installer override first
  let price: number;
  const presetKey = `overhead_${preset.id}`;
  const overridePrice = installerPricing?.[presetKey];

  if (typeof overridePrice === "number" && overridePrice > 0) {
    price = overridePrice;
  } else {
    const fallbackPerSlot = basePricePerSlot ?? 28;
    price = (platformOverheadDefaults?.[presetKey]) ?? toteCount * fallbackPerSlot;
  }

  // Tote pricing — use installer override or platform default
  const totePricePerUnit = (typeof installerPricing?.standard_tote === "number")
    ? installerPricing.standard_tote
    : (defaultTotePrice ?? 0);
  const totePrice = config.hasTotes ? toteCount * totePricePerUnit : 0;
  price += totePrice;

  // Materials
  const materials = computeOverheadMaterials(
    slotsWide, slotsDeep, toteType, systemWidthIn, systemDepthIn, joistSpacingIn, config.hasTotes,
  );

  return {
    slotsWide,
    slotsDeep,
    toteCount,
    toteType,
    hasTotes: config.hasTotes,
    systemWidthIn: roundMoney(systemWidthIn),
    systemDepthIn: roundMoney(systemDepthIn),
    price,
    totePrice,
    materials,
  };
}

// ── Material Calculator ──────────────────────────────────────────────────

function computeOverheadMaterials(
  slotsWide: number,
  slotsDeep: number,
  toteType: OverheadToteType,
  systemWidthIn: number,
  systemDepthIn: number,
  joistSpacingIn: number,
  hasTotes: boolean = true,
): OverheadMaterial[] {
  const materials: OverheadMaterial[] = [];

  // Number of rail assemblies (each assembly = nailer + spacer + rail strip)
  const railAssemblies = slotsWide + 1;

  // Nailer count & spacing:
  // Nailers run perpendicular to rail strips, crossing ceiling joists.
  // Need nailers at front, back, and intermediate for support (every ~48" along depth).
  const nailerCount = Math.max(2, Math.ceil(systemDepthIn / 48) + 1);
  const nailerLengthIn = systemWidthIn;
  const nailerLengthFt = Math.ceil(nailerLengthIn / 12);

  // ── Layer 1: Nailers (2×4) ────────────────────────────────────────────
  materials.push({
    name: `2×4 Nailers (${nailerLengthFt}' ea)`,
    qty: nailerCount,
    unit: "pcs",
  });

  // ── Layers 2 & 3: Double padding beams (2×4 perpendicular to nailers) ─
  // Two stacked 2×4s per rail position give 3" clearance for tote lid/lip.
  // Each beam runs the full system depth.
  const paddingLengthFt = Math.ceil(systemDepthIn / 12);
  const paddingPerRail = PADDING_LAYERS; // 2 layers stacked
  materials.push({
    name: `2×4 Padding Beams (${paddingLengthFt}' ea)`,
    qty: railAssemblies * paddingPerRail,
    unit: "pcs",
  });

  // ── Layer 4: Rail strips (3/4" plywood, 6" wide) ─────────────────────
  // Each rail strip runs the full system depth, attached across all nailers
  const railStripLengthFt = Math.ceil(systemDepthIn / 12);
  materials.push({
    name: `3/4" Plywood Rail Strips (4" × ${railStripLengthFt}')`,
    qty: railAssemblies,
    unit: "strips",
  });

  // Plywood sheets needed to rip the strips
  // One 4'×8' sheet yields 12 strips at 4" wide, each up to 96" long
  const stripsPerSheet = 12;
  const railSegments = railAssemblies * Math.ceil(systemDepthIn / 96);
  const plywoodSheets = Math.ceil(railSegments / stripsPerSheet);
  materials.push({
    name: "3/4\" Plywood Sheets (4×8) for rails",
    qty: plywoodSheets,
    unit: "sheets",
  });

  // ── Hardware ──────────────────────────────────────────────────────────
  // Lag bolts: nailer to joist. Each nailer crosses joists along the system width.
  const joistCrossingsPerNailer = Math.ceil(nailerLengthIn / joistSpacingIn) + 1;
  const totalLagBolts = nailerCount * joistCrossingsPerNailer * 2; // 2 per crossing
  materials.push({
    name: "5/16\" × 3\" Lag Bolts + Washers",
    qty: totalLagBolts,
    unit: "pcs",
  });

  // 3" structural screws: padding-to-nailer at each crossing, 2 per layer.
  // With double padding: layer 1→nailer (2 screws) + layer 2→layer 1 (2 screws) = 4 per crossing.
  // (Rail strips attach to top padding with shorter 1-5/8" screws, not structural.)
  const paddingNailerCrossings = railAssemblies * nailerCount;
  const structuralScrews = paddingNailerCrossings * 2 * PADDING_LAYERS;
  materials.push({
    name: "3\" Structural Screws",
    qty: structuralScrews,
    unit: "pcs",
  });

  // Tote count (informational — for purchase list)
  if (hasTotes) {
    const toteLabel = toteType === "HDX" ? "HDX 27-Gal Totes (Yellow Lid)" : "Greenmade 27-Gal Totes";
    materials.push({
      name: toteLabel,
      qty: slotsWide * slotsDeep,
      unit: "totes",
    });
  }

  return materials;
}
