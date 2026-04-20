// ═══════════════════════════════════════════════════════════════════════════
// Open Shelving Unit Configurations — Structural Only (Client-Safe)
//
// Standalone shelving units (no totes) that complement the tote organizer.
// Same 30" depth, heights match tote-organizer tiers so units sit flush.
//
// Pricing is server-side only:
//   - Platform defaults: src/app/actions/platform-defaults.ts
//   - Installer overrides: pricing_config in profiles table
//   - calculateShelvingUnit(): src/app/actions/calculator.ts
// ═══════════════════════════════════════════════════════════════════════════

export type ShelvingWidth = 48 | 60 | 72;       // 4', 5', 6'
export type ShelvingHeight = "short" | "tall";   // 37.5" vs 85.5"

export interface ShelvingMaterials {
  /** Number of 2×4 uprights (corner posts) */
  uprights: number;
  /** Length of each upright in inches */
  uprightLen: number;
  /** Number of 2×4 rails (horizontal frame members: top/bottom plates + shelf support rails) */
  rails: number;
  /** Length of each rail in inches (= frame width) */
  railLen: number;
  /** Number of 2×4 depth braces (front-to-back, at top/bottom of each post pair) */
  depthBraces: number;
  /** Length of each depth brace in inches (= unit depth) */
  depthBraceLen: number;
  /** Plywood surface count (shelves + top) */
  plywoodSurfaces: number;
  /** Square feet of plywood per surface (width × depth / 144) */
  plywoodSqFtPerSurface: number;
  /** 3″ structural screws — frame assembly (2 per joint, 4 joints per upright) */
  screws3: number;
  /** 1⅝″ screws — plywood shelf/top attachment */
  screws16: number;
}

export interface ShelvingConfig {
  id: string;
  /** Display label, e.g. "4' × Short" */
  label: string;
  widthFt: number;         // 4, 5, or 6
  widthIn: ShelvingWidth;  // 48, 60, 72
  height: ShelvingHeight;
  /** Total frame height in inches */
  frameH: number;
  /** Unit depth in inches (same as standard tote organizer) */
  depth: number;
  /** Number of plywood shelves (excludes top) */
  shelves: number;
  /** Pre-calculated material requirements */
  materials: ShelvingMaterials;
}

// Heights derived from standard tote organizer calculator:
//   frameH = rows × 16 (verticalSpacing) + 1.5 × 2 (plates) + 2.5 (topGap)
//   Short → 37.5"   |   Tall → 85.5"
const SHORT_HEIGHT = 37.5;
const TALL_HEIGHT = 85.5;
const DEPTH = 30;

/** Calculate material requirements for a shelving config */
function calcMaterials(widthIn: number, frameH: number, depth: number, shelves: number): ShelvingMaterials {
  // 4 corner uprights
  const uprights = 4;
  const uprightLen = frameH;

  // Horizontal levels: bottom + each shelf + top
  const levels = shelves + 2;

  // Rails run along width: front + back per level
  const rails = levels * 2;
  const railLen = widthIn;

  // Depth braces run front-to-back: left + right per level
  const depthBraces = levels * 2;
  const depthBraceLen = depth;

  // Plywood: each shelf + top
  const plywoodSurfaces = shelves + 1;
  const plywoodSqFtPerSurface = (widthIn * depth) / 144;

  // 3″ structural screws: 2 per rail-to-upright joint.
  // Each rail meets 2 uprights = 2 joints × 2 screws = 4 screws per rail.
  // Each depth brace meets 2 uprights = same.
  const screws3 = (rails + depthBraces) * 4;

  // 1⅝″ screws: 8 per plywood surface (perimeter fastening)
  const screws16 = plywoodSurfaces * 8;

  return {
    uprights, uprightLen,
    rails, railLen,
    depthBraces, depthBraceLen,
    plywoodSurfaces, plywoodSqFtPerSurface,
    screws3, screws16,
  };
}

export const SHELVING_CONFIGS: ShelvingConfig[] = [
  // ── Short — 1 shelf + plywood top ───────────────────────────────────
  {
    id: "shelf-4ft-short",
    label: "4' × Short",
    widthFt: 4,
    widthIn: 48,
    height: "short",
    frameH: SHORT_HEIGHT,
    depth: DEPTH,
    shelves: 1,
    materials: calcMaterials(48, SHORT_HEIGHT, DEPTH, 1),
  },
  {
    id: "shelf-5ft-short",
    label: "5' × Short",
    widthFt: 5,
    widthIn: 60,
    height: "short",
    frameH: SHORT_HEIGHT,
    depth: DEPTH,
    shelves: 1,
    materials: calcMaterials(60, SHORT_HEIGHT, DEPTH, 1),
  },
  {
    id: "shelf-6ft-short",
    label: "6' × Short",
    widthFt: 6,
    widthIn: 72,
    height: "short",
    frameH: SHORT_HEIGHT,
    depth: DEPTH,
    shelves: 1,
    materials: calcMaterials(72, SHORT_HEIGHT, DEPTH, 1),
  },
  // ── Tall — 1 shelf + plywood top (base + middle + top = 3 surfaces) ─
  {
    id: "shelf-4ft-tall",
    label: "4' × Tall",
    widthFt: 4,
    widthIn: 48,
    height: "tall",
    frameH: TALL_HEIGHT,
    depth: DEPTH,
    shelves: 1,
    materials: calcMaterials(48, TALL_HEIGHT, DEPTH, 1),
  },
  {
    id: "shelf-5ft-tall",
    label: "5' × Tall",
    widthFt: 5,
    widthIn: 60,
    height: "tall",
    frameH: TALL_HEIGHT,
    depth: DEPTH,
    shelves: 1,
    materials: calcMaterials(60, TALL_HEIGHT, DEPTH, 1),
  },
  {
    id: "shelf-6ft-tall",
    label: "6' × Tall",
    widthFt: 6,
    widthIn: 72,
    height: "tall",
    frameH: TALL_HEIGHT,
    depth: DEPTH,
    shelves: 1,
    materials: calcMaterials(72, TALL_HEIGHT, DEPTH, 1),
  },
];

/** Look up a shelving config by its ID */
export function getShelvingConfig(id: string): ShelvingConfig | undefined {
  return SHELVING_CONFIGS.find((c) => c.id === id);
}
