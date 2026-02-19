// ═══════════════════════════════════════════════════════════════════════════
// Assembly Guide — Step Data Structure v2
//
// Drives the interactive step-by-step 3D assembly sequencer.
// Each step defines which part groups are visible, what's ghosted,
// where screws appear, tools needed, and the UI card content.
//
// Steps are conditionally included based on build configuration
// (hasWheels, hasTop).
// ═══════════════════════════════════════════════════════════════════════════

import { toFraction } from "@/lib/utils";

export type PartGroup =
  | "posts"
  | "rails"
  | "bottomPlates"
  | "topPlates"
  | "casters"
  | "plyTop"
  | "screws"
  | "plateScrews"
  | "casterScrews"
  | "backSupports";

/** Visibility state for each part group during a step */
export type PartVisibility = "visible" | "ghosted" | "hidden";

export interface MaterialItem {
  name: string;
  qty: string; // dynamic — filled at runtime based on cols/rows
  detail: string;
}

export interface ToolItem {
  name: string;
  detail?: string;
}

export interface AssemblyStep {
  id: string;
  title: string;
  instruction: string;
  /** Which part groups are visible/ghosted/hidden */
  partStates: Record<PartGroup, PartVisibility>;
  /** Screw type shown during this step */
  screwType?: {
    label: string;
    length: number; // inches
    description: string;
  };
  /** Material items shown in the step card (static templates — qty computed at runtime) */
  materials: MaterialItem[];
  /** Tools required for this step */
  tools: ToolItem[];
  /** Camera focus hint */
  cameraHint?: "front" | "side" | "bottom" | "overview" | "top-down" | "close-side" | "laid-front" | "laid-bottom";
  /** Whether this step is conditional on configuration */
  condition?: "hasWheels" | "hasTop";
  /** Sub-instruction for pro tips */
  proTip?: string;
}

/** Configuration for the assembly guide */
export interface BuildConfig {
  hasWheels: boolean;
  hasTop: boolean;
  toteType?: "HDX" | "GM";
}

// Default hidden state for all groups
const ALL_HIDDEN: Record<PartGroup, PartVisibility> = {
  posts: "hidden",
  rails: "hidden",
  bottomPlates: "hidden",
  topPlates: "hidden",
  casters: "hidden",
  plyTop: "hidden",
  screws: "hidden",
  plateScrews: "hidden",
  casterScrews: "hidden",
  backSupports: "hidden",
};

// ═══════════════════════════════════════════════════════════════════════════
// All Possible Steps (filtered at runtime by configuration)
// ═══════════════════════════════════════════════════════════════════════════

