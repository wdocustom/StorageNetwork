// ═══════════════════════════════════════════════════════════════════════════
// Raised Bed Planter — Build Specification (cut lists, fasteners)
//
// Structural construction data for fence-picket raised beds. See
// docs/raised-beds-build.md for the human-readable reference.
//
// All dimensions are inches. Fence pickets are 5/8" × 5-1/2" × 6' nominal.
// ═══════════════════════════════════════════════════════════════════════════

export const PICKET_THICKNESS = 0.625;     // 5/8"
export const PICKET_WIDTH = 5.5;           // 5-1/2"
export const PICKET_LENGTH = 72;           // 6'

export const LEG_LONG_WIDTH = 2 + 15 / 16; // 2-15/16"
export const LEG_SHORT_WIDTH = 2.5;        // 2-1/2"
export const RIM_WIDTH = 2.75;             // 2-3/4" (picket ripped in half)

/** A/C side pickets are this much shorter than overall width. */
export const AC_LENGTH_REDUCTION = 1.25;   // 1-1/4"
/** B/D side pickets are this much shorter than overall width. */
export const BD_LENGTH_REDUCTION = 2.5;    // 2-1/2"

export const BRADS_PER_LEG = 5;                  // 1-1/4" brads
export const BRADS_PER_PICKET_PER_LEG = 6;       // 1" brads, both ends
export const LEGS_PER_BOX = 4;

export interface CutPart {
  name: string;
  lengthIn: number;
  widthIn: number;
  thicknessIn: number;
  qty: number;
  notes?: string;
}

export interface FastenerCount {
  size: '1"' | '1-1/4"';
  qty: number;
  where: string;
}

export interface BuildSpec {
  widthIn: number;
  lengthIn: number;
  heightIn: number;
  /** Number of full-width pickets stacked vertically per side wall. */
  picketsPerSide: number;
  cuts: CutPart[];
  fasteners: FastenerCount[];
}

/**
 * Build the cut list + fastener counts for a rectangular ground-level box.
 *
 * Assumes:
 * - Height is a whole multiple of 5-1/2" (full pickets, no rips on side walls)
 * - Legs are flush top and bottom (= box height)
 * - Picture-frame rim, butt-jointed "chase-the-tail" (not mitered)
 */
export function buildSpecForBox(
  widthIn: number,
  lengthIn: number,
  heightIn: number
): BuildSpec {
  const picketsPerSide = Math.round(heightIn / PICKET_WIDTH);
  const sidePicketQty = picketsPerSide * 2; // two sides of each pair

  // A/C run along widthIn; B/D run along lengthIn.
  const acLength = widthIn - AC_LENGTH_REDUCTION;
  const bdLength = lengthIn - BD_LENGTH_REDUCTION;

  // Picture-frame rim: long pieces full-length, short pieces fit between.
  const rimLong = Math.max(widthIn, lengthIn);
  const rimShort = Math.min(widthIn, lengthIn) - 2 * RIM_WIDTH;

  const cuts: CutPart[] = [
    {
      name: "Leg long face",
      lengthIn: heightIn,
      widthIn: LEG_LONG_WIDTH,
      thicknessIn: PICKET_THICKNESS,
      qty: LEGS_PER_BOX,
      notes: "Rip from full picket",
    },
    {
      name: "Leg short face",
      lengthIn: heightIn,
      widthIn: LEG_SHORT_WIDTH,
      thicknessIn: PICKET_THICKNESS,
      qty: LEGS_PER_BOX,
      notes: "Offcut from the leg-long-face rip",
    },
    {
      name: "Side picket A/C",
      lengthIn: acLength,
      widthIn: PICKET_WIDTH,
      thicknessIn: PICKET_THICKNESS,
      qty: sidePicketQty,
      notes: "Full-width picket, crosscut",
    },
    {
      name: "Side picket B/D",
      lengthIn: bdLength,
      widthIn: PICKET_WIDTH,
      thicknessIn: PICKET_THICKNESS,
      qty: sidePicketQty,
      notes: "Full-width picket, crosscut",
    },
    {
      name: "Long rim",
      lengthIn: rimLong,
      widthIn: RIM_WIDTH,
      thicknessIn: PICKET_THICKNESS,
      qty: 2,
      notes: "Picket ripped in half",
    },
    {
      name: "Short rim",
      lengthIn: rimShort,
      widthIn: RIM_WIDTH,
      thicknessIn: PICKET_THICKNESS,
      qty: 2,
      notes: "Picket ripped in half",
    },
  ];

  const totalSidePickets = sidePicketQty * 2; // A/C + B/D
  const fasteners: FastenerCount[] = [
    {
      size: '1-1/4"',
      qty: LEGS_PER_BOX * BRADS_PER_LEG,
      where: "Corner legs (L-assembly)",
    },
    {
      size: '1"',
      qty: totalSidePickets * BRADS_PER_PICKET_PER_LEG * 2,
      where: "Side pickets into legs (both ends)",
    },
  ];

  return { widthIn, lengthIn, heightIn, picketsPerSide, cuts, fasteners };
}

/**
 * Reference example: 24" × 24" × 16-1/2" ground-level box.
 * Expected: 20 × 1-1/4" brads, 144 × 1" brads.
 */
export const EXAMPLE_24x24x16_5: BuildSpec = buildSpecForBox(24, 24, 16.5);
