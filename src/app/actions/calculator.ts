"use server";

// ═══════════════════════════════════════════════════════════════════════════
// BLACK BOX — Server-side calculator (proprietary math never leaves server)
// ═══════════════════════════════════════════════════════════════════════════

export type ToteModel = "HDX" | "GM";
export type ToteColor = "black" | "clear";
export type UnitType = "standard" | "mini";
export type Orientation = "standard" | "sideways";

import type { InstallerPricing, SectionAddon, AddonPricing } from "@/types/viewModels";
import { PLATFORM_BESTSELLER_DEFAULTS, PLATFORM_SHELVING_DEFAULTS, ADDON_PLATFORM_DEFAULTS } from "@/types/viewModels";

interface CalculateBuildInput {
  wallWidth?: number;
  wallHeight?: number;
  cols?: number;
  rows?: number;
  toteModel: ToteModel;
  toteColor?: ToteColor; // Only applies to HDX standard units
  unitType?: UnitType;
  orientation?: Orientation; // Only applies to standard units
  addOns: {
    totes: boolean;
    wheels: boolean;
    top: boolean;
  };
  mode: "wallFit" | "manual";
  /** Optional installer pricing overrides (Pro feature) */
  installerPricing?: InstallerPricing;
  /** Per-section addons (Organizer Customization) */
  sectionAddons?: SectionAddon[];
}

