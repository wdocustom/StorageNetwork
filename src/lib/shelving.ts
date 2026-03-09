// ═══════════════════════════════════════════════════════════════════════════
// Open Shelving Unit Configurations
//
// Standalone shelving units (no totes) that complement the tote organizer.
// Same 30" depth, heights match tote-organizer tiers so units sit flush.
//
// This file is NOT a server action so constants can be imported by client
// components directly.
// ═══════════════════════════════════════════════════════════════════════════

export type ShelvingWidth = 48 | 60 | 72;       // 4', 5', 6'
export type ShelvingHeight = "short" | "tall";   // 2-tote-high vs 5-tote-high

export interface ShelvingConfig {
  id: string;
  /** Display label, e.g. "4' × Short" */
  label: string;
  widthFt: number;         // 4, 5, or 6
  widthIn: ShelvingWidth;  // 48, 60, 72
  height: ShelvingHeight;
  /** Total frame height in inches (matches tote organizer tier height) */
  frameH: number;
  /** Unit depth in inches (same as standard tote organizer) */
  depth: number;
  /** Number of plywood shelves (excludes top) */
  shelves: number;
  /** Platform default price */
  platformPrice: number;
}

// Heights derived from standard tote organizer calculator:
//   frameH = rows × 16 (verticalSpacing) + 1.5 × 2 (plates) + 2.5 (topGap)
//   2-tote-high → 37.5"   |   5-tote-high → 85.5"
const SHORT_HEIGHT = 37.5;
const TALL_HEIGHT = 85.5;
const DEPTH = 30;

export const SHELVING_CONFIGS: ShelvingConfig[] = [
  // ── Short (2-tote-high) — 1 shelf + plywood top ─────────────────────
  {
    id: "shelf-4ft-short",
    label: "4' × Short",
    widthFt: 4,
    widthIn: 48,
    height: "short",
    frameH: SHORT_HEIGHT,
    depth: DEPTH,
    shelves: 1,
    platformPrice: 175,
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
    platformPrice: 200,
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
    platformPrice: 225,
  },
  // ── Tall (5-tote-high) — 3 shelves + plywood top ────────────────────
  {
    id: "shelf-4ft-tall",
    label: "4' × Tall",
    widthFt: 4,
    widthIn: 48,
    height: "tall",
    frameH: TALL_HEIGHT,
    depth: DEPTH,
    shelves: 3,
    platformPrice: 325,
  },
  {
    id: "shelf-5ft-tall",
    label: "5' × Tall",
    widthFt: 5,
    widthIn: 60,
    height: "tall",
    frameH: TALL_HEIGHT,
    depth: DEPTH,
    shelves: 3,
    platformPrice: 375,
  },
  {
    id: "shelf-6ft-tall",
    label: "6' × Tall",
    widthFt: 6,
    widthIn: 72,
    height: "tall",
    frameH: TALL_HEIGHT,
    depth: DEPTH,
    shelves: 3,
    platformPrice: 425,
  },
];

/** Look up a shelving config by its ID */
export function getShelvingConfig(id: string): ShelvingConfig | undefined {
  return SHELVING_CONFIGS.find((c) => c.id === id);
}
