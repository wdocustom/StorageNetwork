"use server";

// ═══════════════════════════════════════════════════════════════════════════
// BLACK BOX — Server-side calculator (proprietary math never leaves server)
// ═══════════════════════════════════════════════════════════════════════════

export type ToteModel = "HDX" | "GM";
export type UnitType = "standard" | "mini";

interface CalculateBuildInput {
  wallWidth?: number;
  wallHeight?: number;
  cols?: number;
  rows?: number;
  toteModel: ToteModel;
  unitType?: UnitType;
  addOns: {
    totes: boolean;
    wheels: boolean;
    top: boolean;
  };
  mode: "wallFit" | "manual";
}

interface BuildResult {
  success: true;
  cols: number;
  rows: number;
  price: number;
  dimensions: { totalW: number; totalH: number; depth: number };
  config: {
    toteModel: ToteModel;
    unitType: UnitType;
    hasTotes: boolean;
    hasWheels: boolean;
    hasTop: boolean;
    slots: number;
    topSheets: number;
  };
}

interface BuildError {
  success: false;
  error: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIT TYPE DIMENSION CONFIGS — Easily extendable for future sizes
// ═══════════════════════════════════════════════════════════════════════════

interface UnitDimensionConfig {
  // Slot/bay dimensions
  slotWidth: number;           // Width of each tote slot
  verticalSpacing: number;     // Rail-to-rail (center-to-center) vertical spacing
  firstRailHeight: number;     // Height of first rail from bottom plate
  depth: number;               // Rail length / unit depth

  // Structure dimensions
  postWidth: number;           // Post narrow face (gap between bays)
  postDepth: number;           // Post wide face
  plateHeight: number;         // Bottom/top plate thickness
  topGap: number;              // Gap above top rail to top plate

  // Rail dimensions
  railWidth: number;           // Width of plywood rail strips
  railThickness: number;       // Thickness of plywood rails

  // Tote dimensions
  toteWidth: number;           // Tote width (for mini, single size)
  toteHeight: number;          // Tote body height
  toteDepth: number;           // Tote depth

  // Structure type
  hasTopPlate: boolean;        // Whether unit has 2x4 top plate
  topIsMandatory: boolean;     // Whether plywood top is mandatory

