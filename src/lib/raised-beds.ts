// ═══════════════════════════════════════════════════════════════════════════
// Raised Bed Planter Configurations — Client-Safe
//
// Handmade cedar raised bed planters in two categories:
//   - With legs (elevated, 16.5" or 30" total height)
//   - Without legs (ground-level, 11.5" or 22.5" height)
//
// Each bed has optional finishes (stain, liner, painted white),
// optional depth increase, and optional pest protection covers.
//
// Pricing is server-side only:
//   - Platform defaults defined here as RAISED_BED_DEFAULTS
//   - Installer overrides via pricing_config in profiles table
//   - calculateRaisedBed(): src/app/actions/calculator.ts
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────

export type RaisedBedStyle = "with_legs" | "without_legs";

export type RaisedBedFinish = "natural" | "stain" | "liner" | "painted_white";

export type PestCoverType = "none" | "hoop" | "rigid_cage" | "cabinet_24" | "cabinet_48";

export interface RaisedBedSize {
  id: string;
  label: string;
  style: RaisedBedStyle;
  /** Outer dimensions in inches: width × length × total height */
  widthIn: number;
  lengthIn: number;
  heightIn: number;
  /** Internal planting dimensions */
  internalW: number;
  internalL: number;
  internalH: number;
  /** Distance from ground to bottom of bed (legs only) */
  groundClearance: number;
  /** Base price (natural finish, standard depth) */
  basePrice: number;
  /** Finish add-on prices */
  stainPrice: number;
  linerPrice: number;
  paintedWhitePrice: number;
  /** Depth increase to 12" available? */
  depthIncreaseAvailable: boolean;
  depthIncreasePrice: number;
  /** Bottom shelf available? (tall legs only) */
  bottomShelfAvailable: boolean;
  bottomShelfPrice: number;
  /** Pest cover sizing category for pricing lookup */
  pestCoverCategory: "2x4" | "2x6" | "none";
  /** Most popular flag */
  popular?: boolean;
}

export interface PestCoverOption {
  id: PestCoverType;
  label: string;
  description: string;
  /** Price by bed size category */
  price_2x4: number;
  price_2x6: number;
  /** Additional cost to stain the cover */
  stainAddon_2x4: number;
  stainAddon_2x6: number;
}

// ── Raised Bed Sizes ─────────────────────────────────────────────────────

