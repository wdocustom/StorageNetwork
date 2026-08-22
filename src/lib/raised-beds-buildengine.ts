// ═══════════════════════════════════════════════════════════════════════════
// Raised Bed Planter — Build Engine
//
// Given a raised bed size (from RAISED_BED_SIZES), produces a complete build
// plan: cut list, fastener counts, and a fence-picket estimate. Mirrors the
// role buildEngine.ts plays for tote racks.
//
// Construction reference: docs/raised-beds-build.md
// All dimensions are inches. Fence pickets are 5/8" × 5-1/2" × 6' nominal.
// ═══════════════════════════════════════════════════════════════════════════

import { RAISED_BED_SIZES, type RaisedBedSize } from "./raised-beds";

// ── Stock constants ────────────────────────────────────────────────────

export const PICKET_THICKNESS = 0.625;     // 5/8"
export const PICKET_WIDTH = 5.5;           // 5-1/2"
export const PICKET_LENGTH = 72;           // 6'

// ── Geometry constants (derived from the user's hand-build rules) ──────

export const LEG_LONG_WIDTH = 2 + 15 / 16; // 2-15/16"
export const LEG_SHORT_WIDTH = 2.5;        // 2-1/2"
export const RIM_WIDTH = 2.75;             // 2-3/4" (picket ripped in half)

/** A/C side pickets are this much shorter than the box's WIDTH. */
export const AC_LENGTH_REDUCTION = 1.25;   // 1-1/4"
/** B/D side pickets are this much shorter than the box's LENGTH. */
export const BD_LENGTH_REDUCTION = 2.5;    // 2-1/2"

// ── Fastener constants ─────────────────────────────────────────────────

export const BRADS_PER_LEG = 5;                 // 1-1/4", down the L-seam
export const BRADS_PER_PICKET_PER_LEG = 6;      // 1", per leg end (×2 legs)
export const LEGS_PER_BOX = 4;
export const RIM_CORNER_CLUSTER = 4;            // 1-1/4" brads per corner
export const RIM_FIELD_SPACING_IN = 4;          // mid of the 3-5" range

// ── Types ──────────────────────────────────────────────────────────────

export interface CutPart {
  name: string;
  /** Length along the grain (longest dimension). */
  lengthIn: number;
  /** Width across the grain. */
  widthIn: number;
  /** Stock thickness — always 5/8" here. */
  thicknessIn: number;
  qty: number;
  notes?: string;
}

export interface FastenerCount {
  size: '1"' | '1-1/4"';
  qty: number;
  where: string;
}

