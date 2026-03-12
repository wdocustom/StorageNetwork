// ═══════════════════════════════════════════════════════════════════════════
// Overhead Ceiling Storage — Configuration & Pricing Engine
// ═══════════════════════════════════════════════════════════════════════════

/** Preset sizes for overhead ceiling storage platforms */
export interface OverheadStoragePreset {
  id: string;
  label: string;
  widthFt: number;
  depthFt: number;
  widthIn: number;
  depthIn: number;
}

/** Drop height from ceiling (distance the platform hangs down) */
export interface OverheadDropHeight {
  id: string;
  label: string;
  inches: number;
}

/** Joist spacing options */
export interface OverheadJoistSpacing {
  id: string;
  label: string;
  inches: number;
}

/** Deck type for the overhead platform (always plywood) */
export type OverheadDeckType = "plywood";

/** Full overhead storage configuration */
export interface OverheadStorageConfig {
  sizePresetId: string | null;
  customWidthIn: number | null;
  customDepthIn: number | null;
  dropHeightId: string;
  joistSpacingId: string;
  deckType: OverheadDeckType;
}

/** Computed result from the overhead storage calculator */
export interface OverheadStorageResult {
  widthIn: number;
  depthIn: number;
  dropHeightIn: number;
  joistSpacingIn: number;
  deckType: OverheadDeckType;
  price: number;
  materials: OverheadMaterial[];
  sqft: number;
}

export interface OverheadMaterial {
  name: string;
  qty: number;
  unit: string;
}

// ── Presets ─────────────────────────────────────────────────────────────

export const OVERHEAD_SIZE_PRESETS: OverheadStoragePreset[] = [
  { id: "4x8",  label: "4' × 8'",  widthFt: 4, depthFt: 8, widthIn: 48,  depthIn: 96 },
  { id: "4x6",  label: "4' × 6'",  widthFt: 4, depthFt: 6, widthIn: 48,  depthIn: 72 },
  { id: "4x4",  label: "4' × 4'",  widthFt: 4, depthFt: 4, widthIn: 48,  depthIn: 48 },
  { id: "3x8",  label: "3' × 8'",  widthFt: 3, depthFt: 8, widthIn: 36,  depthIn: 96 },
  { id: "3x6",  label: "3' × 6'",  widthFt: 3, depthFt: 6, widthIn: 36,  depthIn: 72 },
  { id: "2x8",  label: "2' × 8'",  widthFt: 2, depthFt: 8, widthIn: 24,  depthIn: 96 },
];

export const OVERHEAD_DROP_HEIGHTS: OverheadDropHeight[] = [
  { id: "12",  label: "12\"",  inches: 12 },
  { id: "24",  label: "24\"",  inches: 24 },
  { id: "36",  label: "36\"",  inches: 36 },
  { id: "45",  label: "45\"",  inches: 45 },
];

export const OVERHEAD_JOIST_SPACINGS: OverheadJoistSpacing[] = [
  { id: "16", label: "16\" OC", inches: 16 },
  { id: "24", label: "24\" OC", inches: 24 },
];

// ── Platform Default Pricing ────────────────────────────────────────────

/** Base price per square foot for overhead storage */
export const OVERHEAD_BASE_PRICE_PER_SQFT = 6;

/** Price premium for plywood deck vs wire deck */
export const OVERHEAD_PLYWOOD_PREMIUM_PER_SQFT = 2;

/** Additional cost per drop-height tier above 12" */
export const OVERHEAD_DROP_HEIGHT_PREMIUM: Record<string, number> = {
  "12": 0,
  "24": 15,
  "36": 30,
  "45": 45,
};

/** InstallerPricing keys for overhead storage */
export const OVERHEAD_PRICING_KEYS = [
  "overhead_4x8",
  "overhead_4x6",
  "overhead_4x4",
  "overhead_3x8",
  "overhead_3x6",
  "overhead_2x8",
] as const;

// ── Calculator ──────────────────────────────────────────────────────────