export const RAISED_BED_SIZES: RaisedBedSize[] = [
  // ── WITH LEGS ──────────────────────────────────────────────────────────
  {
    id: "legs_12x48x16",
    label: "12\" × 48\" × 16.5\" Raised Bed",
    style: "with_legs",
    widthIn: 12, lengthIn: 48, heightIn: 16.5,
    internalW: 12, internalL: 46, internalH: 9,
    groundClearance: 5,
    basePrice: 165,
    stainPrice: 30, linerPrice: 20, paintedWhitePrice: 80,
    depthIncreaseAvailable: true, depthIncreasePrice: 20,
    bottomShelfAvailable: false, bottomShelfPrice: 0,
    pestCoverCategory: "2x4",
  },
  {
    id: "legs_24x48x16",
    label: "24\" × 48\" × 16.5\" Raised Bed",
    style: "with_legs",
    widthIn: 24, lengthIn: 48, heightIn: 16.5,
    internalW: 23, internalL: 46, internalH: 9,
    groundClearance: 5,
    basePrice: 185,
    stainPrice: 35, linerPrice: 25, paintedWhitePrice: 90,
    depthIncreaseAvailable: true, depthIncreasePrice: 30,
    bottomShelfAvailable: false, bottomShelfPrice: 0,
    pestCoverCategory: "2x4",
  },
  {
    id: "legs_24x48x30",
    label: "24\" × 48\" × 30\" Tall Raised Bed",
    style: "with_legs",
    widthIn: 24, lengthIn: 48, heightIn: 30,
    internalW: 23, internalL: 46, internalH: 9,
    groundClearance: 18.5,
    basePrice: 195,
    stainPrice: 40, linerPrice: 30, paintedWhitePrice: 95,
    depthIncreaseAvailable: true, depthIncreasePrice: 30,
    bottomShelfAvailable: true, bottomShelfPrice: 50,
    pestCoverCategory: "2x4",
  },
  {
    id: "legs_24x72x16",
    label: "24\" × 72\" × 16.5\" Raised Bed",
    style: "with_legs",
    widthIn: 24, lengthIn: 72, heightIn: 16.5,
    internalW: 23, internalL: 69, internalH: 9,
    groundClearance: 5,
    basePrice: 205,
    stainPrice: 40, linerPrice: 35, paintedWhitePrice: 105,
    depthIncreaseAvailable: true, depthIncreasePrice: 40,
    bottomShelfAvailable: false, bottomShelfPrice: 0,
    pestCoverCategory: "2x6",
  },

  // ── WITHOUT LEGS (ground-level) ────────────────────────────────────────
  {
    id: "ground_24x72x11",
    label: "24\" × 72\" × 11.5\" Ground Bed",
    style: "without_legs",
    widthIn: 24, lengthIn: 72, heightIn: 11.5,
    internalW: 23, internalL: 68, internalH: 11,
    groundClearance: 0,
    basePrice: 185,
    stainPrice: 35, linerPrice: 30, paintedWhitePrice: 105,
    depthIncreaseAvailable: false, depthIncreasePrice: 0,
    bottomShelfAvailable: false, bottomShelfPrice: 0,
    pestCoverCategory: "2x6",
  },
  {
    id: "ground_24x72x22",
    label: "24\" × 72\" × 22.5\" Ground Bed",
    style: "without_legs",
    widthIn: 24, lengthIn: 72, heightIn: 22.5,
    internalW: 23, internalL: 68, internalH: 22,
    groundClearance: 0,
    basePrice: 235,
    stainPrice: 45, linerPrice: 35, paintedWhitePrice: 135,
    depthIncreaseAvailable: false, depthIncreasePrice: 0,
    bottomShelfAvailable: false, bottomShelfPrice: 0,
    pestCoverCategory: "2x6",
    popular: true,
  },
  {
    id: "ground_36x72x22",
    label: "36\" × 72\" × 22.5\" Ground Bed",
    style: "without_legs",
    widthIn: 36, lengthIn: 72, heightIn: 22.5,
    internalW: 35, internalL: 68, internalH: 22,
    groundClearance: 0,
    basePrice: 255,
    stainPrice: 50, linerPrice: 40, paintedWhitePrice: 150,
    depthIncreaseAvailable: false, depthIncreasePrice: 0,
    bottomShelfAvailable: false, bottomShelfPrice: 0,
    pestCoverCategory: "2x6",
  },
  {
    id: "ground_48x48x22",
    label: "48\" × 48\" × 22.5\" Ground Bed",
    style: "without_legs",
    widthIn: 48, lengthIn: 48, heightIn: 22.5,
    internalW: 46, internalL: 46, internalH: 22,
    groundClearance: 0,
    basePrice: 275,
    stainPrice: 50, linerPrice: 40, paintedWhitePrice: 135,
    depthIncreaseAvailable: false, depthIncreasePrice: 0,
    bottomShelfAvailable: false, bottomShelfPrice: 0,
    pestCoverCategory: "2x4",
  },
];

// ── Pest Protection Covers ───────────────────────────────────────────────

export const PEST_COVER_OPTIONS: PestCoverOption[] = [
  {
    id: "none",
    label: "No Cover",
    description: "Open-top planter, no pest protection",
    price_2x4: 0, price_2x6: 0,
    stainAddon_2x4: 0, stainAddon_2x6: 0,
  },
  {
    id: "hoop",
    label: "Hoop Netting",
    description: "Flexible hoop-style netting on hinges — lifts open for easy access",
    price_2x4: 150, price_2x6: 175,
    stainAddon_2x4: 10, stainAddon_2x6: 15,
  },
  {
    id: "rigid_cage",
    label: "Rigid Cage",
    description: "Solid wood & wire cage on hinges — lifts open, sturdy pest protection",
    price_2x4: 195, price_2x6: 215,
    stainAddon_2x4: 25, stainAddon_2x6: 35,
  },
  {
    id: "cabinet_24",
    label: "24\" Cabinet Cage",
    description: "24\" tall cage with cabinet-style doors — swing open for full access",
    price_2x4: 275, price_2x6: 295,
    stainAddon_2x4: 25, stainAddon_2x6: 35,
  },
  {
    id: "cabinet_48",
    label: "48\" Tall Cabinet Cage",
    description: "48\" tall cage with cabinet doors — full-height protection for climbing plants",
    price_2x4: 375, price_2x6: 395,
    stainAddon_2x4: 25, stainAddon_2x6: 35,
  },
];

// ── Helper: Get pest cover price for a given bed + cover combo ───────────

