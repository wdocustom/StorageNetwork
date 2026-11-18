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

/** Which drawing a step gets in the PDF (see ladder-jig-pdf). */
export type JigDiagramKind = "sheet" | "railA" | "railB" | "stop" | "marks" | "uprights" | "rails" | "screws" | "repeat";

export interface JigStep {
  title: string;
  detail: string;
  /** What this step uses, e.g. "1 × 2×4 × 8' (full length)" */
  parts?: string[];
  tools?: string[];
  tip?: string;
  diagram: JigDiagramKind;
}

export interface LadderJigContent {
  materials: { qty: number; item: string; note: string }[];
  tools: string[];
  cutList: { piece: string; material: string; qty: number; dimensions: string; notes: string }[];
  /** Rail top-edge marks from the stop block, inches */
  marks: number[];
  buildSteps: JigStep[];
  useSteps: JigStep[];
  safety: string[];
  notes: string[];
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
        parts: [`1 × 4' × 8' sheet of 1/2" OSB`],
        tools: ["Circular saw", "Tape measure", "Pencil"],
        tip: "Keep the factory edge on the 37\" piece: it's the straightest edge you have, so Rail A goes there.",
        diagram: "sheet",
      },
      {
        title: "Fasten Rail A",
        detail: `Lay a full-length 2×4 flat and flush along one long edge of the OSB. Fasten it with 2" screws every 12–16", keeping it dead straight.`,
        parts: [`1 × 2×4 × 8' — full length, no cut`, `About 8 × 2" screws`],
        tools: ["Drill / driver with star bit", "Clamps (optional)"],
        tip: "Sight down the board before you fasten it. If it has a slight bow, turn it so the bow faces out and pull it straight as you screw.",
        diagram: "railA",
      },
      {
        title: "Fasten Rail B",
        detail: `Lay the second 2×4 along the opposite edge so the gap between the rails is exactly 30" along the entire length — measure at both ends and the middle. Fasten with 2" screws.`,
        parts: [`1 × 2×4 × 8' — full length, no cut`, `About 8 × 2" screws`],
        tools: ["Tape measure", "Drill / driver with star bit"],
        tip: "Fasten one end, check 30\" at the far end and the middle, then finish. A gap off by 1/8\" makes every ladder off by 1/8\".",
        diagram: "railB",
      },
      {
        title: "Square and fasten the stop block",
        detail: `Cut the third 2×4 to 30" and set it between the rails at one end. Check it's exactly 90° to both rails with a framing square, then fasten with 2" screws.`,
        parts: [`1 × stop block, 30" (cut from the third 2×4)`, `4 × 2" screws`],
        tools: ["Framing square", "Circular saw", "Drill / driver with star bit"],
        tip: "This block squares every ladder you build. Check it against both rails before the last screw goes in.",
        diagram: "stop",
      },
      {
        title: "Mark the rail lines",
        detail: `Measuring from the inside face of the stop block, mark both rails at ${markText}. Square each line across the rail and label it — these are the top edges of your tote rails.`,
        tools: ["Tape measure", "Framing square", "Pencil or marker"],
        tip: "Hook your tape on the stop block and mark all six from that one point; don't measure line to line, or small errors add up.",
        diagram: "marks",
      },
    ],
    useSteps: [
      {
        title: "Load two uprights",
        detail:
          "Lay a front and a back upright flat in the jig, one against Rail A and one against Rail B, bottom ends tight against the stop block. Their outside faces are now exactly 30\" apart.",
        parts: ["2 × uprights, from your plan's cut list"],
        tip: "Bottom ends tight to the stop block and faces tight to the rails: that's what makes every ladder identical.",
        diagram: "uprights",
      },
      {
        title: "Set each rail on its line",
        detail:
          "Lay each rail (ripped 2×4 or plywood strip) across both uprights with its TOP edge — the far edge, away from the stop block — on the line. The ends land flush with the outsides of the uprights automatically.",
        parts: ["Rails, from your plan's cut list"],
        tip: "Far edge on the line, never the near edge. The lines mark the tops of the rails, where the totes hang.",
        diagram: "rails",
      },
      {
        title: "Fasten and flip",
        detail:
          'Drive #9 × 3" screws through each rail into both uprights — 2 per end. End ladders get rails on one face. For middle ladders, flip the frame over in the jig and repeat on the other face, shifting the screws about 1/2" so they don\'t meet.',
        parts: ['#9 × 3" star-drive screws, 2 per rail end'],
        tools: ["Drill / driver", "T-25 star bit"],
        tip: "Hold the rail on its line with one hand while the first screw bites; the second screw at that end locks it.",
        diagram: "screws",
      },
      {
        title: "Repeat",
        detail:
          "Lift the finished ladder out and load the next pair. Every ladder comes out identical, so the frame goes together square.",
        tip: "Build every ladder for the whole project in one session: same setup, same rhythm, fewer mistakes.",
        diagram: "repeat",
      },
    ],
    safety: [
      "Wear safety glasses when cutting and driving screws.",
      "Rip the OSB on a stable surface with the offcut supported, so the blade doesn't bind.",
      "Keep fingers well clear of the saw blade; use clamps instead of hands where you can.",
      "Work on a flat floor: the jig is only as flat as what's under it.",
    ],
    notes: [
      "Rail marks are the TOP edges of your tote rails, measured from the inside face of the stop block (the bottom of the uprights).",
      `The six marks fit a rack up to 6 totes tall. Shorter racks use the first marks only: a 4-high rack uses ${marks.slice(0, 4).map((m) => `${toFraction(m)}"`).join(", ")}.`,
      "Ripped 2×4 rails and plywood-strip rails use the same marks: every rail is placed by its TOP edge, never its center. The jig fits standard racks, 30\" between the uprights' outside faces.",
      "Store the jig flat, or stand it on edge against a wall. It keeps for every rack you build.",
    ],
  };
}
