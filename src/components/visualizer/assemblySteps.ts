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

/** How the totes are carried: 3/4" plywood strips or ripped 2×4 rails */
export type RailStyle = "plywood" | "2x4";

/** Configuration for the assembly guide */
export interface BuildConfig {
  hasWheels: boolean;
  hasTop: boolean;
  toteType?: "HDX" | "GM";
  /** Defaults to "plywood" (the installer standard); DIY plans use "2x4" */
  rails?: RailStyle;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2×4-rail construction — must mirror buildEngine.ts / Rack3D.tsx
// ═══════════════════════════════════════════════════════════════════════════

export const RAILS_2X4 = {
  /** Universal bay opening between uprights — fits HDX and Greenmade totes */
  opening: 21,
  /** Rail CENTER heights, measured up from the bottom end of the upright */
  positions: [13.75, 29.5, 45.25, 61, 76.75, 92.5],
  /** Upright extends this far above the top rail's center (rows 1-5) */
  topGap: 2.75,
  /** At 6 high the upright is a full, uncut 8' stud */
  stock: 96,
  maxRows: 6,
  /** Ripped rail: 1-1/2" wide (screwed face) × 1-3/4" tall (nominal) */
  railW: 1.5,
  railH: 1.75,
  /** Rip width for half a 2×4: (3-1/2" − 1/8" kerf) / 2 */
  ripWidth: 1.6875,
  /** Rails per 2×4×8': 2 strips × 3 rails at 30" */
  railsPerBoard: 6,
} as const;

/** Upright length for a 2×4-rail module of `rows` tiers (rows <= 6). */
export function upright2x4(rows: number): number {
  return rows >= RAILS_2X4.maxRows ? RAILS_2X4.stock : RAILS_2X4.positions[rows - 1] + RAILS_2X4.topGap;
}

/** Diagonal back braces per module — same count the installer calculator uses. */
export function backSupportsFor(cols: number): number {
  return cols <= 4 ? 4 : 6;
}

/** A back brace's centerline, in back-face inches: x from the first upright's
 *  center (uprights every 22-1/2"), y from the bottom plate's center. */
export interface BraceSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface BraceLayout2x4 {
  /** "corner": a knee brace at each corner. "diagonal": 1-high frames, plate to plate. */
  style: "corner" | "diagonal";
  /** Square-cut length, end to end — ends land on upright/plate centerlines */
  length: number;
  segments: BraceSegment[];
}

const floorQuarter = (n: number) => Math.floor(n * 4 + 1e-9) / 4;

/**
 * Back braces for a 2×4-rail module, sized so they never cross each other or
 * hang past the frame. Tall frames (3+) take uncut 30" pieces at every corner;
 * 2-high frames take shorter corner braces; 1-high frames take one diagonal
 * per end bay running from the bottom plate to the top plate.
 */
export function braceLayout2x4(cols: number, rows: number): BraceLayout2x4 {
  const pitch = RAILS_2X4.opening + 1.5;
  const w = cols * pitch; // first to last upright, center to center
  const d = upright2x4(Math.min(rows, RAILS_2X4.maxRows)) + 1.5; // plate center to plate center
  const mid = Math.floor(cols / 2) * pitch;
  const wide = cols > 4;
  const maxLen = 30; // one ripped rail piece

  if (rows <= 1) {
    const length = Math.min(maxLen, floorQuarter(d * Math.SQRT2));
    const l = length / Math.SQRT2;
    const segments: BraceSegment[] = [{ x1: 0, y1: 0, x2: l, y2: l }];
    if (cols > 1) segments.push({ x1: w, y1: 0, x2: w - l, y2: l });
    if (wide) segments.push({ x1: mid, y1: 0, x2: mid + l, y2: l });
    return { style: "diagonal", length, segments };
  }

  // Leave 3" between the top and bottom braces (and the left and right ones)
  const leg = Math.min(maxLen / Math.SQRT2, (d - 3) / 2, (w - 3) / 2);
  const length = Math.min(maxLen, floorQuarter(leg * Math.SQRT2));
  const l = length / Math.SQRT2;
  const segments: BraceSegment[] = [
    { x1: 0, y1: l, x2: l, y2: 0 },
    { x1: w, y1: l, x2: w - l, y2: 0 },
    { x1: 0, y1: d - l, x2: l, y2: d },
    { x1: w, y1: d - l, x2: w - l, y2: d },
  ];
  if (wide) segments.push({ x1: mid, y1: l, x2: mid + l, y2: 0 }, { x1: mid, y1: d - l, x2: mid - l, y2: d });
  return { style: "corner", length, segments };
}

/** Height of each rail's TOP edge above the bottom of the upright — what the builder marks. */
export function railTopMarks2x4(rows: number): number[] {
  return RAILS_2X4.positions.slice(0, Math.min(rows, RAILS_2X4.maxRows)).map((c) => c + RAILS_2X4.railH / 2);
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
      { name: "2×4 × 8' Studs", qty: "POSTS_QTY", detail: "Cut to UPRIGHT_HEIGHT" },
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

  // ── STEP 8: Install back supports (always) ─────────────────────────────
  {
    id: "install-back-supports",
    title: "Install Back Supports",
    instruction:
      'With the unit still laying on its front, install plywood back supports diagonally at the top and bottom corners of the back face (the face pointing up). These prevent racking and keep the unit square. Measure corner-to-corner diagonals — they should match within 1/8". Once square, fasten each brace with #9 × 1-5/8" screws — 2 screws per end, driven through the face of the support into the plate or post beneath.',
    partStates: {
      ...ALL_HIDDEN,
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      topPlates: "visible",
      backSupports: "visible",
    },
    screwType: {
      label: '#9 × 1-5/8" Star Drive',
      length: 1.625,
      description: "Through plywood back support into plate/post beneath. No pilot hole required.",
    },
    tools: [
      { name: "Drill/Driver" },
      { name: 'T-25 Star Bit', detail: "for #9 screws" },
      { name: "Tape Measure", detail: "corner-to-corner diagonals" },
    ],
    materials: [
      { name: "Plywood Back Supports", qty: "BACK_SUPPORTS_QTY", detail: "Diagonal braces at top & bottom corners" },
      { name: '#9 × 1-5/8" Screws', qty: "BACK_SUPPORT_SCREWS_QTY", detail: "2 per end of each brace" },
    ],
    proTip: "Measure corner-to-corner diagonals before fastening. If they match within 1/8\", you're square. The diagonal braces lock the frame and prevent racking.",
    cameraHint: "laid-bottom",
  },

  // ── STEP 9: Attach casters (conditional: hasWheels) ───────────────────
  {
    id: "attach-casters",
    title: "Attach Casters",
    instruction:
      'With the unit still on its front, attach a heavy-duty swivel caster at each corner of the bottom plate. Drive 4 lag screws per caster through the mounting plate into the 2×4 bottom plate. No pilot holes required.',
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
    ],
    materials: [
      { name: '5" Swivel Casters', qty: "4", detail: "Heavy-duty, industrial" },
      { name: '1/4" × 1-1/2" Lag Screws', qty: "16", detail: "4 per caster plate" },
    ],
    proTip: "Position each caster so the swivel pivot sits directly over a post for maximum strength.",
    cameraHint: "laid-bottom",
    condition: "hasWheels",
  },

