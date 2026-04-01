// ═══════════════════════════════════════════════════════════════════════════
// Raised Bed Planter Configurations — Client-Safe (NO PRICING)
//
// Structural data only: dimensions, styles, labels, options.
// ALL pricing is server-side in src/app/actions/platform-defaults.ts
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────

export type RaisedBedStyle = "with_legs" | "without_legs";

export type RaisedBedFinish = "natural" | "stain" | "painted_white";

export type PestCoverType = "none" | "hoop" | "rigid_cage" | "cabinet_24" | "cabinet_48";

export interface RaisedBedSize {
  id: string;
  label: string;
  style: RaisedBedStyle;
  widthIn: number;
  lengthIn: number;
  heightIn: number;
  internalW: number;
  internalL: number;
  internalH: number;
  groundClearance: number;
  depthIncreaseAvailable: boolean;
  bottomShelfAvailable: boolean;
  pestCoverCategory: "2x4" | "2x6" | "none";
  popular?: boolean;
}

export interface PestCoverOption {
  id: PestCoverType;
  label: string;
  description: string;
}

export interface RaisedBedConfig {
  sizeId: string;
  finish: RaisedBedFinish;
  hasLiner: boolean;
  depthIncrease: boolean;
  bottomShelf: boolean;
  pestCover: PestCoverType;
}

// ── Raised Bed Sizes (structural only — no prices) ───────────────────────

export const RAISED_BED_SIZES: RaisedBedSize[] = [
  // WITH LEGS
  {
    id: "legs_12x48x16", label: "12\" × 48\" × 16.5\" Raised Bed", style: "with_legs",
    widthIn: 12, lengthIn: 48, heightIn: 16.5, internalW: 12, internalL: 46, internalH: 9,
    groundClearance: 5, depthIncreaseAvailable: true, bottomShelfAvailable: false, pestCoverCategory: "2x4",
  },
  {
    id: "legs_24x48x16", label: "24\" × 48\" × 16.5\" Raised Bed", style: "with_legs",
    widthIn: 24, lengthIn: 48, heightIn: 16.5, internalW: 23, internalL: 46, internalH: 9,
    groundClearance: 5, depthIncreaseAvailable: true, bottomShelfAvailable: false, pestCoverCategory: "2x4",
  },
  {
    id: "legs_24x48x30", label: "24\" × 48\" × 30\" Tall Raised Bed", style: "with_legs",
    widthIn: 24, lengthIn: 48, heightIn: 30, internalW: 23, internalL: 46, internalH: 9,
    groundClearance: 18.5, depthIncreaseAvailable: true, bottomShelfAvailable: true, pestCoverCategory: "2x4",
  },
  {
    id: "legs_24x72x16", label: "24\" × 72\" × 16.5\" Raised Bed", style: "with_legs",
    widthIn: 24, lengthIn: 72, heightIn: 16.5, internalW: 23, internalL: 69, internalH: 9,
    groundClearance: 5, depthIncreaseAvailable: true, bottomShelfAvailable: false, pestCoverCategory: "2x6",
  },
  // WITHOUT LEGS
  {
    id: "ground_24x72x11", label: "24\" × 72\" × 11.5\" Ground Bed", style: "without_legs",
    widthIn: 24, lengthIn: 72, heightIn: 11.5, internalW: 23, internalL: 68, internalH: 11,
    groundClearance: 0, depthIncreaseAvailable: false, bottomShelfAvailable: false, pestCoverCategory: "2x6",
  },
  {
    id: "ground_24x72x22", label: "24\" × 72\" × 22.5\" Ground Bed", style: "without_legs",
    widthIn: 24, lengthIn: 72, heightIn: 22.5, internalW: 23, internalL: 68, internalH: 22,
    groundClearance: 0, depthIncreaseAvailable: false, bottomShelfAvailable: false, pestCoverCategory: "2x6", popular: true,
  },
  {
    id: "ground_36x72x22", label: "36\" × 72\" × 22.5\" Ground Bed", style: "without_legs",
    widthIn: 36, lengthIn: 72, heightIn: 22.5, internalW: 35, internalL: 68, internalH: 22,
    groundClearance: 0, depthIncreaseAvailable: false, bottomShelfAvailable: false, pestCoverCategory: "2x6",
  },
  {
    id: "ground_48x48x22", label: "48\" × 48\" × 22.5\" Ground Bed", style: "without_legs",
    widthIn: 48, lengthIn: 48, heightIn: 22.5, internalW: 46, internalL: 46, internalH: 22,
    groundClearance: 0, depthIncreaseAvailable: false, bottomShelfAvailable: false, pestCoverCategory: "2x4",
  },
];

// ── Pest Cover Options (labels only — pricing is server-side) ────────────

export const PEST_COVER_OPTIONS: PestCoverOption[] = [
  { id: "none", label: "No Cover", description: "Open-top planter, no pest protection" },
  { id: "hoop", label: "Hoop Netting", description: "Flexible hoop-style netting on hinges — lifts open for easy access" },
  { id: "rigid_cage", label: "Rigid Cage", description: "Solid wood & wire cage on hinges — lifts open, sturdy pest protection" },
  { id: "cabinet_24", label: "24\" Cabinet Cage", description: "24\" tall cage with cabinet-style doors — swing open for full access" },
  { id: "cabinet_48", label: "48\" Tall Cabinet Cage", description: "48\" tall cage with cabinet doors — full-height protection for climbing plants" },
];

// ── Description helper (no pricing needed) ───────────────────────────────

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

// ── Dimension helper (for 3D renderer — no pricing) ──────────────────────

export function getRaisedBedDimensions(config: RaisedBedConfig): {
  widthIn: number;
  lengthIn: number;
  heightIn: number;
  totalHeight: number;
} {
  const bed = RAISED_BED_SIZES.find((s) => s.id === config.sizeId);
  if (!bed) return { widthIn: 24, lengthIn: 48, heightIn: 16.5, totalHeight: 16.5 };

  let totalHeight = bed.heightIn;
  if (config.pestCover === "cabinet_48") totalHeight += 48;
  else if (config.pestCover === "cabinet_24") totalHeight += 24;
  else if (config.pestCover === "rigid_cage") totalHeight += 18;
  else if (config.pestCover === "hoop") totalHeight += 14;

  return { widthIn: bed.widthIn, lengthIn: bed.lengthIn, heightIn: bed.heightIn, totalHeight };
}
