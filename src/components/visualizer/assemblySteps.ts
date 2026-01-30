// ═══════════════════════════════════════════════════════════════════════════
// Assembly Guide — Step Data Structure
//
// Drives the interactive step-by-step 3D assembly sequencer.
// Each step defines which part groups are visible, what's ghosted,
// where screws appear, and the UI card content.
// ═══════════════════════════════════════════════════════════════════════════

export type PartGroup =
  | "posts"
  | "rails"
  | "bottomPlates"
  | "topPlates"
  | "totes"
  | "casters"
  | "plyTop"
  | "screws";

/** Visibility state for each part group during a step */
export type PartVisibility = "visible" | "ghosted" | "hidden";

export interface MaterialItem {
  name: string;
  qty: string; // dynamic — filled at runtime based on cols/rows
  detail: string;
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
  /** Camera focus hint */
  cameraHint?: "front" | "side" | "bottom" | "overview";
}

// ═══════════════════════════════════════════════════════════════════════════
// Step Definitions
// ═══════════════════════════════════════════════════════════════════════════

export const ASSEMBLY_STEPS: AssemblyStep[] = [
  {
    id: "cut-mark",
    title: "Cut & Mark",
    instruction:
      "Cut all 2×4 vertical posts and plywood rail strips to size. Mark rail locations on each post at 13\" from bottom, then every 16\" on center.",
    partStates: {
      posts: "visible",
      rails: "visible",
      bottomPlates: "hidden",
      topPlates: "hidden",
      totes: "hidden",
      casters: "hidden",
      plyTop: "hidden",
      screws: "hidden",
    },
    materials: [
      { name: "2×4 × 8' Studs", qty: "POSTS_QTY", detail: "Cut to post height" },
      { name: '3/4" Plywood Strips', qty: "RAILS_QTY", detail: '1.875" × 30" rails' },
    ],
    cameraHint: "overview",
  },
  {
    id: "ladders",
    title: "Build the Ladders",
    instruction:
      'Attach plywood rails to the side faces of paired vertical posts. First rail bottom edge at 13" from post bottom. Space rails 16" on center. Use 1-5/8" construction screws.',
    partStates: {
      posts: "visible",
      rails: "visible",
      bottomPlates: "hidden",
      topPlates: "hidden",
      totes: "hidden",
      casters: "hidden",
      plyTop: "hidden",
      screws: "visible",
    },
    screwType: {
      label: '#9 × 1-5/8" Star Drive',
      length: 1.625,
      description: "Construction screw — rail to post",
    },
    materials: [
      { name: "2×4 Vertical Posts", qty: "POSTS_QTY", detail: "Paired front/back" },
      { name: "Plywood Rails", qty: "RAILS_QTY", detail: '0.75" × 1.875" × 30"' },
      { name: '#9 × 1-5/8" Screws', qty: "RAIL_SCREWS_QTY", detail: "2 per rail end" },
    ],
    cameraHint: "side",
  },
  {
    id: "frame-assembly",
    title: "Frame Assembly",
    instruction:
      "Stand the completed ladders in position. Attach top and bottom 2×4 plates across the front and back to lock the frame together. Use 3\" construction screws.",
    partStates: {
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      topPlates: "visible",
      totes: "hidden",
      casters: "hidden",
      plyTop: "hidden",
      screws: "visible",
    },
    screwType: {
      label: '#9 × 3" Star Drive',
      length: 3.0,
      description: "Construction screw — plate to post",
    },
    materials: [
      { name: "2×4 Top Plates", qty: "2", detail: "Cut to unit width" },
      { name: "2×4 Bottom Plates", qty: "2", detail: "Cut to unit width" },
      { name: '#9 × 3" Screws', qty: "PLATE_SCREWS_QTY", detail: "2 per post connection" },
    ],
    cameraHint: "front",
  },
  {
    id: "wheels-finish",
    title: "Wheels & Finish",
    instruction:
      'Flip the unit. Attach 4 industrial swivel casters at the corner posts using 1/4" × 1-1/2" lag screws through the mounting plate. Flip upright, load totes, and verify smooth operation.',
    partStates: {
      posts: "visible",
      rails: "visible",
      bottomPlates: "visible",
      topPlates: "visible",
      totes: "visible",
      casters: "visible",
      plyTop: "visible",
      screws: "visible",
    },
    screwType: {
      label: '1/4" × 1-1/2" Lag Screw',
      length: 1.5,
      description: "Lag screw — caster to bottom plate",
    },
    materials: [
      { name: "Industrial Swivel Casters", qty: "4", detail: "Heavy-duty, 5\" wheel" },
      { name: '1/4" × 1-1/2" Lag Screws', qty: "16", detail: "4 per caster plate" },
      { name: "Storage Totes", qty: "TOTES_QTY", detail: "HDX or Greenmade" },
    ],
    cameraHint: "bottom",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Runtime quantity calculator
// ═══════════════════════════════════════════════════════════════════════════

export function computeMaterials(
  step: AssemblyStep,
  cols: number,
  rows: number
): MaterialItem[] {
  const numPosts = (cols + 1) * 2; // front + back
  const numRails = cols * rows * 2; // left + right per bay per tier
  const railScrews = numRails * 4; // 2 screws per rail end × 2 ends
  const plateScrews = (cols + 1) * 2 * 2; // 2 screws per post × front+back
  const totes = cols * rows;

  const qtyMap: Record<string, string> = {
    POSTS_QTY: String(numPosts),
    RAILS_QTY: String(numRails),
    RAIL_SCREWS_QTY: String(railScrews),
    PLATE_SCREWS_QTY: String(plateScrews),
    TOTES_QTY: String(totes),
  };

  return step.materials.map((m) => ({
    ...m,
    qty: qtyMap[m.qty] ?? m.qty,
  }));
}