export interface RaisedBedBuildPlan {
  sizeId: string;
  label: string;
  style: RaisedBedSize["style"];
  dimensions: {
    widthIn: number;
    lengthIn: number;
    heightIn: number;
    groundClearance: number;
  };
  /** Whole pickets stacked on each side wall (height ÷ 5-1/2", rounded). */
  picketsPerSide: number;
  /** Side-wall picket lengths. */
  sideLengths: { ac: number; bd: number };
  cuts: CutPart[];
  fasteners: FastenerCount[];
  /** Rough count of 5/8" × 5-1/2" × 6' pickets needed (yield-based). */
  fencePicketsEstimate: number;
  /** Open spec questions for this size — non-empty means the plan is partial. */
  unspecified: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Crosscuts per picket for pieces of `cutLen` long. Kerf is ignored
 *  (5/8" stock on a chop saw — negligible vs. 72" board). */
function piecesPerPicket(cutLen: number): number {
  if (cutLen <= 0) return 0;
  return Math.floor(PICKET_LENGTH / cutLen);
}

function picketsForPieces(qty: number, cutLen: number): number {
  const per = piecesPerPicket(cutLen);
  return per === 0 ? 0 : Math.ceil(qty / per);
}

// ── Main engine ────────────────────────────────────────────────────────

/**
 * Build a complete cut/material/fastener plan for one raised bed size.
 *
 * Fully specified for: ground-level boxes (`style: "without_legs"`) with
 * heights that are multiples of 5-1/2". Other cases return a partial plan
 * with the gaps flagged in `unspecified` — elevated leg construction and
 * fractional top-course rips have not been specified yet.
 */
export function buildRaisedBedPlan(size: RaisedBedSize): RaisedBedBuildPlan {
  const { widthIn, lengthIn, heightIn, groundClearance, style } = size;
  const unspecified: string[] = [];

  // ── Wall pickets ─────────────────────────────────────────────────────
  const picketsPerSide = Math.max(1, Math.round(heightIn / PICKET_WIDTH));
  const wallHeight = picketsPerSide * PICKET_WIDTH;
  if (Math.abs(wallHeight - heightIn) > 0.0625) {
    unspecified.push(
      `Wall height ${wallHeight}" (${picketsPerSide} pickets) does not match heightIn ${heightIn}" — top-course rip not yet specified.`,
    );
  }

  const acLen = widthIn - AC_LENGTH_REDUCTION;
  const bdLen = lengthIn - BD_LENGTH_REDUCTION;
  const sidePicketsPerPair = picketsPerSide * 2; // both A and C, both B and D

  // ── Leg length ───────────────────────────────────────────────────────
  // Ground-level: legs = wall height (flush top and bottom).
  // Elevated (with_legs): legs extend below; exact length not yet spec'd.
  let legLength = wallHeight;
  if (style === "with_legs") {
    legLength = wallHeight + groundClearance; // working assumption — TBD
    unspecified.push(
      `Elevated leg construction not yet specified — assuming legs = wall (${wallHeight}") + groundClearance (${groundClearance}") = ${legLength}".`,
    );
  }

  // ── Rim ──────────────────────────────────────────────────────────────
  const rimLong = Math.max(widthIn, lengthIn);
  const rimShort = Math.min(widthIn, lengthIn) - 2 * RIM_WIDTH;

  const cuts: CutPart[] = [
    {
      name: "Leg long face",
      lengthIn: legLength,
      widthIn: LEG_LONG_WIDTH,
      thicknessIn: PICKET_THICKNESS,
      qty: LEGS_PER_BOX,
      notes: "Rip from full picket (2-15/16\" strip)",
    },
    {
      name: "Leg short face",
      lengthIn: legLength,
      widthIn: LEG_SHORT_WIDTH,
      thicknessIn: PICKET_THICKNESS,
      qty: LEGS_PER_BOX,
      notes: "Offcut from the leg-long-face rip (~2-1/2\")",
    },
    {
      name: "Side picket A/C",
      lengthIn: acLen,
      widthIn: PICKET_WIDTH,
      thicknessIn: PICKET_THICKNESS,
      qty: sidePicketsPerPair,
      notes: "Full-width picket, crosscut",
    },
    {
      name: "Side picket B/D",
      lengthIn: bdLen,
      widthIn: PICKET_WIDTH,
      thicknessIn: PICKET_THICKNESS,
      qty: sidePicketsPerPair,
      notes: "Full-width picket, crosscut",
    },
    {
      name: "Long rim",
      lengthIn: rimLong,
      widthIn: RIM_WIDTH,
      thicknessIn: PICKET_THICKNESS,
      qty: 2,
      notes: "Picket ripped in half (butt-joint corners)",
    },
    {
      name: "Short rim",
      lengthIn: rimShort,
      widthIn: RIM_WIDTH,
      thicknessIn: PICKET_THICKNESS,
      qty: 2,
      notes: "Picket ripped in half (fits between long rim pieces)",
    },
  ];

  // ── Fasteners ────────────────────────────────────────────────────────
  const totalSidePickets = sidePicketsPerPair * 2; // A/C pair + B/D pair
  const sidePicketBrads = totalSidePickets * BRADS_PER_PICKET_PER_LEG * 2; // 2 legs per picket

  // Rim brad estimate:
  //   Corners: 4 corners × RIM_CORNER_CLUSTER nails.
  //   Field: ~1 nail per RIM_FIELD_SPACING_IN of straight run, with ~3"
  //          reserved each side of every corner for the cluster.
  const rimPerimeter = 2 * rimLong + 2 * rimShort;
  const fieldRunLength = Math.max(0, rimPerimeter - 4 * 6); // reserve 3" × 2 per corner
  const rimFieldNails = Math.ceil(fieldRunLength / RIM_FIELD_SPACING_IN);
  const rimCornerNails = 4 * RIM_CORNER_CLUSTER;

  const fasteners: FastenerCount[] = [
    {
      size: '1-1/4"',
      qty: LEGS_PER_BOX * BRADS_PER_LEG,
      where: "Corner legs (L-assembly)",
    },
    {
      size: '1"',
      qty: sidePicketBrads,
      where: "Side pickets into legs (both ends)",
    },
    {
      size: '1-1/4"',
      qty: rimCornerNails + rimFieldNails,
      where: `Rim: ${rimCornerNails} corner-cluster + ~${rimFieldNails} field (~${RIM_FIELD_SPACING_IN}" OC)`,
    },
  ];

  // ── Fence-picket estimate (raw material) ─────────────────────────────
  // Legs: one rip yields both faces from the same picket, so picket count
  //   is driven by leg-piece count per picket against legLength.
  const legPiecesPerPicket = piecesPerPicket(legLength);
  const legPickets = legPiecesPerPicket === 0 ? 0 : Math.ceil(LEGS_PER_BOX / legPiecesPerPicket);

  const acPickets = picketsForPieces(sidePicketsPerPair, acLen);
  const bdPickets = picketsForPieces(sidePicketsPerPair, bdLen);

  // Rim: one picket rips into 2 strips of 2-3/4" wide × 72". If all 4 rim
  // pieces fit on one strip (2 × rimLong + 2 × rimShort ≤ 72"), the rim
  // costs half a picket — rounded up to 1. Otherwise: 1 strip for the
  // longs, 1 strip for the shorts → still 1 full picket.
  const rimPickets = 1;

  const fencePicketsEstimate = legPickets + acPickets + bdPickets + rimPickets;

  return {
    sizeId: size.id,
    label: size.label,
    style,
    dimensions: { widthIn, lengthIn, heightIn, groundClearance },
    picketsPerSide,
    sideLengths: { ac: acLen, bd: bdLen },
    cuts,
    fasteners,
    fencePicketsEstimate,
    unspecified,
  };
}

/** Build plans for every catalog size. Useful for offline review. */
export function buildAllRaisedBedPlans(): RaisedBedBuildPlan[] {
  return RAISED_BED_SIZES.map(buildRaisedBedPlan);
}

/** Lookup by sizeId. Returns null if unknown. */
export function buildRaisedBedPlanById(sizeId: string): RaisedBedBuildPlan | null {
  const size = RAISED_BED_SIZES.find((s) => s.id === sizeId);
  return size ? buildRaisedBedPlan(size) : null;
}