interface BuildResult {
  success: true;
  cols: number;
  rows: number;
  price: number;
  addonPrice: number;
  dimensions: { totalW: number; totalH: number; depth: number };
  config: {
    toteModel: ToteModel;
    toteColor: ToteColor;
    unitType: UnitType;
    orientation: Orientation;
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

// ── Tote Pricing Constants ────────────────────────────────────────────────
const STANDARD_TOTE_BLACK_PRICE = 12;    // HDX Black/Yellow totes
const STANDARD_TOTE_CLEAR_PRICE = 20;    // HDX Clear/Yellow totes (+$8)

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

  pricePerSlot: 30,
  pricePerTote: 12,            // Base price (black), clear uses STANDARD_TOTE_CLEAR_PRICE
  priceWheels: 65,
  pricePlywoodSheet: 95,
};

// ── Standard Unit SIDEWAYS Orientation (27 Gallon Totes rotated 90°) ─────
// Totes are placed sideways: width becomes 30.25", depth becomes 20"
const SIDEWAYS_CONFIG: UnitDimensionConfig = {
  slotWidth: 30.25,              // Tote placed sideways (30.25" wide slot)
  verticalSpacing: 16,           // Same vertical spacing as standard
  firstRailHeight: 13,           // Same as standard
  depth: 20,                     // Reduced depth (tote width becomes depth)

  postWidth: 1.5,                // 2x4 narrow face (same)
  postDepth: 3.5,                // 2x4 wide face
  plateHeight: 1.5,              // 2x4 flat
  topGap: 2.5,                   // Same as standard

  railWidth: 1.875,              // Same plywood strips
  railThickness: 0.75,           // 3/4" plywood

  toteWidth: 0,                  // Set by tote model (but oriented sideways)
  toteHeight: 11,                // Body height (same)
  toteDepth: 28.6,               // Tote depth (same physical tote)

  hasTopPlate: true,
  topIsMandatory: false,

  // Same pricing as standard (for now)
  pricePerSlot: 30,
  pricePerTote: 12,
  priceWheels: 65,
  pricePlywoodSheet: 95,
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

  pricePerSlot: 15,            // Lower price for mini
  pricePerTote: 4,             // 6.5qt totes are cheaper
  priceWheels: 40,             // Slightly cheaper wheels
  pricePlywoodSheet: 95,       // Same plywood price
};

// ── Config getter ────────────────────────────────────────────────────────
function getUnitConfig(unitType: UnitType, orientation: Orientation = "standard"): UnitDimensionConfig {
  if (unitType === "mini") return MINI_CONFIG;
  // Standard unit: check orientation
  return orientation === "sideways" ? SIDEWAYS_CONFIG : STANDARD_CONFIG;
}

// ── Mini Unit Constraints ────────────────────────────────────────────────
const MINI_MAX_TIERS = 4;        // Max 4 tiers to prevent tipping
const MINI_MAX_WIDTH = 96;       // Max 96" (8 ft) total width

// ── Wheel Height ─────────────────────────────────────────────────────────
const WHEEL_HEIGHT = 2.75;       // Industrial caster height for calculations

// ── Proprietary constants (legacy, kept for reference) ───────────────────
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;

function getOpening(model: ToteModel, unitType: UnitType, orientation: Orientation = "standard"): number {
  if (unitType === "mini") {
    return MINI_CONFIG.slotWidth;
  }
  // Sideways orientation uses fixed 30.25" slot width
  if (orientation === "sideways") {
    return SIDEWAYS_CONFIG.slotWidth;
  }
  return model === "HDX" ? OPENING_HDX : OPENING_GM;
}

export async function calculateBuild(
  input: CalculateBuildInput
): Promise<BuildResult | BuildError> {
  const { toteModel, addOns, mode } = input;
  const unitType: UnitType = input.unitType ?? "standard";
  // Orientation only applies to standard units
  const orientation: Orientation = unitType === "standard" ? (input.orientation ?? "standard") : "standard";
  // Tote color only applies to HDX standard units with totes included
  const toteColor: ToteColor = (toteModel === "HDX" && unitType === "standard" && addOns.totes)
    ? (input.toteColor ?? "black")
    : "black";
  const config = getUnitConfig(unitType, orientation);
  const opening = getOpening(toteModel, unitType, orientation);

  let cols: number;
  let rows: number;

  if (mode === "wallFit") {
    const { wallWidth, wallHeight } = input;
    if (!wallWidth || !wallHeight || wallWidth <= 0 || wallHeight <= 0) {
      return { success: false, error: "Valid wall dimensions are required." };
    }
    // For Mini units, cap the effective wall width at MINI_MAX_WIDTH (96")
    const effectiveWallWidth = unitType === "mini"
      ? Math.min(wallWidth, MINI_MAX_WIDTH)
      : wallWidth;

    // If wheels are enabled, subtract wheel height from available wall height
    const effectiveWallHeight = addOns.wheels ? wallHeight - WHEEL_HEIGHT : wallHeight;

    // Wall fit calculation using config values
    cols = Math.floor((effectiveWallWidth - config.postWidth) / (opening + config.postWidth));
    const usableHeight = effectiveWallHeight - config.plateHeight - (config.hasTopPlate ? config.plateHeight : 0) - config.firstRailHeight;
    rows = Math.floor(usableHeight / config.verticalSpacing) + 1;
    if (cols < 1) cols = 1;
    if (rows < 1) rows = 1;

    // Apply Mini max tier constraint
    if (unitType === "mini" && rows > MINI_MAX_TIERS) {
      rows = MINI_MAX_TIERS;
    }
  } else {
    cols = input.cols ?? 1;
    rows = input.rows ?? 1;
    if (cols < 1) cols = 1;
    if (cols > 20) cols = 20;
    if (rows < 1) rows = 1;
    if (rows > 20) rows = 20;

    // Apply Mini max tier constraint for manual mode too
    if (unitType === "mini" && rows > MINI_MAX_TIERS) {
      rows = MINI_MAX_TIERS;
    }
  }

  // ── Dimensions ─────────────────────────────────────────────────────────
  const totalW = cols * opening + (cols + 1) * config.postWidth;

  // Height calculation differs for Standard vs Mini
  let frameH: number;
  if (unitType === "mini") {
    // Mini: bottom plate + first rail height + (rows-1) * spacing + top plywood
    // No top 2x4 plates, just plywood top
    const lastRailHeight = config.firstRailHeight + (rows - 1) * config.verticalSpacing;
    frameH = config.plateHeight + lastRailHeight + 2 + 0.75; // +2" clearance above last rail + 3/4" plywood top
  } else {
    // Standard: bottom plate + top plate + rails + top gap
    frameH = rows * config.verticalSpacing + config.plateHeight * 2 + config.topGap;
  }

  // Total height includes wheel height if wheels are selected
  const totalH = addOns.wheels ? frameH + WHEEL_HEIGHT : frameH;

  // ── Pricing ────────────────────────────────────────────────────────────
  // Apply installer pricing overrides if provided (Pro feature)
  const ip = input.installerPricing;
  const effectiveSlotPrice = unitType === "mini"
    ? (ip?.mini_slot ?? config.pricePerSlot)
    : (ip?.standard_slot ?? config.pricePerSlot);
  const effectiveWheelsPrice = unitType === "mini"
    ? (ip?.mini_wheels ?? config.priceWheels)
    : (ip?.standard_wheels ?? config.priceWheels);
  const effectiveTopPrice = ip?.plywood_top ?? config.pricePlywoodSheet;

  const slots = cols * rows;
  let price = slots * effectiveSlotPrice;
  if (addOns.totes) {
    let totePrice: number;
    if (toteModel === "HDX" && unitType === "standard" && toteColor === "clear") {
      totePrice = ip?.standard_tote_clear ?? STANDARD_TOTE_CLEAR_PRICE;
    } else if (unitType === "mini") {
      totePrice = ip?.mini_tote ?? config.pricePerTote;
    } else {
      totePrice = ip?.standard_tote ?? config.pricePerTote;
    }
    price += slots * totePrice;
  }
  if (addOns.wheels) price += effectiveWheelsPrice;

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
    price += topSheets * effectiveTopPrice;
  }