  // ── STEP 10: Plywood top (conditional: hasTop) ──────────────────────────
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
      backSupports: "visible",
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

  // ── STEP 11: Final – Stand Up & Load ────────────────────────────────────
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
      backSupports: "visible",
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
// 2×4-rail versions of the rail steps (ids match so the 3D guide animates
// them the same way). Back braces are the same ripped 2×4 rail piece
// (calculate-materials.ts counts them that way), screwed on with 3" screws.
// ═══════════════════════════════════════════════════════════════════════════

const RAILS_2X4_STEPS: Partial<Record<string, Partial<AssemblyStep>>> = {
  "cut-uprights": {
    instruction: "UPRIGHT_CUT",
    materials: [{ name: "2×4 × 8' Studs", qty: "POSTS_QTY", detail: "UPRIGHT_DETAIL" }],
    proTip:
      "Pick the straightest studs in the pile for uprights — sight down each edge. Cut one, then use it as the template to mark the rest so every upright is identical.",
  },
  "rip-rails": {
    title: "Rip the 2×4 Rails",
    instruction:
      "Each tote hangs by its rim on two rails, one on each side. Make them from straight 2×4×8' boards: set the table saw fence to 1-11/16\" and rip each board down the middle into two strips. Then crosscut each strip into (3) rails at RAIL_LENGTH. Every 2×4 gives you 6 rails — you need RAILS_QTY rails plus BACK_SUPPORTS_QTY back braces (the same 30\" piece) from RAIL_BOARDS_QTY boards.",
    tools: [
      { name: "Table Saw", detail: 'fence at 1-11/16"' },
      { name: "Miter Saw", detail: "crosscut rails to RAIL_LENGTH" },
      { name: "Safety Glasses" },
      { name: "Push Stick" },
    ],
    materials: [
      { name: "2×4 × 8' Boards", qty: "RAIL_BOARDS_QTY", detail: "Rip in half, then 3 rails per half" },
      { name: "2×4 Rails", qty: "RAILS_QTY", detail: 'About 1-1/2" × 1-11/16" × RAIL_LENGTH' },
      { name: "2×4 Back Braces", qty: "BACK_SUPPORTS_QTY", detail: "Same ripped 30\" piece as a rail — set aside for the back" },
    ],
    proTip:
      "Knock the sharp top edges off each rail with a sanding block — tote rims glide in and out without catching.",
  },
  "mark-posts": {
    instruction:
      "Measuring up from the BOTTOM end of each upright, mark the top edge of every rail at RAIL_MARKS — a 15-3/4\" step between rails. Square each mark across the inside face with a combination square and put an X just below the line so you know which side the rail goes.",
    materials: [{ name: "Cut Uprights", qty: "POSTS_QTY", detail: "Mark rail top edges on the inside face" }],
    proTip:
      "Clamp all the uprights together side by side with their bottom ends flush and mark them in one pass — every rail lands at exactly the same height.",
  },
  "build-ladders": {
    instruction:
      "Pair a front and a back upright, inside faces up. Lay each rail with its top edge on its mark and its ends flush with the outside faces of both uprights (RAIL_LENGTH overall). Drive #9 × 3\" screws through the rail into each upright — 2 per end, 4 per rail. End uprights get rails on one face; middle uprights carry rails on both faces. Each finished pair is a \"ladder frame.\"",
    screwType: {
      label: '#9 × 3" Star Drive',
      length: 3.0,
      description: "Construction screw — through the 2×4 rail into the upright. No pilot hole required; keep screws 3/4\" in from the rail ends.",
    },
    tools: [
      { name: "Drill/Driver" },
      { name: "T-25 Star Bit", detail: "for #9 screws" },
      { name: "Clamps", detail: "hold each rail on its line while driving" },
      { name: "Speed Square", detail: "keep rails square to the uprights" },
    ],
    materials: [
      { name: "2×4 Rails", qty: "RAILS_QTY", detail: "4 screws each" },
      { name: '#9 × 3" Screws', qty: "RAIL_SCREWS_QTY", detail: "2 per rail end" },
    ],
    proTip:
      "On middle uprights, shift the second side's screws about 1/2\" up or down from the first side's so they don't meet inside the upright.",
  },
  "attach-casters": {
    instruction:
      'With the unit still on its front, center a 5" swivel caster under each end upright on the front and back bottom plates — 4 casters, one at each corner — so each swivel pivot sits right over an upright. Fasten every caster plate with 4 1/4" × 1" structural screws into the 2×4 bottom plate.',
    screwType: {
      label: '1/4" × 1" Structural Screw',
      length: 1.0,
      description: "Star-drive structural screw — through the caster plate into the 2×4 bottom plate. No pilot hole required.",
    },
    tools: [{ name: "Drill/Driver" }, { name: "Tape Measure" }],
    materials: [
      { name: '5" Swivel Casters', qty: "4", detail: "One at each corner" },
      { name: '1/4" × 1" Structural Screws', qty: "16", detail: "4 per caster plate" },
    ],
    proTip: "Lock all four casters before you stand the unit up, and keep them locked whenever you load it.",
  },
  "attach-top-plates": {
    proTip:
      "Measure corner-to-corner diagonals — when they match within 1/8\", you're square. If not, push the long-diagonal corner before driving the last screws. The back braces in the next step lock it there.",
  },
  "install-back-supports": {
    title: "Install Back Braces",
    instruction:
      'With the unit still laying on its front, square it up: measure both corner-to-corner diagonals of the back face (the face pointing up) and push the long corner until they match within 1/8". BACK_BRACE_LAYOUT Drive #9 × 3" screws through each brace into the upright or plate beneath — 2 per end.',
    screwType: {
      label: '#9 × 3" Star Drive',
      length: 3.0,
      description: "Through the 2×4 brace into the plate or upright beneath. No pilot hole required; keep screws 3/4\" in from the brace ends.",
    },
    tools: [
      { name: "Drill/Driver" },
      { name: "T-25 Star Bit", detail: "for #9 screws" },
      { name: "Tape Measure", detail: "corner-to-corner diagonals" },
      { name: "Speed Square", detail: "set each brace at 45°" },
    ],
    materials: [
      { name: "2×4 Back Braces", qty: "BACK_SUPPORTS_QTY", detail: "Ripped 2×4, BRACE_LENGTH" },
      { name: '#9 × 3" Screws', qty: "BACK_SUPPORT_SCREWS_QTY", detail: "2 per brace end" },
    ],
    proTip:
      "Square first, brace second — once the braces are screwed on, the frame holds whatever shape it's in. Braces on the back stay clear of the totes, which load from the front.",
  },
  final: {
    proTip:
      "If a tote drags, check that its two rails sit level on their marks and the screw heads are flush. A quick pass with a sanding block on the rail's top edge fixes minor catches.",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Runtime: filter steps by build configuration
// ═══════════════════════════════════════════════════════════════════════════

export function getStepsForConfig(config: BuildConfig): AssemblyStep[] {
  const is2x4 = config.rails === "2x4";
  return ALL_STEPS.filter((step) => {
    if (!step.condition) return true;
    if (step.condition === "hasWheels") return config.hasWheels;
    if (step.condition === "hasTop") return config.hasTop;
    return true;
  }).map((base) => {
    const step: AssemblyStep = is2x4
      ? { ...base, ...RAILS_2X4_STEPS[base.id] }
      : base;
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
// Token values — every quantity / dimension a step's text can reference
// ═══════════════════════════════════════════════════════════════════════════

const STOCK = 96;
const KERF = 0.125;

/** Boards needed for uprights + plates (first-fit decreasing, like the engine). */
function packBoards(parts: number[]): number {
  const bins: number[] = [];
  for (const len of [...parts].sort((a, b) => b - a)) {
    const i = bins.findIndex((rem) => rem >= len + KERF);
    if (i >= 0) bins[i] -= len + KERF;
    else bins.push(STOCK - len);
  }
  return bins.length;
}

function joinMarks(marks: number[]): string {
  const s = marks.map((m) => `${toFraction(m)}"`);
  return s.length <= 1 ? (s[0] ?? "") : `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
}

function tokenValues(cols: number, rows: number, config: BuildConfig): Record<string, string> {
  const is2x4 = config.rails === "2x4";
  const opening = is2x4 ? RAILS_2X4.opening : config.toteType === "GM" ? 20.75 : 19.75;
  const openingStr = `${toFraction(opening)}"`;
  const uprightH = is2x4 ? upright2x4(rows) : rows * 16; // rows × TIER_SPACING
  const plateLen = cols * opening + (cols + 1) * 1.5;
  const plateLenStr = toFraction(plateLen) + '"';

  const numPosts = (cols + 1) * 2; // front + back
  const numRails = cols * rows * 2; // left + right per bay per tier
  const railScrews = numRails * 4; // 2 screws per rail end × 2 ends
  // 2 screws per connection × 2 plates (front+back) × (cols+1) posts
  const perPlateScrews = (cols + 1) * 2 * 2;
  const braces = braceLayout2x4(cols, rows);
  const backSupports = is2x4 ? braces.segments.length : backSupportsFor(cols);
  const braceLen = braces.length >= 30 ? '30" (no cut)' : `cut to ${toFraction(braces.length)}"`;
  const braceCut = braces.length >= 30 ? "Use the 30\" ripped pieces as-is." : `Cut ${backSupports} of your 30" ripped pieces to ${toFraction(braces.length)}" (square ends).`;
  const braceLayout =
    braces.style === "diagonal"
      ? `${braceCut} ${
          cols > 1
            ? "In each end bay, lay one flat at 45° from the bottom plate at the corner up to the top plate"
            : "Lay one flat at 45° from the bottom plate at one corner up to the top plate"
        } — ends centered on the plates.${cols > 4 ? " This module is wider than 4 bays, so add one more the same way from the middle upright." : ""}`
      : `${braceCut} Lay one flat at 45° across each of the four corners — one end centered on the plate, the other centered on the end upright.${
          cols > 4 ? " This module is wider than 4 bays, so add 2 more at the middle upright — one up from the bottom plate, one down from the top plate." : ""
        }`;
  const topSheets = plateLen > 192 ? 3 : plateLen > 96 ? 2 : 1;
  // Top screws: 1 per post location × 2 plates (front + back)
  const topScrews = (cols + 1) * 2;

  const uprightCut = is2x4
    ? uprightH >= STOCK
      ? "Use full-length 2×4×8' studs (96\") as uprights — no cut needed. Check that the factory ends are square; trim a hair off any that aren't and keep every upright the same length."
      : `Cut all 2×4×8' studs to ${toFraction(uprightH)}". Use a speed square to mark a clean line around the board, then make your cut. Stack finished pieces to verify equal length.`
    : "";

  return {
    POSTS_QTY: String(numPosts),
    RAILS_QTY: String(numRails),
    RAIL_SCREWS_QTY: String(railScrews),
    PLATE_SCREWS_QTY: String(perPlateScrews),
    BOTTOM_PLATE_SCREWS_QTY: String(perPlateScrews),
    TOP_PLATE_SCREWS_QTY: String(perPlateScrews),
    TOTES_QTY: String(cols * rows),
    BOARDS_QTY: String(packBoards([...Array(numPosts).fill(uprightH), ...Array(4).fill(plateLen)])),
    RAIL_BOARDS_QTY: String(Math.ceil((numRails + backSupports) / RAILS_2X4.railsPerBoard)),
    UPRIGHT_HEIGHT: `${toFraction(uprightH)}"`,
    UPRIGHT_DETAIL: is2x4 && uprightH >= STOCK ? 'Full 96" — no cut' : `Cut to ${toFraction(uprightH)}"`,
    UPRIGHT_CUT: uprightCut,
    PLATE_LENGTH: plateLenStr,
    RAIL_LENGTH: '30"',
    RAIL_MARKS: joinMarks(railTopMarks2x4(rows)),
    UNIT_WIDTH: plateLenStr,
    TOP_SHEETS_QTY: String(topSheets),
    TOP_SCREWS_QTY: String(topScrews),
    BACK_SUPPORTS_QTY: String(backSupports),
    BACK_SUPPORT_SCREWS_QTY: String(backSupports * 4),
    BACK_BRACE_LAYOUT: braceLayout,
    BRACE_LENGTH: braceLen,
    OPENING_SPAN: openingStr,
  };
}

// Longest names first so e.g. UPRIGHT_HEIGHT isn't clipped by a shorter token
const TOKEN_RE = /UPRIGHT_DETAIL|UPRIGHT_HEIGHT|UPRIGHT_CUT|BOTTOM_PLATE_SCREWS_QTY|TOP_PLATE_SCREWS_QTY|PLATE_SCREWS_QTY|BACK_SUPPORT_SCREWS_QTY|BACK_SUPPORTS_QTY|BACK_BRACE_LAYOUT|BRACE_LENGTH|RAIL_BOARDS_QTY|RAIL_SCREWS_QTY|RAILS_QTY|POSTS_QTY|TOTES_QTY|BOARDS_QTY|TOP_SHEETS_QTY|TOP_SCREWS_QTY|PLATE_LENGTH|RAIL_LENGTH|RAIL_MARKS|UNIT_WIDTH|OPENING_SPAN/g;

// ═══════════════════════════════════════════════════════════════════════════
// Runtime quantity calculator
// ═══════════════════════════════════════════════════════════════════════════

export function computeMaterials(
  step: AssemblyStep,
  cols: number,
  rows: number,
  config: BuildConfig
): MaterialItem[] {
  const values = tokenValues(cols, rows, config);
  return step.materials.map((m) => ({
    ...m,
    qty: values[m.qty] ?? m.qty,
    detail: m.detail.replace(TOKEN_RE, (t) => values[t] ?? t),
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
  const values = tokenValues(cols, rows, config);
  return text.replace(TOKEN_RE, (t) => values[t] ?? t);
}

// Re-export for backward compat
export { ALL_STEPS as ASSEMBLY_STEPS };