  // Pricing
  pricePerSlot: number;
  pricePerTote: number;
  priceWheels: number;
  pricePlywoodSheet: number;
}

// ── Standard Unit (27 Gallon Totes) ──────────────────────────────────────
const STANDARD_CONFIG: UnitDimensionConfig = {
  slotWidth: 0,                // Calculated from tote model (HDX/GM)
  verticalSpacing: 16,         // 16" center-to-center between tiers
  firstRailHeight: 13,         // ~13" from bottom plate (allows tote body to hang)
  depth: 30,                   // 30" deep

  postWidth: 1.5,              // 2x4 narrow face
  postDepth: 3.5,              // 2x4 wide face
  plateHeight: 1.5,            // 2x4 flat
  topGap: 2.5,                 // Gap above top rail

  railWidth: 1.875,            // 1-7/8" plywood strips
  railThickness: 0.75,         // 3/4" plywood

  toteWidth: 0,                // Set by tote model
  toteHeight: 11,              // Body height
  toteDepth: 28.6,             // Slightly less than unit depth

  hasTopPlate: true,
  topIsMandatory: false,

  pricePerSlot: 40,
  pricePerTote: 12,
  priceWheels: 45,
  pricePlywoodSheet: 75,
};

// ── Mini Unit (6.5 Quart Totes) ──────────────────────────────────────────
const MINI_CONFIG: UnitDimensionConfig = {
  slotWidth: 8.25,             // Fits 8" wide tote
  verticalSpacing: 7,          // 7" rail-to-rail
  firstRailHeight: 5.25,       // 5.25" from bottom plate
  depth: 12.75,                // 12.75" deep

  postWidth: 1.5,              // 2x4 narrow face (same as standard)
  postDepth: 3.5,              // 2x4 wide face
  plateHeight: 1.5,            // 2x4 bottom plate only
  topGap: 0,                   // No top plate gap (solid plywood top)

  railWidth: 1.0,              // 1" wide plywood strips
  railThickness: 0.75,         // 3/4" plywood

  toteWidth: 8,                // 8" wide shoebox tote
  toteHeight: 6.25,            // Approx 6.25" tall
  toteDepth: 12.75,            // Same as unit depth

  hasTopPlate: false,          // No 2x4 top plates
  topIsMandatory: true,        // Always has plywood top

  pricePerSlot: 25,            // Lower price for mini
  pricePerTote: 4,             // 6.5qt totes are cheaper
  priceWheels: 40,             // Slightly cheaper wheels
  pricePlywoodSheet: 75,       // Same plywood price
};

// ── Config getter ────────────────────────────────────────────────────────
function getUnitConfig(unitType: UnitType): UnitDimensionConfig {
  return unitType === "mini" ? MINI_CONFIG : STANDARD_CONFIG;
}

// ── Proprietary constants (legacy, kept for reference) ───────────────────
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;

function getOpening(model: ToteModel, unitType: UnitType): number {
  if (unitType === "mini") {
    return MINI_CONFIG.slotWidth;
  }
  return model === "HDX" ? OPENING_HDX : OPENING_GM;
}

export async function calculateBuild(
  input: CalculateBuildInput
): Promise<BuildResult | BuildError> {
  const { toteModel, addOns, mode } = input;
  const unitType: UnitType = input.unitType ?? "standard";
  const config = getUnitConfig(unitType);
  const opening = getOpening(toteModel, unitType);

  let cols: number;
  let rows: number;

  if (mode === "wallFit") {
    const { wallWidth, wallHeight } = input;
    if (!wallWidth || !wallHeight || wallWidth <= 0 || wallHeight <= 0) {
      return { success: false, error: "Valid wall dimensions are required." };
    }
    // Wall fit calculation using config values
    cols = Math.floor((wallWidth - config.postWidth) / (opening + config.postWidth));
    const usableHeight = wallHeight - config.plateHeight - (config.hasTopPlate ? config.plateHeight : 0) - config.firstRailHeight;
    rows = Math.floor(usableHeight / config.verticalSpacing) + 1;
    if (cols < 1) cols = 1;
    if (rows < 1) rows = 1;
  } else {
    cols = input.cols ?? 1;
    rows = input.rows ?? 1;
    if (cols < 1) cols = 1;
    if (cols > 20) cols = 20;
    if (rows < 1) rows = 1;
    if (rows > 20) rows = 20;
  }

  // ── Dimensions ─────────────────────────────────────────────────────────
  const totalW = cols * opening + (cols + 1) * config.postWidth;

  // Height calculation differs for Standard vs Mini
  let totalH: number;
  if (unitType === "mini") {
    // Mini: bottom plate + first rail height + (rows-1) * spacing + top plywood
    // No top 2x4 plates, just plywood top
    const lastRailHeight = config.firstRailHeight + (rows - 1) * config.verticalSpacing;
    totalH = config.plateHeight + lastRailHeight + 2 + 0.75; // +2" clearance above last rail + 3/4" plywood top
  } else {
    // Standard: bottom plate + top plate + rails + top gap
    totalH = rows * config.verticalSpacing + config.plateHeight * 2 + config.topGap;
  }

  // ── Pricing ────────────────────────────────────────────────────────────
  const slots = cols * rows;
  let price = slots * config.pricePerSlot;
  if (addOns.totes) price += slots * config.pricePerTote;
  if (addOns.wheels) price += config.priceWheels;

  // Plywood top calculation
  let topSheets = 0;
  const effectiveHasTop = config.topIsMandatory || addOns.top;

  if (effectiveHasTop) {
    if (unitType === "mini") {
      // Mini: calculate plywood for top + rails
      // Top: totalW x depth
      // Rails: 1" x depth for each rail (2 rails per bay per tier)
      const topSqFt = (totalW * config.depth) / 144;
      const railSqFt = (config.railWidth * config.depth * cols * rows * 2) / 144;
      const totalSqFt = topSqFt + railSqFt;
      // 4x8 sheet = 32 sq ft
      topSheets = Math.ceil(totalSqFt / 32);
    } else {
      // Standard: simple sheet calculation
      if (totalW > 192) topSheets = 3;
      else if (totalW > 96) topSheets = 2;
      else topSheets = 1;
    }
    price += topSheets * config.pricePlywoodSheet;
  }

  return {
    success: true,
    cols,
    rows,
    price,
    dimensions: { totalW, totalH, depth: config.depth },
    config: {
      toteModel,
      unitType,
      hasTotes: addOns.totes,
      hasWheels: addOns.wheels,
      hasTop: effectiveHasTop,
      slots,
      topSheets,
    },
  };
}
