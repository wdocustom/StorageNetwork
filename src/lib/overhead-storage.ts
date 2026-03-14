// ═══════════════════════════════════════════════════════════════════════════
// Overhead Ceiling Tote Rail System — Configuration & Pricing Engine
//
// 3-layer system lagged to ceiling joists:
//   Layer 1 — Nailer/Ledger (2×4) lag-screwed to joists with washers
//   Layer 2 — Padding (2×4 flat) for lid clearance
//   Layer 3 — Rail strip (3/4" plywood, 2.5" wider than nailer, centered
//             for 1-1/4" ledges on each side where tote rims rest)
//
// Rails run perpendicular to nailers. Totes hang between adjacent rail
// assemblies by their rim/lip. Slot spacing matches the standard tote
// widths (HDX 19-3/4", Greenmade 20-3/4") used in the wall units.
// ═══════════════════════════════════════════════════════════════════════════

// ── Tote & Slot Dimensions (shared with wall-unit system) ────────────────

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
export const NAILER_HEIGHT = 1.5;     // 2×4 mounted flat, 1.5" drop
export const SPACER_HEIGHT = 1.5;     // 2×4 flat, 1.5" drop
export const SPACER_WIDTH = 3.5;      // 2×4 flat, wide face down
export const RAIL_OVERHANG = 1.25;    // Plywood ledge per side
export const RAIL_STRIP_WIDTH = SPACER_WIDTH + 2 * RAIL_OVERHANG; // 6.0"
export const RAIL_THICKNESS = 0.75;   // 3/4" plywood

/** Total assembly drop from ceiling = nailer + padding + rail */
export const TOTAL_DROP = NAILER_HEIGHT + SPACER_HEIGHT + RAIL_THICKNESS; // 3.75"

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

// ── Pricing ──────────────────────────────────────────────────────────────

/** Base price per tote slot for overhead ceiling rail system */
export const OVERHEAD_BASE_PRICE_PER_SLOT = 28;

/** InstallerPricing keys for overhead grid presets */
export const OVERHEAD_PRICING_KEYS = [
  "overhead_2x2",
  "overhead_2x3",
  "overhead_3x2",
  "overhead_3x3",
  "overhead_3x4",
  "overhead_4x4",
] as const;

export const PLATFORM_OVERHEAD_DEFAULTS: Record<string, number> = {
  overhead_2x2: 4 * OVERHEAD_BASE_PRICE_PER_SLOT,   // $112
  overhead_2x3: 6 * OVERHEAD_BASE_PRICE_PER_SLOT,   // $168
  overhead_3x2: 6 * OVERHEAD_BASE_PRICE_PER_SLOT,   // $168
  overhead_3x3: 9 * OVERHEAD_BASE_PRICE_PER_SLOT,   // $252
  overhead_3x4: 12 * OVERHEAD_BASE_PRICE_PER_SLOT,  // $336
  overhead_4x4: 16 * OVERHEAD_BASE_PRICE_PER_SLOT,  // $448
};

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
    price = PLATFORM_OVERHEAD_DEFAULTS[presetKey] ?? toteCount * OVERHEAD_BASE_PRICE_PER_SLOT;
  }

  // Tote pricing — use installer override or platform default ($12/ea standard)
  const OVERHEAD_TOTE_PRICE_DEFAULT = 12;
  const totePricePerUnit = (typeof installerPricing?.standard_tote === "number")
    ? installerPricing.standard_tote
    : OVERHEAD_TOTE_PRICE_DEFAULT;
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
    systemWidthIn: Math.round(systemWidthIn * 100) / 100,
    systemDepthIn: Math.round(systemDepthIn * 100) / 100,
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
  // Need nailers at front, back, and intermediate for support (every ~30" along depth).
  const nailerCount = Math.max(2, Math.ceil(systemDepthIn / 30) + 1);
  const nailerLengthIn = systemWidthIn;
  const nailerLengthFt = Math.ceil(nailerLengthIn / 12);

  // ── Layer 1: Nailers (2×4) ────────────────────────────────────────────
  materials.push({
    name: `2×4 Nailers (${nailerLengthFt}' ea)`,
    qty: nailerCount,
    unit: "pcs",
  });

  // ── Layer 2: Padding beams (2×4 flat) ─────────────────────────────────
  // Continuous beams running the full system depth, one per rail position
  const paddingLengthFt = Math.ceil(systemDepthIn / 12);
  materials.push({
    name: `2×4 Padding Beams (${paddingLengthFt}' ea)`,
    qty: railAssemblies,
    unit: "pcs",
  });

  // ── Layer 3: Rail strips (3/4" plywood, 4" wide) ─────────────────────
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

  // 3" structural screws: padding-to-nailer (2 per crossing) + rail-to-padding (2 per crossing)
  const paddingNailerCrossings = railAssemblies * nailerCount;
  const structuralScrews = paddingNailerCrossings * 4;
  materials.push({
    name: "3\" Structural Screws",
    qty: Math.ceil(structuralScrews * 1.05), // 5% error buffer
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
