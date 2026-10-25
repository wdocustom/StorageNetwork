import "server-only";

// ═══════════════════════════════════════════════════════════════════════════
// LADDER JIG CONTENT — paid guide content, only sent to verified buyers
//
// Same jig as the installer guide (LadderJigPlans.tsx): a 37" × 96" OSB
// base, two full-length 2×4 rails 30" apart, and a square stop block. The
// retail edition's rung marks are the 2×4-rail TOP EDGES the DIY plans use,
// measured from the stop block (= the bottom of the uprights).
// ═══════════════════════════════════════════════════════════════════════════

import { railTopMarks2x4 } from "@/components/visualizer/assemblySteps";
import { toFraction } from "@/lib/utils";

export interface LadderJigContent {
  materials: { qty: number; item: string; note: string }[];
  tools: string[];
  cutList: { piece: string; material: string; qty: number; dimensions: string; notes: string }[];
  /** Rail top-edge marks from the stop block, inches */
  marks: number[];
  buildSteps: { title: string; detail: string }[];
  useSteps: { title: string; detail: string }[];
}

export function ladderJigContent(): LadderJigContent {
  const marks = railTopMarks2x4(6);
  const markText = marks.map((m) => `${toFraction(m)}"`).join(", ");
  return {
    materials: [
      { qty: 1, item: `4' × 8' sheet of 1/2" OSB`, note: "Base platform" },
      { qty: 3, item: "2×4 × 8' construction lumber", note: "Rails & stop block — pick the straightest boards you can find" },
      { qty: 38, item: '2" star-drive countersink screws', note: "Construction / deck screws" },
    ],
    tools: [
      "Framing square (NOT a speed square)",
      "Tape measure",
      "Circular saw",
      "Pencil",
      "Clamps (optional, but helpful)",
      "Drill / driver with star bit",
    ],
    cutList: [
      { piece: "OSB base", material: '1/2" OSB', qty: 1, dimensions: '37" × 96"', notes: 'Rip 11" off the 48" width. Keep the factory edge.' },
      { piece: "Rail A", material: "2×4 × 8'", qty: 1, dimensions: '96" (full length)', notes: "No cut needed." },
      { piece: "Rail B", material: "2×4 × 8'", qty: 1, dimensions: '96" (full length)', notes: "No cut needed." },
      { piece: "Stop block", material: "2×4 × 8'", qty: 1, dimensions: '30"', notes: "Cut from the third 2×4. Sits between the rails, not on them." },
    ],
    marks,
    buildSteps: [
      {
        title: "Cut the OSB base",
        detail: `Rip the 4'×8' OSB sheet to 37" wide and keep the full 96" length. Use a straight edge or chalk line for an accurate rip.`,
      },
      {
        title: "Fasten Rail A",
        detail: `Lay a full-length 2×4 flat and flush along one long edge of the OSB. Fasten it with 2" screws every 12–16", keeping it dead straight.`,
      },
      {
        title: "Fasten Rail B",
        detail: `Lay the second 2×4 along the opposite edge so the gap between the rails is exactly 30" along the entire length — measure at both ends and the middle. Fasten with 2" screws.`,
      },
      {
        title: "Square and fasten the stop block",
        detail: `Cut the third 2×4 to 30" and set it between the rails at one end. Check it's exactly 90° to both rails with a framing square, then fasten with 2" screws.`,
      },
      {
        title: "Mark the rail lines",
        detail: `Measuring from the inside face of the stop block, mark both rails at ${markText}. Square each line across the rail and label it — these are the top edges of your tote rails.`,
      },
    ],
    useSteps: [
      {
        title: "Load two uprights",
        detail:
          "Lay a front and a back upright flat in the jig, one against Rail A and one against Rail B, bottom ends tight against the stop block. Their outside faces are now exactly 30\" apart.",
      },
      {
        title: "Set each 2×4 rail on its line",
        detail:
          "Lay each ripped 2×4 rail across both uprights with its far edge (away from the stop block) on the line. The ends land flush with the outsides of the uprights automatically.",
      },
      {
        title: "Fasten and flip",
        detail:
          'Drive #9 × 3" screws through each rail into both uprights — 2 per end. End ladders get rails on one face. For middle ladders, flip the frame over in the jig and repeat on the other face, shifting the screws about 1/2" so they don\'t meet.',
      },
      {
        title: "Repeat",
        detail:
          "Lift the finished ladder out and load the next pair. Every ladder comes out identical, so the frame goes together square.",
      },
    ],
  };
}