const ALL_STEPS: AssemblyStep[] = [
  // ── STEP 1: Cut uprights ────────────────────────────────────────────────
  {
    id: "cut-uprights",
    title: "Cut the Uprights",
    instruction:
      'Cut all 2×4×8\' studs to upright height. Use a speed square to mark a clean line around the board, then make your cut. Stack finished pieces to verify equal length.',
    partStates: {
      ...ALL_HIDDEN,
      posts: "visible",
    },
    tools: [
      { name: "Miter Saw", detail: "or Circular Saw" },
      { name: "Speed Square" },
      { name: "Tape Measure" },
      { name: "Pencil" },
    ],
    materials: [
      { name: "2×4 × 8' Studs", qty: "BOARDS_QTY", detail: "Cut to UPRIGHT_HEIGHT" },
    ],
    proTip: "Cut one upright first and use it as a template to mark the rest. This ensures all uprights are identical.",
    cameraHint: "overview",
  },

  // ── STEP 2: Cut plates ──────────────────────────────────────────────────
  {
    id: "cut-plates",
    title: "Cut the Plates",
    instruction:
      'Cut 4 plates (2 top, 2 bottom) from 2×4 stock to the full unit width (PLATE_LENGTH). These tie the ladder frames together across the front and back.',
    partStates: {
      ...ALL_HIDDEN,
      bottomPlates: "visible",
      topPlates: "visible",
    },
    tools: [
      { name: "Miter Saw", detail: "or Circular Saw" },
      { name: "Tape Measure" },
    ],
    materials: [
      { name: "2×4 Bottom Plates", qty: "2", detail: "Cut to PLATE_LENGTH" },
      { name: "2×4 Top Plates", qty: "2", detail: "Cut to PLATE_LENGTH" },
    ],
    proTip: "If your unit is wider than 8', you'll need to join plates end-to-end over a post location.",
    cameraHint: "front",
  },

  // ── STEP 3: Rip plywood rails ───────────────────────────────────────────
  {
    id: "rip-rails",
    title: "Rip the Plywood Rails",
    instruction:
      'From a 4\'×8\' sheet of 3/4" plywood, rip a 30" wide offcut along the 96" side (set fence to 30"). Then crosscut that 30"×96" offcut into (3) 30"×30" squares. Finally, rip each square into 1-7/8" wide strips on the table saw — each square yields (16) strips at 1-7/8"×30". These strips support the totes between the uprights.',
    partStates: {
      ...ALL_HIDDEN,
      rails: "visible",
    },
    tools: [
      { name: "Table Saw", detail: 'fence at 30" then 1-7/8"' },
      { name: "Miter Saw", detail: 'crosscut to 30" squares' },
      { name: "Safety Glasses" },
      { name: "Push Stick" },
    ],
    materials: [
      { name: '3/4" Plywood Strips', qty: "RAILS_QTY", detail: 'Rip to 1-7/8" × RAIL_LENGTH' },
    ],
    proTip: 'Rip the 30" offcut first, then crosscut into squares, then rip strips. This sequence minimizes waste and keeps cuts manageable on the table saw.',
    cameraHint: "close-side",
  },

  // ── STEP 4: Mark rail positions ─────────────────────────────────────────
  {
    id: "mark-posts",
    title: "Mark Rail Positions",
    instruction:
      'On each upright, mark the TOP of the first rail at 13" from the bottom. Then mark every 16" up for the top of each subsequent rail. Use a combination square to carry the line across the face. The 16" measurement is to the top of the rail, not center-to-center.',
    partStates: {
      ...ALL_HIDDEN,
      posts: "visible",
      rails: "ghosted",
    },
    tools: [
      { name: "Tape Measure" },
      { name: "Combination Square" },
      { name: "Pencil" },
    ],
    materials: [
      { name: "Cut Uprights", qty: "POSTS_QTY", detail: "Mark rail top positions on face" },
    ],
    proTip: "Clamp two uprights together and mark both at once to guarantee matching rail heights.",
    cameraHint: "side",
  },

  // ── STEP 5: Build ladder frames ─────────────────────────────────────────
  {
    id: "build-ladders",
    title: "Build the Ladder Frames",
    instruction:
      'Pair up front and back uprights. Attach plywood rail strips flush to the inside face of each post using #9 × 1-5/8" star drive screws. Drive 2 screws per rail end — one near the top edge and one near the bottom edge of the strip. No pilot holes needed — plywood won\'t split. Each completed pair of posts with rails forms a "ladder frame."',
    partStates: {
      ...ALL_HIDDEN,
      posts: "visible",
      rails: "visible",
      screws: "visible",
    },
    screwType: {
      label: '#9 × 1-5/8" Star Drive',
      length: 1.625,
      description: "Construction screw — through plywood rail into post face. No pilot hole required.",
    },
    tools: [
      { name: "Drill/Driver" },
      { name: 'T-25 Star Bit', detail: "for #9 screws" },
      { name: "Clamps", detail: "to hold rail flush while driving" },
    ],
    materials: [
      { name: "Plywood Rails", qty: "RAILS_QTY", detail: 'Attach with 2 screws per end' },
      { name: '#9 × 1-5/8" Screws', qty: "RAIL_SCREWS_QTY", detail: "2 per rail end" },
    ],
    proTip: "Work on a flat surface to keep the ladder square. Clamp rails flush before driving screws.",
    cameraHint: "side",
  },

  // ── STEP 6: Attach bottom plates ────────────────────────────────────────
  {
    id: "attach-bottom-plates",
    title: "Attach Bottom Plates",
    instruction:
      'Lay the completed ladder frames on their sides so the rail faces point up. Space them at OPENING_SPAN apart (inside face to inside face — do not measure on center). Position the 2 bottom plates across the bottom ends of all uprights (front and back). Drive #9 × 3" screws down through the bottom plate into the end grain of each upright — 2 screws per connection. The unit stays laid on its front for this step.',
    partStates: {
      ...ALL_HIDDEN,
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      screws: "visible",
      plateScrews: "visible",
    },
    screwType: {
      label: '#9 × 3" Star Drive',
      length: 3.0,
      description: "Construction screw — through plate into upright end grain. No pilot hole required.",
    },
    tools: [
      { name: "Drill/Driver" },
      { name: 'T-25 Star Bit', detail: "for #9 screws" },
      { name: "Tape Measure", detail: "verify OPENING_SPAN between posts" },
    ],
    materials: [
      { name: "2×4 Bottom Plates", qty: "2", detail: "Front and back" },
      { name: '#9 × 3" Screws', qty: "BOTTOM_PLATE_SCREWS_QTY", detail: "2 per post-plate joint" },
    ],
    proTip: "Lay the ladder frames on their sides with the rail faces pointing up. This makes it easy to align and connect them with the bottom plates. No helper needed.",
    cameraHint: "laid-front",
  },

  // ── STEP 7: Attach top plates ───────────────────────────────────────────
  {
    id: "attach-top-plates",
    title: "Attach Top Plates",
    instruction:
      'With the ladder frames still on their sides, position the 2 top plates across the top ends of all uprights (front and back). Verify the same OPENING_SPAN spacing between posts as the bottom. Drive #9 × 3" screws down through the top plate into the top end grain of each upright — 2 screws per connection. The unit stays laid on its front until the wheels are attached.',
    partStates: {
      ...ALL_HIDDEN,
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      topPlates: "visible",
      screws: "visible",
      plateScrews: "visible",
    },
    screwType: {
      label: '#9 × 3" Star Drive',
      length: 3.0,
      description: "Construction screw — through plate into upright top end grain. No pilot hole required.",
    },
    tools: [
      { name: "Drill/Driver" },
      { name: 'T-25 Star Bit' },
      { name: "Tape Measure", detail: "check diagonals for square" },
    ],
    materials: [
      { name: "2×4 Top Plates", qty: "2", detail: "Front and back" },
      { name: '#9 × 3" Screws', qty: "TOP_PLATE_SCREWS_QTY", detail: "2 per post-plate joint" },
    ],
    proTip: "Measure corner-to-corner diagonals. If they match within 1/8\", you're square. If not, rack the frame by pushing the long-diagonal corner before driving the last screws.",
    cameraHint: "laid-front",
  },

  // ── STEP 8: Back supports + casters (conditional: hasWheels) ────────────
  {
    id: "attach-casters",
    title: "Back Supports & Casters",
    instruction:
      'With the unit still laying on its front, install plywood back supports diagonally at the top and bottom corners of the back face. These prevent racking and keep the unit square. Measure corner-to-corner diagonals — they should match within 1/8". Once square, screw the diagonal braces in place. While the unit is still on its front, attach a heavy-duty swivel caster at each corner of the bottom plate. Drive 4 lag screws per caster through the mounting plate into the 2×4 bottom plate. No pilot holes required for the entire build.',
    partStates: {
      ...ALL_HIDDEN,
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      topPlates: "visible",
      casters: "visible",
      backSupports: "visible",
    },
    screwType: {
      label: '1/4" × 1-1/2" Lag Screw',
      length: 1.5,
      description: "Lag screw — through caster mounting plate into bottom 2×4 plate. No pilot hole required.",
    },
    tools: [
      { name: "Drill/Driver" },
      { name: '7/16" Socket', detail: "or wrench for lag heads" },
      { name: "Tape Measure", detail: "corner-to-corner diagonals" },
    ],
    materials: [
      { name: "Plywood Back Supports", qty: "BACK_SUPPORTS_QTY", detail: "Diagonal braces at top & bottom corners" },
      { name: '5" Swivel Casters', qty: "4", detail: "Heavy-duty, industrial" },
      { name: '1/4" × 1-1/2" Lag Screws', qty: "16", detail: "4 per caster plate" },
    ],
    proTip: "Measure corner-to-corner diagonals before fastening the back supports. If they match within 1/8\", you're square. The diagonal braces lock the frame and prevent racking.",
    cameraHint: "laid-bottom",
    condition: "hasWheels",
  },

  // ── STEP 9: Plywood top (conditional: hasTop) ───────────────────────────
  {
    id: "attach-top",
    title: "Attach Plywood Top",
    instruction:
      'Cut a 3/4" plywood sheet to the unit footprint (PLATE_LENGTH × 30"). Set it flush on the top plates and secure with #9 × 1-5/8" screws — one at each post location driven down through the plywood into the top plate. That\'s TOP_SCREWS_QTY screws total.',
    partStates: {
      ...ALL_HIDDEN,
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      topPlates: "visible",
      casters: "visible",
      plyTop: "visible",
    },
    screwType: {
      label: '#9 × 1-5/8" Star Drive',
      length: 1.625,
      description: "Through plywood top into 2×4 top plate at each post location.",
    },
    tools: [
      { name: "Circular Saw", detail: "or Table Saw for rip" },
      { name: "Drill/Driver" },
      { name: 'T-25 Star Bit' },
    ],
    materials: [
      { name: '3/4" Plywood Sheet', qty: "TOP_SHEETS_QTY", detail: 'Cut to PLATE_LENGTH × 30"' },
      { name: '#9 × 1-5/8" Screws', qty: "TOP_SCREWS_QTY", detail: "1 per post location × 2 plates" },
    ],
    proTip: "Sand the edges and corners of the plywood top to prevent splinters, especially if this is a work surface.",
    cameraHint: "laid-front",
    condition: "hasTop",
  },

  // ── STEP 10: Final – Stand Up & Load ────────────────────────────────────
  {
    id: "final",
    title: "Stand Up & Verify",
    instruction:
      'Flip the unit upright (get a helper for large units). Roll it into position and verify it sits level. Test that totes slide in and out of each bay smoothly. Rock the unit gently to confirm structural rigidity.',
    partStates: {
      ...ALL_HIDDEN,
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      topPlates: "visible",
      casters: "visible",
      plyTop: "visible",
    },
    tools: [
      { name: "Level", detail: "check side-to-side" },
    ],
    materials: [
      { name: "27-Gallon Totes", qty: "TOTES_QTY", detail: "Test-fit in each bay" },
    ],
    proTip: "If a tote drags on a rail, check that the rail strip is seated flat and the screws aren't proud. A quick pass with a sanding block fixes minor issues.",
    cameraHint: "overview",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Runtime: filter steps by build configuration
// ═══════════════════════════════════════════════════════════════════════════

export function getStepsForConfig(config: BuildConfig): AssemblyStep[] {
  return ALL_STEPS.filter((step) => {
    if (!step.condition) return true;
    if (step.condition === "hasWheels") return config.hasWheels;
    if (step.condition === "hasTop") return config.hasTop;
    return true;
  }).map((step) => {
    // For the final step, adjust caster/plyTop visibility based on config
    if (step.id === "final") {
      return {
        ...step,
        partStates: {
          ...step.partStates,
          casters: config.hasWheels ? "visible" as const : "hidden" as const,
          plyTop: config.hasTop ? "visible" as const : "hidden" as const,
        },
      };
    }
    // For steps before casters are attached, keep them hidden
    if (!config.hasWheels && step.partStates.casters === "visible") {
      return {
        ...step,
        partStates: { ...step.partStates, casters: "hidden" as const },
      };
    }
    return step;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Runtime quantity calculator
// ═══════════════════════════════════════════════════════════════════════════

export function computeMaterials(
  step: AssemblyStep,
  cols: number,
  rows: number,
  config: BuildConfig
): MaterialItem[] {
  const opening = config.toteType === "GM" ? 20.75 : 19.75;
  const openingStr = config.toteType === "GM" ? '20-3/4"' : '19-3/4"';

  const numPosts = (cols + 1) * 2; // front + back
  const numRails = cols * rows * 2; // left + right per bay per tier
  const railScrews = numRails * 4; // 2 screws per rail end × 2 ends
  // 2 screws per connection × 2 plates (front+back) × (cols+1) posts
  const perPlateScrews = (cols + 1) * 2 * 2;
  const backSupports = cols <= 4 ? 4 : 6;
  const totes = cols * rows;
  const uprightH = rows * 16; // rows × TIER_SPACING
  const plateLen = cols * opening + (cols + 1) * 1.5;
  const plateLenStr = toFraction(plateLen) + '"';

  // Board count: bin-packing for accuracy
  const STOCK = 96;
  const KERF = 0.125;
  const parts: number[] = [];
  // Uprights
  for (let i = 0; i < numPosts; i++) parts.push(uprightH);
  // Plates (4 total: 2 top, 2 bottom)
  for (let k = 0; k < 4; k++) parts.push(plateLen);
  parts.sort((a, b) => b - a);
  const bins: number[] = [];
  for (const len of parts) {
    let placed = false;
    for (let b = 0; b < bins.length; b++) {
      if (bins[b] >= len + KERF) {
        bins[b] -= len + KERF;
        placed = true;
        break;
      }
    }
    if (!placed) bins.push(STOCK - len);
  }
  const totalBoards = bins.length;

  // Top sheet count
  const totalW = plateLen;
  const topSheets = totalW > 192 ? 3 : totalW > 96 ? 2 : 1;

  // Top screws: 1 per post location × 2 plates (front + back)
  const topScrews = (cols + 1) * 2;

  const qtyMap: Record<string, string> = {
    POSTS_QTY: String(numPosts),
    RAILS_QTY: String(numRails),
    RAIL_SCREWS_QTY: String(railScrews),
    PLATE_SCREWS_QTY: String(perPlateScrews),
    BOTTOM_PLATE_SCREWS_QTY: String(perPlateScrews),
    TOP_PLATE_SCREWS_QTY: String(perPlateScrews),
    TOTES_QTY: String(totes),
    BOARDS_QTY: String(totalBoards),
    UPRIGHT_HEIGHT: `${uprightH}"`,
    PLATE_LENGTH: plateLenStr,
    RAIL_LENGTH: '30"',
    UNIT_WIDTH: plateLenStr,
    TOP_SHEETS_QTY: String(topSheets),
    TOP_SCREWS_QTY: String(topScrews),
    BACK_SUPPORTS_QTY: String(backSupports),
    OPENING_SPAN: openingStr,
  };

  return step.materials.map((m) => ({
    ...m,
    qty: qtyMap[m.qty] ?? m.qty,
    detail: m.detail.replace(/UPRIGHT_HEIGHT/g, `${uprightH}"`)
                     .replace(/PLATE_LENGTH/g, plateLenStr)
                     .replace(/RAIL_LENGTH/g, '30"')
                     .replace(/UNIT_WIDTH/g, plateLenStr)
                     .replace(/OPENING_SPAN/g, openingStr)
                     .replace(/TOP_SCREWS_QTY/g, String(topScrews)),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Token resolver — replaces PLATE_LENGTH, OPENING_SPAN, etc. in any string
// ═══════════════════════════════════════════════════════════════════════════

export function resolveTokens(
  text: string,
  cols: number,
  rows: number,
  config: BuildConfig
): string {
  const opening = config.toteType === "GM" ? 20.75 : 19.75;
  const openingStr = config.toteType === "GM" ? '20-3/4"' : '19-3/4"';
  const plateLen = cols * opening + (cols + 1) * 1.5;
  const plateLenStr = toFraction(plateLen) + '"';
  const uprightH = rows * 16;
  const topScrews = (cols + 1) * 2;

  return text
    .replace(/PLATE_LENGTH/g, plateLenStr)
    .replace(/OPENING_SPAN/g, openingStr)
    .replace(/UPRIGHT_HEIGHT/g, `${uprightH}"`)
    .replace(/TOP_SCREWS_QTY/g, String(topScrews));
}

// Re-export for backward compat
export { ALL_STEPS as ASSEMBLY_STEPS };