export function getPestCoverPrice(
  bed: RaisedBedSize,
  coverId: PestCoverType,
  withStain: boolean
): number {
  if (coverId === "none" || bed.pestCoverCategory === "none") return 0;
  const cover = PEST_COVER_OPTIONS.find((c) => c.id === coverId);
  if (!cover) return 0;

  const isLarge = bed.pestCoverCategory === "2x6";
  const base = isLarge ? cover.price_2x6 : cover.price_2x4;
  const stain = withStain ? (isLarge ? cover.stainAddon_2x6 : cover.stainAddon_2x4) : 0;
  return base + stain;
}

// ── Helper: Calculate total price for a raised bed configuration ─────────

export interface RaisedBedConfig {
  sizeId: string;
  finish: RaisedBedFinish;
  hasLiner: boolean;
  depthIncrease: boolean;
  bottomShelf: boolean;
  pestCover: PestCoverType;
}

export function calculateRaisedBedPrice(config: RaisedBedConfig): {
  total: number;
  breakdown: { label: string; amount: number }[];
} {
  const bed = RAISED_BED_SIZES.find((s) => s.id === config.sizeId);
  if (!bed) return { total: 0, breakdown: [] };

  const breakdown: { label: string; amount: number }[] = [];

  // Base price
  breakdown.push({ label: bed.label, amount: bed.basePrice });

  // Finish
  if (config.finish === "stain") {
    breakdown.push({ label: "Cedar Stain", amount: bed.stainPrice });
  } else if (config.finish === "painted_white") {
    breakdown.push({ label: "Painted White", amount: bed.paintedWhitePrice });
  }

  // Liner (separate add-on, compatible with any finish)
  if (config.hasLiner) {
    breakdown.push({ label: "Landscape Liner", amount: bed.linerPrice });
  }

  // Depth increase
  if (config.depthIncrease && bed.depthIncreaseAvailable) {
    breakdown.push({ label: "Increase Depth to 12\"", amount: bed.depthIncreasePrice });
  }

  // Bottom shelf
  if (config.bottomShelf && bed.bottomShelfAvailable) {
    breakdown.push({ label: "Bottom Shelf", amount: bed.bottomShelfPrice });
  }

  // Pest cover
  if (config.pestCover !== "none") {
    const coverStained = config.finish === "stain";
    const coverPrice = getPestCoverPrice(bed, config.pestCover, coverStained);
    const coverOption = PEST_COVER_OPTIONS.find((c) => c.id === config.pestCover);
    if (coverPrice > 0 && coverOption) {
      breakdown.push({ label: coverOption.label, amount: coverPrice });
    }
  }

  const total = breakdown.reduce((sum, b) => sum + b.amount, 0);
  return { total, breakdown };
}

// ── Helper: Get description string for quote ─────────────────────────────

export function getRaisedBedDescription(config: RaisedBedConfig): string {
  const bed = RAISED_BED_SIZES.find((s) => s.id === config.sizeId);
  if (!bed) return "Raised Bed Planter";

  const parts: string[] = [
    `${bed.widthIn}"×${bed.lengthIn}"×${bed.heightIn}" Raised Bed`,
  ];

  if (bed.style === "with_legs") parts.push("(with legs)");
  else parts.push("(ground-level)");

  if (config.finish === "stain") parts.push("+ Stain");
  else if (config.finish === "painted_white") parts.push("+ Painted White");

  if (config.hasLiner) parts.push("+ Liner");
  if (config.depthIncrease) parts.push("+ 12\" Depth");
  if (config.bottomShelf) parts.push("+ Bottom Shelf");

  if (config.pestCover !== "none") {
    const cover = PEST_COVER_OPTIONS.find((c) => c.id === config.pestCover);
    if (cover) parts.push(`+ ${cover.label}`);
  }

  return parts.join(" ");
}

// ── Get overall dimensions for display/3D ────────────────────────────────

export function getRaisedBedDimensions(config: RaisedBedConfig): {
  widthIn: number;
  lengthIn: number;
  heightIn: number;
  totalHeight: number; // includes pest cover if applicable
} {
  const bed = RAISED_BED_SIZES.find((s) => s.id === config.sizeId);
  if (!bed) return { widthIn: 24, lengthIn: 48, heightIn: 16.5, totalHeight: 16.5 };

  let totalHeight = bed.heightIn;
  if (config.pestCover === "cabinet_48") totalHeight += 48;
  else if (config.pestCover === "cabinet_24") totalHeight += 24;
  else if (config.pestCover === "rigid_cage") totalHeight += 18;
  else if (config.pestCover === "hoop") totalHeight += 14;

  return {
    widthIn: bed.widthIn,
    lengthIn: bed.lengthIn,
    heightIn: bed.heightIn,
    totalHeight,
  };
}