  // ── Section Addon Pricing (Organizer Customization) ──────────────────
  let addonPrice = 0;
  const sectionAddons = input.sectionAddons ?? [];
  if (sectionAddons.length > 0) {
    const ap = ip?.addon_pricing;
    const doorPrice = ap?.plywood_door ?? ADDON_PLATFORM_DEFAULTS.plywood_door;
    const sidePanelPrice = ap?.side_panel ?? ADDON_PLATFORM_DEFAULTS.side_panel;
    const railRemovalPrice = ap?.rail_removal ?? ADDON_PLATFORM_DEFAULTS.rail_removal;
    const shelfPrice = ap?.shelf ?? ADDON_PLATFORM_DEFAULTS.shelf;

    for (const addon of sectionAddons) {
      switch (addon.type) {
        case "plywood_door":
          // "doors_on" = all columns get a door (retail-facing: total price for on/off)
          if (addon.target === "doors_on") {
            addonPrice += doorPrice * cols;
          } else {
            addonPrice += doorPrice;
          }
          break;
        case "side_panel":
          addonPrice += sidePanelPrice;
          break;
        case "hinge_concealed":
          // Concealed hinges are included in door price for retail customers
          // Only charge separately if added individually
          addonPrice += ap?.concealed_hinge_pair ?? ADDON_PLATFORM_DEFAULTS.concealed_hinge_pair;
          break;
        case "rail_removed":
          addonPrice += railRemovalPrice;
          break;
        case "shelf":
          addonPrice += shelfPrice;
          break;
      }
    }
  }
  price += addonPrice;