export function calculateOverheadStorage(
  config: OverheadStorageConfig,
  installerPricing?: Record<string, number | boolean | undefined>,
): OverheadStorageResult {
  // Resolve dimensions
  let widthIn: number;
  let depthIn: number;

  if (config.sizePresetId) {
    const preset = OVERHEAD_SIZE_PRESETS.find((p) => p.id === config.sizePresetId);
    if (!preset) throw new Error(`Unknown overhead preset: ${config.sizePresetId}`);
    widthIn = preset.widthIn;
    depthIn = preset.depthIn;
  } else {
    widthIn = config.customWidthIn ?? 48;
    depthIn = config.customDepthIn ?? 96;
  }

  // Clamp to reasonable bounds
  widthIn = Math.max(24, Math.min(96, widthIn));
  depthIn = Math.max(24, Math.min(192, depthIn));

  const dropHeight = OVERHEAD_DROP_HEIGHTS.find((d) => d.id === config.dropHeightId);
  const dropHeightIn = dropHeight?.inches ?? 24;

  const joistSpacing = OVERHEAD_JOIST_SPACINGS.find((j) => j.id === config.joistSpacingId);
  const joistSpacingIn = joistSpacing?.inches ?? 16;

  const sqft = (widthIn * depthIn) / 144;

  // Check for installer price override first
  let price: number;
  const presetKey = config.sizePresetId ? `overhead_${config.sizePresetId.replace("x", "x")}` : null;
  const overridePrice = presetKey && installerPricing?.[presetKey];

  if (typeof overridePrice === "number" && overridePrice > 0) {
    price = overridePrice;
    // Apply deck & drop height adjustments on top of override
    if (config.deckType === "plywood") {
      price += Math.round(sqft * OVERHEAD_PLYWOOD_PREMIUM_PER_SQFT);
    }
    price += OVERHEAD_DROP_HEIGHT_PREMIUM[config.dropHeightId] ?? 0;
  } else {
    // Platform default pricing
    price = Math.round(sqft * OVERHEAD_BASE_PRICE_PER_SQFT);
    if (config.deckType === "plywood") {
      price += Math.round(sqft * OVERHEAD_PLYWOOD_PREMIUM_PER_SQFT);
    }
    price += OVERHEAD_DROP_HEIGHT_PREMIUM[config.dropHeightId] ?? 0;
  }

  // ── Materials list ──────────────────────────────────────────────────
  const materials = computeOverheadMaterials(widthIn, depthIn, dropHeightIn, joistSpacingIn, config.deckType);

  return {
    widthIn,
    depthIn,
    dropHeightIn,
    joistSpacingIn,
    deckType: config.deckType,
    price,
    materials,
    sqft: Math.round(sqft * 10) / 10,
  };
}

function computeOverheadMaterials(
  widthIn: number,
  depthIn: number,
  dropHeightIn: number,
  joistSpacingIn: number,
  deckType: OverheadDeckType,
): OverheadMaterial[] {
  const materials: OverheadMaterial[] = [];

  // Vertical supports (2×4) — one at each corner + one per joist spacing along the long side
  const supportsAlongDepth = Math.ceil(depthIn / joistSpacingIn) + 1;
  const supportsAlongWidth = Math.ceil(widthIn / joistSpacingIn) + 1;
  // Supports hang from ceiling joists on both width-side rails
  const verticalSupports = (supportsAlongDepth * 2);

  // Each vertical support is dropHeight + ~6" for lag bolt penetration
  const supportLengthIn = dropHeightIn + 6;
  const supportBoardFt = Math.ceil((supportLengthIn * verticalSupports) / 12);

  materials.push({
    name: "2×4 Vertical Supports",
    qty: verticalSupports,
    unit: "pcs",
  });

  // Cross beams (2×4) — span the width, one at each support point
  const crossBeams = supportsAlongDepth;
  materials.push({
    name: `2×4 Cross Beams (${Math.ceil(widthIn / 12)}'ea)`,
    qty: crossBeams,
    unit: "pcs",
  });

  // Side rails (2×4) — run along the depth on both sides
  materials.push({
    name: `2×4 Side Rails (${Math.ceil(depthIn / 12)}'ea)`,
    qty: 2,
    unit: "pcs",
  });

  // Deck material
  if (deckType === "plywood") {
    // 4×8 sheets needed
    const sheetsNeeded = Math.ceil((widthIn * depthIn) / (48 * 96));
    materials.push({
      name: "3/4\" Plywood Sheets (4×8)",
      qty: sheetsNeeded,
      unit: "sheets",
    });
  } else {
    // Wire deck panels — typically 24"×48" panels
    const panelsNeeded = Math.ceil((widthIn * depthIn) / (24 * 48));
    materials.push({
      name: "Wire Deck Panels (24×48)",
      qty: panelsNeeded,
      unit: "panels",
    });
  }

  // Hardware
  materials.push({
    name: "5/16\" × 3\" Lag Bolts",
    qty: verticalSupports * 2,  // 2 per support into joist
    unit: "pcs",
  });

  materials.push({
    name: "3\" Structural Screws",
    qty: crossBeams * 4 + 8,  // 4 per cross beam connection + rail connections
    unit: "pcs",
  });

  return materials;
}

// ── Platform defaults for pricing settings ──────────────────────────────

export const PLATFORM_OVERHEAD_DEFAULTS: Record<string, number> = {
  overhead_4x8: Math.round((48 * 96 / 144) * OVERHEAD_BASE_PRICE_PER_SQFT),  // 32 sqft × $6 = $192
  overhead_4x6: Math.round((48 * 72 / 144) * OVERHEAD_BASE_PRICE_PER_SQFT),  // 24 sqft × $6 = $144
  overhead_4x4: Math.round((48 * 48 / 144) * OVERHEAD_BASE_PRICE_PER_SQFT),  // 16 sqft × $6 = $96
  overhead_3x8: Math.round((36 * 96 / 144) * OVERHEAD_BASE_PRICE_PER_SQFT),  // 24 sqft × $6 = $144
  overhead_3x6: Math.round((36 * 72 / 144) * OVERHEAD_BASE_PRICE_PER_SQFT),  // 18 sqft × $6 = $108
  overhead_2x8: Math.round((24 * 96 / 144) * OVERHEAD_BASE_PRICE_PER_SQFT),  // 16 sqft × $6 = $96
};
