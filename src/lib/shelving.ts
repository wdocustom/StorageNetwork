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
}

// Heights derived from standard tote organizer calculator:
//   frameH = rows × 16 (verticalSpacing) + 1.5 × 2 (plates) + 2.5 (topGap)
//   Short → 37.5"   |   Tall → 85.5"
const SHORT_HEIGHT = 37.5;
const TALL_HEIGHT = 85.5;
const DEPTH = 30;

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
  },
];

/** Look up a shelving config by its ID */
export function getShelvingConfig(id: string): ShelvingConfig | undefined {
  return SHELVING_CONFIGS.find((c) => c.id === id);
}