  return {
    success: true,
    cols,
    rows,
    price,
    addonPrice,
    dimensions: { totalW, totalH, depth: config.depth },
    config: {
      toteModel,
      toteColor,
      unitType,
      orientation,
      hasTotes: addOns.totes,
      hasWheels: addOns.wheels,
      hasTop: effectiveHasTop,
      slots,
      topSheets,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Bestseller Presets — imported from shared lib (safe for client import)
// ═══════════════════════════════════════════════════════════════════════════
import { BESTSELLER_PRESETS } from "@/lib/presets";
export type { PresetSubUnit, BestsellerPreset } from "@/lib/presets";

import { SHELVING_CONFIGS } from "@/lib/shelving";
export type { ShelvingConfig, ShelvingWidth, ShelvingHeight } from "@/lib/shelving";

export interface CompoundBuildResult {
  success: true;
  presetId: string;
  presetName: string;
  totalPrice: number;
  subUnits: {
    cols: number;
    rows: number;
    price: number;
    totalW: number;
    totalH: number;
    depth: number;
    slots: number;
  }[];
  /** Combined width of all sub-units placed side-by-side */
  combinedW: number;
  /** Height of the tallest sub-unit */
  maxH: number;
  depth: number;
  totalSlots: number;
}

export interface CompoundBuildError {
  success: false;
  error: string;
}

/**
 * Calculate pricing and dimensions for a compound bestseller preset.
 * Runs calculateBuild for each sub-unit and aggregates.
 */
export async function calculateCompoundBuild(input: {
  presetId: string;
  hasTotes: boolean;
  installerPricing?: InstallerPricing;
}): Promise<CompoundBuildResult | CompoundBuildError> {
  const preset = BESTSELLER_PRESETS.find((p) => p.id === input.presetId);
  if (!preset) {
    return { success: false, error: "Unknown preset." };
  }

  // Still calculate each sub-unit for dimensions/slots (pricing may be overridden)
  const subUnits: CompoundBuildResult["subUnits"] = [];
  let combinedW = 0;
  let maxH = 0;
  let depth = 0;
  let totalSlots = 0;

  for (const unit of preset.units) {
    const result = await calculateBuild({
      cols: unit.cols,
      rows: unit.rows,
      toteModel: preset.toteModel,
      toteColor: preset.toteColor,
      unitType: preset.unitType,
      orientation: preset.orientation,
      addOns: {
        totes: input.hasTotes,
        wheels: unit.hasWheels,
        top: unit.hasTop,
      },
      mode: "manual",
      installerPricing: input.installerPricing,
    });

    if (!result.success) {
      return { success: false, error: "Calculation failed for sub-unit." };
    }

    subUnits.push({
      cols: result.cols,
      rows: result.rows,
      price: result.price,
      totalW: result.dimensions.totalW,
      totalH: result.dimensions.totalH,
      depth: result.dimensions.depth,
      slots: result.config.slots,
    });

    combinedW += result.dimensions.totalW;
    maxH = Math.max(maxH, result.dimensions.totalH);
    depth = Math.max(depth, result.dimensions.depth);
    totalSlots += result.config.slots;
  }

  // ── Pricing ──────────────────────────────────────────────────────────
  // Always dynamically calculated from the installer's rates (or platform
  // defaults when no custom pricing is set).  Fixed marketing prices on the
  // preset definition (basePrice / withTotesPrice) are no longer used for
  // customer-facing pricing — every installer gets their own price.
  //
  // Priority:
  //   1. Per-bestseller total-price override (installer set a flat price for
  //      this specific preset, WITH totes included).  If customer toggles
  //      totes off, we subtract the tote cost at the installer's tote rate.
  //   2. Dynamic sum of sub-unit prices (slot × rate + plywood + wheels +
  //      totes if selected).
  //
  // Totes are always priced using the installer's tote rate (or platform
  // default) so the customer sees a consistent per-tote cost.

  const ip = input.installerPricing;
  const bestsellerKey = `bestseller_${preset.id.replace(/-/g, "_")}` as keyof InstallerPricing;
  const installerOverride = ip?.[bestsellerKey] as number | undefined;
  // Fallback: platform default bestseller price (e.g., $950 for Indiana Joe)
  const platformDefault = PLATFORM_BESTSELLER_DEFAULTS[bestsellerKey];
  // Installer override takes priority, then platform default, then dynamic calc
  const bestsellerOverride = (installerOverride !== undefined && installerOverride !== null)
    ? installerOverride
    : platformDefault;

  // Calculate what the tote add-on costs (used by both paths)
  const effectiveTotePrice =
    preset.toteColor === "clear" && preset.toteModel === "HDX" && preset.unitType === "standard"
      ? (ip?.standard_tote_clear ?? STANDARD_TOTE_CLEAR_PRICE)
      : preset.unitType === "mini"
        ? (ip?.mini_tote ?? MINI_CONFIG.pricePerTote)
        : (ip?.standard_tote ?? STANDARD_CONFIG.pricePerTote);

  let totalPrice: number;

  if (bestsellerOverride !== undefined && bestsellerOverride !== null) {
    // Path 1: Bestseller total price (totes included) — installer override
    // or platform default.  When customer toggles totes OFF → subtract tote
    // cost at the installer's rate.
    totalPrice = bestsellerOverride;
    if (!input.hasTotes) {
      totalPrice -= totalSlots * effectiveTotePrice;
    }
  } else {
    // Path 2: No bestseller override and no platform default — dynamically
    // calculate from sub-units.  Sub-unit prices include totes when hasTotes
    // is true.
    totalPrice = subUnits.reduce((sum, su) => sum + su.price, 0);
  }

  return {
    success: true,
    presetId: preset.id,
    presetName: preset.name,
    totalPrice,
    subUnits,
    combinedW,
    maxH,
    depth,
    totalSlots,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Open Shelving Unit Calculator
// ═══════════════════════════════════════════════════════════════════════════

export interface ShelvingBuildResult {
  success: true;
  configId: string;
  label: string;
  price: number;
  widthIn: number;
  frameH: number;
  depth: number;
  shelves: number;
}

export interface ShelvingBuildError {
  success: false;
  error: string;
}

/**
 * Calculate pricing for an open shelving unit.
 * Uses installer override if set, otherwise falls back to the platform default.
 */
export async function calculateShelvingUnit(input: {
  configId: string;
  installerPricing?: InstallerPricing;
}): Promise<ShelvingBuildResult | ShelvingBuildError> {
  const config = SHELVING_CONFIGS.find((c) => c.id === input.configId);
  if (!config) {
    return { success: false, error: "Unknown shelving configuration." };
  }

  // Pricing key: shelving_<id_with_underscores> e.g. "shelving_shelf_4ft_short"
  const pricingKey = `shelving_${config.id.replace(/-/g, "_")}` as keyof InstallerPricing;
  const installerOverride = input.installerPricing?.[pricingKey] as number | undefined;
  const pricingKeyForDefault = `shelving_${config.id.replace(/-/g, "_")}`;
  const platformDefault = PLATFORM_SHELVING_DEFAULTS[pricingKeyForDefault] ?? 0;
  const price = (installerOverride !== undefined && installerOverride !== null)
    ? installerOverride
    : platformDefault;

  return {
    success: true,
    configId: config.id,
    label: config.label,
    price,
    widthIn: config.widthIn,
    frameH: config.frameH,
    depth: config.depth,
    shelves: config.shelves,
  };
}
