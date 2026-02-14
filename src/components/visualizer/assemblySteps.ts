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

export type PartGroup =
  | "posts"
  | "rails"
  | "bottomPlates"
  | "topPlates"
  | "casters"
  | "plyTop"
  | "screws"
  | "plateScrews"
  | "casterScrews";

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
  cameraHint?: "front" | "side" | "bottom" | "overview" | "top-down" | "close-side";
  /** Whether this step is conditional on configuration */
  condition?: "hasWheels" | "hasTop";
  /** Sub-instruction for pro tips */
  proTip?: string;
}

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
      posts: "visible",
      rails: "hidden",
      bottomPlates: "hidden",
      topPlates: "hidden",
      casters: "hidden",
      plyTop: "hidden",
      screws: "hidden",
      plateScrews: "hidden",
      casterScrews: "hidden",
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
      'Cut 4 plates (2 top, 2 bottom) from 2×4 stock to the full unit width. These tie the ladder frames together across the front and back.',
    partStates: {
      posts: "ghosted",
      rails: "hidden",
      bottomPlates: "visible",
      topPlates: "visible",
      casters: "hidden",
      plyTop: "hidden",
      screws: "hidden",
      plateScrews: "hidden",
      casterScrews: "hidden",
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
      'Rip 3/4" plywood into 1-7/8" wide strips at 30" long. Set your table saw fence to 1-7/8" and rip full-length strips, then crosscut to 30". These support the totes between the uprights.',
    partStates: {
      posts: "ghosted",
      rails: "visible",
      bottomPlates: "ghosted",
      topPlates: "ghosted",
      casters: "hidden",
      plyTop: "hidden",
      screws: "hidden",
      plateScrews: "hidden",
      casterScrews: "hidden",
    },
    tools: [
      { name: "Table Saw", detail: "with fence at 1-7/8\"" },
      { name: "Miter Saw", detail: "for crosscuts to 30\"" },
      { name: "Safety Glasses" },
      { name: "Push Stick" },
    ],
    materials: [
      { name: '3/4" Plywood Strips', qty: "RAILS_QTY", detail: 'Rip to 1-7/8" × RAIL_LENGTH' },
    ],
    proTip: "Use a zero-clearance insert on your table saw for cleaner rips on thin strips.",
    cameraHint: "close-side",
  },

  // ── STEP 4: Mark rail positions ─────────────────────────────────────────
  {
    id: "mark-posts",
    title: "Mark Rail Positions",
    instruction:
      'On each upright, mark the center of the first rail at 13" from the bottom. Then mark every 16" on center going up. Use a combination square to carry the line across the face.',
    partStates: {
      posts: "visible",
      rails: "ghosted",
      bottomPlates: "hidden",
      topPlates: "hidden",
      casters: "hidden",
      plyTop: "hidden",
      screws: "hidden",
      plateScrews: "hidden",
      casterScrews: "hidden",
    },
    tools: [
      { name: "Tape Measure" },
      { name: "Combination Square" },
      { name: "Pencil" },
    ],
    materials: [
      { name: "Cut Uprights", qty: "POSTS_QTY", detail: "Mark rail centers on face" },
    ],
    proTip: "Clamp two uprights together and mark both at once to guarantee matching rail heights.",
    cameraHint: "side",
  },

  // ── STEP 5: Build ladder frames ─────────────────────────────────────────
  {
    id: "build-ladders",
    title: "Build the Ladder Frames",
    instruction:
      'Pair up front and back uprights. Attach plywood rail strips flush to the inside face of each post using #9 × 1-5/8" star drive screws. Drive 2 screws per rail end — one near the front edge and one near the back edge of the post.',
    partStates: {
      posts: "visible",
      rails: "visible",
      bottomPlates: "hidden",
      topPlates: "hidden",
      casters: "hidden",
      plyTop: "hidden",
      screws: "visible",
      plateScrews: "hidden",
      casterScrews: "hidden",
    },
    screwType: {
      label: '#9 × 1-5/8" Star Drive',
      length: 1.625,
      description: "Construction screw — through rail into post face. Pre-drill with 3/32\" bit to prevent plywood splitting.",
    },
    tools: [
      { name: "Drill/Driver" },
      { name: 'T-25 Star Bit', detail: "for #9 screws" },
      { name: '3/32" Drill Bit', detail: "pilot holes" },
      { name: "Clamps", detail: "to hold rail flush while driving" },
    ],
    materials: [
      { name: "Plywood Rails", qty: "RAILS_QTY", detail: 'Attach with 2 screws per end' },
      { name: '#9 × 1-5/8" Screws', qty: "RAIL_SCREWS_QTY", detail: "2 per rail end" },
    ],
    proTip: "Pre-drill every screw hole to prevent the plywood from splitting. Work on a flat surface to keep the ladder square.",
    cameraHint: "side",
  },

  // ── STEP 6: Attach bottom plates ────────────────────────────────────────
  {
    id: "attach-bottom-plates",
    title: "Attach Bottom Plates",
    instruction:
      'Lay the 2 bottom plates flat on the floor, spaced 30" apart (front to back). Stand the completed ladder frames in position on top of the plates. Drive #9 × 3" screws down through each plate into the end grain of each upright — 2 screws per connection.',
    partStates: {
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      topPlates: "hidden",
      casters: "hidden",
      plyTop: "hidden",
      screws: "visible",
      plateScrews: "visible",
      casterScrews: "hidden",
    },
    screwType: {
      label: '#9 × 3" Star Drive',
      length: 3.0,
      description: "Construction screw — down through plate into upright end grain.",
    },
    tools: [
      { name: "Drill/Driver" },
      { name: 'T-25 Star Bit', detail: "for #9 screws" },
      { name: 'Speed Square', detail: "verify plumb" },
    ],
    materials: [
      { name: "2×4 Bottom Plates", qty: "2", detail: "Front and back" },
      { name: '#9 × 3" Screws', qty: "BOTTOM_PLATE_SCREWS_QTY", detail: "2 per post-plate joint" },
    ],
    proTip: "Have a helper hold the first ladder plumb while you drive the bottom plate screws. After 2 ladders are secured, the structure becomes self-supporting.",
    cameraHint: "front",
  },

  // ── STEP 7: Attach top plates ───────────────────────────────────────────
  {
    id: "attach-top-plates",
    title: "Attach Top Plates",
    instruction:
      'Place the 2 top plates across the top of all uprights, front and back. Drive #9 × 3" screws down through the plate into the top end grain of each upright — 2 screws per connection. Check for square by measuring diagonals.',
    partStates: {
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      topPlates: "visible",
      casters: "hidden",
      plyTop: "hidden",
      screws: "visible",
      plateScrews: "visible",
      casterScrews: "hidden",
    },
    screwType: {
      label: '#9 × 3" Star Drive',
      length: 3.0,
      description: "Construction screw — down through plate into upright top end grain.",
    },
    tools: [
      { name: "Drill/Driver" },
      { name: 'T-25 Star Bit' },
      { name: "Tape Measure", detail: "check diagonals for square" },
      { name: "Step Ladder", detail: "for reaching top" },
    ],
    materials: [
      { name: "2×4 Top Plates", qty: "2", detail: "Front and back" },
      { name: '#9 × 3" Screws', qty: "TOP_PLATE_SCREWS_QTY", detail: "2 per post-plate joint" },
    ],
    proTip: "Measure corner-to-corner diagonals. If they match within 1/8\", you're square. If not, rack the frame by pushing the long-diagonal corner before driving the last screws.",
    cameraHint: "overview",
  },

  // ── STEP 8: Flip & attach casters (conditional: hasWheels) ──────────────
  {
    id: "attach-casters",
    title: "Flip & Attach Casters",
    instruction:
      'Carefully flip the assembled frame upside down. Position a heavy-duty swivel caster at each corner, centered on the bottom plate over each end post. Drive 4 lag screws per caster through the mounting plate into the 2×4 bottom plate.',
    partStates: {
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      topPlates: "visible",
      casters: "visible",
      plyTop: "hidden",
      screws: "hidden",
      plateScrews: "hidden",
      casterScrews: "visible",
    },
    screwType: {
      label: '1/4" × 1-1/2" Lag Screw',
      length: 1.5,
      description: "Lag screw — through caster mounting plate into bottom 2×4 plate. Pre-drill with 3/16\" bit.",
    },
    tools: [
      { name: "Drill/Driver" },
      { name: '3/16" Drill Bit', detail: "pilot holes for lag screws" },
      { name: '7/16" Socket', detail: "or wrench for lag heads" },
    ],
    materials: [
      { name: "5\" Swivel Casters", qty: "4", detail: "Heavy-duty, industrial" },
      { name: '1/4" × 1-1/2" Lag Screws', qty: "16", detail: "4 per caster plate" },
    ],
    proTip: "Pre-drill every lag screw hole. Driving lags without pilot holes will split the 2×4. Use a ratchet or socket driver for final tightening.",
    cameraHint: "bottom",
    condition: "hasWheels",
  },

  // ── STEP 9: Plywood top (conditional: hasTop) ───────────────────────────
  {
    id: "attach-top",
    title: "Attach Plywood Top",
    instruction:
      'Cut a 3/4" plywood sheet to the unit footprint (full width × 30" depth, overhanging 1" per side). Set it centered on the top plates and secure with #9 × 1-5/8" screws driven down through the plywood into the top plates every 12".',
    partStates: {
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      topPlates: "visible",
      casters: "visible",
      plyTop: "visible",
      screws: "hidden",
      plateScrews: "hidden",
      casterScrews: "hidden",
    },
    screwType: {
      label: '#9 × 1-5/8" Star Drive',
      length: 1.625,
      description: "Through plywood top into 2×4 top plate.",
    },
    tools: [
      { name: "Circular Saw", detail: "or Table Saw for rip" },
      { name: "Drill/Driver" },
      { name: 'T-25 Star Bit' },
    ],
    materials: [
      { name: '3/4" Plywood Sheet', qty: "TOP_SHEETS_QTY", detail: "Cut to UNIT_WIDTH + 2\" × 32\"" },
      { name: '#9 × 1-5/8" Screws', qty: "TOP_SCREWS_QTY", detail: "Every 12\" along plates" },
    ],
    proTip: "Sand the edges and corners of the plywood top to prevent splinters, especially if this is a work surface.",
    cameraHint: "top-down",
    condition: "hasTop",
  },

  // ── STEP 10: Final – Stand Up & Load ────────────────────────────────────
  {
    id: "final",
    title: "Stand Up & Verify",
    instruction:
      'Flip the unit upright (get a helper for large units). Roll it into position and verify it sits level. Test that totes slide in and out of each bay smoothly. Rock the unit gently to confirm structural rigidity.',
    partStates: {
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      topPlates: "visible",
      casters: "visible",
      plyTop: "visible",
      screws: "hidden",
      plateScrews: "hidden",
      casterScrews: "hidden",
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

export interface BuildConfig {
  hasWheels: boolean;
  hasTop: boolean;
}

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
  const numPosts = (cols + 1) * 2; // front + back
  const numRails = cols * rows * 2; // left + right per bay per tier
  const railScrews = numRails * 4; // 2 screws per rail end × 2 ends
  const perPlateScrews = (cols + 1) * 2; // 2 per post, front + back
  const totes = cols * rows;
  const uprightH = rows * 16; // rows × TIER_SPACING
  const plateLen = cols * (cols > 0 ? 19.75 : 20.75) + (cols + 1) * 1.5; // approximate

  // Board count: rough estimate based on uprights + plates
  const uprightBoards = Math.ceil((numPosts * uprightH) / 96);
  const plateBoards = Math.ceil((4 * plateLen) / 96);

  // Top sheet count
  const totalW = plateLen;
  const topSheets = totalW > 192 ? 3 : totalW > 96 ? 2 : 1;

  // Top screws: 2 plates × width / 12" spacing × 2 screws
  const topScrews = Math.ceil(totalW / 12) * 2 * 2;

  const qtyMap: Record<string, string> = {
    POSTS_QTY: String(numPosts),
    RAILS_QTY: String(numRails),
    RAIL_SCREWS_QTY: String(railScrews),
    PLATE_SCREWS_QTY: String(perPlateScrews * 2),
    BOTTOM_PLATE_SCREWS_QTY: String(perPlateScrews),
    TOP_PLATE_SCREWS_QTY: String(perPlateScrews),
    TOTES_QTY: String(totes),
    BOARDS_QTY: String(uprightBoards + plateBoards),
    UPRIGHT_HEIGHT: `${uprightH}"`,
    PLATE_LENGTH: `${Math.round(plateLen)}"`,
    RAIL_LENGTH: '30"',
    UNIT_WIDTH: `${Math.round(plateLen)}"`,
    TOP_SHEETS_QTY: String(topSheets),
    TOP_SCREWS_QTY: String(topScrews),
  };

  return step.materials.map((m) => ({
    ...m,
    qty: qtyMap[m.qty] ?? m.qty,
    detail: m.detail.replace(/UPRIGHT_HEIGHT/g, `${uprightH}"`)
                     .replace(/PLATE_LENGTH/g, `${Math.round(plateLen)}"`)
                     .replace(/RAIL_LENGTH/g, '30"')
                     .replace(/UNIT_WIDTH/g, `${Math.round(plateLen)}"`),
  }));
}

// Re-export for backward compat
export { ALL_STEPS as ASSEMBLY_STEPS };
