// ═══════════════════════════════════════════════════════════════════════════
// DIY PDF GENERATOR — IKEA-Style Visual Blueprint PDF
//
// Generates a multi-page PDF document using jsPDF with:
//   Page 1: Cover page with completed unit render + parts/hardware list
//   Page 2: Cut plan with color-coded board layout diagrams
//   Pages 3-6: Assembly steps with 3D snapshots (60% of page) + instructions
//
// The PDF is designed to be printed on standard letter paper (8.5" × 11")
// and uses the same color palette as the cut list for visual consistency.
// ═══════════════════════════════════════════════════════════════════════════

import jsPDF from "jspdf";
import type { CutListResult } from "./diy-cut-list";
import type { BlueprintSnapshotResult } from "@/components/visualizer/BlueprintVisualizer";

// ── Layout constants (all in mm — jsPDF default) ───────────────────────

const PAGE_W = 215.9; // Letter width
const PAGE_H = 279.4; // Letter height
const MARGIN = 15;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const CONTENT_H = PAGE_H - 2 * MARGIN;

// ── Color palette ──────────────────────────────────────────────────────

const COLORS = {
  primary: [30, 64, 175] as [number, number, number],     // blue-800
  dark: [15, 23, 42] as [number, number, number],         // slate-900
  medium: [71, 85, 105] as [number, number, number],      // slate-500
  light: [148, 163, 184] as [number, number, number],     // slate-400
  bg: [241, 245, 249] as [number, number, number],        // slate-100
  white: [255, 255, 255] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],       // amber-600
  green: [22, 163, 74] as [number, number, number],       // green-600
};

// ── Type ───────────────────────────────────────────────────────────────

export interface DIYPDFInput {
  /** Unit description (e.g., "4×4 Standard Tote Organizer") */
  unitName: string;
  /** Config summary */
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  hasWheels: boolean;
  hasTop: boolean;
  /** Cut list result from generateCutList() */
  cutList: CutListResult;
  /** 3D snapshot images (4 steps, each as JPEG data URL) */
  snapshots: BlueprintSnapshotResult[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════════════════

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function addPageNumber(doc: jsPDF, pageNum: number, totalPages: number) {
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.light);
  doc.text(
    `Page ${pageNum} of ${totalPages}`,
    PAGE_W / 2,
    PAGE_H - 8,
    { align: "center" }
  );
}

function addHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(title, MARGIN, y);

  // Underline
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y + 2, MARGIN + CONTENT_W, y + 2);

  return y + 10;
}

function addSubHeader(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(text, MARGIN, y);
  return y + 6;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 1: Cover Page
// ═══════════════════════════════════════════════════════════════════════════

function renderCoverPage(
  doc: jsPDF,
  input: DIYPDFInput,
  totalPages: number
) {
  const { cutList, snapshots, cols, rows, toteType, hasWheels, hasTop } = input;

  // ── Title block ─────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, PAGE_W, 45, "F");

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.white);
  doc.text("DIY Assembly Blueprint", MARGIN, 22);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 200, 230);
  doc.text(input.unitName, MARGIN, 34);

  // ── Unit info chips ─────────────────────────────────────────────────
  let chipY = 55;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const chips = [
    `${cols}×${rows} (${cols * rows} totes)`,
    toteType === "HDX" ? "HDX / Home Depot" : "Greenmade / Costco",
    hasWheels ? "With Casters" : "Stationary",
    hasTop ? "Plywood Worktop" : "Open Top",
    `${cutList.dimensions.totalWStr} W × ${cutList.dimensions.totalHStr} H × ${cutList.dimensions.depthStr} D`,
  ];

  let chipX = MARGIN;
  for (const chip of chips) {
    const textW = doc.getTextWidth(chip) + 6;
    doc.setFillColor(...COLORS.bg);
    doc.roundedRect(chipX, chipY - 4, textW, 7, 1, 1, "F");
    doc.setTextColor(...COLORS.medium);
    doc.text(chip, chipX + 3, chipY + 0.5);
    chipX += textW + 3;
    if (chipX > PAGE_W - MARGIN - 30) {
      chipX = MARGIN;
      chipY += 10;
    }
  }

  // ── Completed unit image (largest snapshot) ─────────────────────────
  const completeSnapshot = snapshots[snapshots.length - 1];
  if (completeSnapshot) {
    const imgW = CONTENT_W * 0.7;
    const imgH = imgW * 0.75;
    const imgX = MARGIN + (CONTENT_W - imgW) / 2;
    const imgY = chipY + 12;

    try {
      doc.addImage(
        completeSnapshot.imageDataUrl,
        "JPEG",
        imgX,
        imgY,
        imgW,
        imgH
      );
    } catch {
      // Fallback: gray rectangle if image can't be embedded
      doc.setFillColor(230, 230, 230);
      doc.rect(imgX, imgY, imgW, imgH, "F");
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.medium);
      doc.text("3D Model Render", imgX + imgW / 2, imgY + imgH / 2, {
        align: "center",
      });
    }

    let listY = imgY + imgH + 12;

    // ── Parts list ──────────────────────────────────────────────────
    listY = addSubHeader(doc, "Parts List", listY);

    doc.setFontSize(8);
    for (const part of cutList.parts) {
      // Color swatch
      const [r, g, b] = hexToRgb(part.color.bg);
      doc.setFillColor(r, g, b);
      doc.circle(MARGIN + 3, listY - 1.2, 2, "F");

      // Label
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.dark);
      doc.text(`Part ${part.label}`, MARGIN + 8, listY);

      // Description
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.medium);
      doc.text(
        `${part.qty}× ${part.name} — ${part.lengthStr} (${part.material})`,
        MARGIN + 28,
        listY
      );

      listY += 5;
    }

    // ── Hardware list ────────────────────────────────────────────────
    listY += 4;
    listY = addSubHeader(doc, "Hardware", listY);

    doc.setFontSize(8);
    for (const hw of cutList.hardware) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.dark);
      doc.text(`${hw.qty}×`, MARGIN + 3, listY);
      doc.setTextColor(...COLORS.medium);
      doc.text(`${hw.name} — ${hw.detail}`, MARGIN + 16, listY);
      listY += 5;
    }
  }

  addPageNumber(doc, 1, totalPages);
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 2: Cut Plan
// ═══════════════════════════════════════════════════════════════════════════

function renderCutPlanPage(
  doc: jsPDF,
  input: DIYPDFInput,
  totalPages: number
) {
  const { cutList } = input;

  let y = addHeader(doc, "Lumber Cut Plan", MARGIN + 8);
  y += 2;

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.medium);
  doc.text(
    `Each bar below represents one 2×4×8' board (96"). Colored sections are your cuts. Gray areas are waste.`,
    MARGIN,
    y
  );
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.dark);
  doc.text(
    `Total 2×4×8' boards needed: ${cutList.totalBoards}   |   Total plywood sheets: ${cutList.totalSheets}`,
    MARGIN,
    y
  );
  y += 8;

  // ── Board layout diagrams ───────────────────────────────────────────
  for (const board of cutList.boardLayouts) {
    if (y > PAGE_H - 40) break; // Don't overflow page

    // Board label
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.medium);
    doc.text(`Board #${board.boardIndex} — 8' (96")`, MARGIN, y);
    y += 4;

    // Draw board bar
    const barH = 8;
    const barW = CONTENT_W;

    // Background (full board)
    doc.setFillColor(230, 230, 230);
    doc.rect(MARGIN, y, barW, barH, "F");
    doc.setDrawColor(180, 180, 180);
    doc.rect(MARGIN, y, barW, barH, "S");

    // Draw each cut segment
    let curX = MARGIN;
    for (const cut of board.cuts) {
      const pct = cut.length / board.stockLength;
      const segW = pct * barW;

      const [r, g, b] = hexToRgb(cut.color.bg);
      doc.setFillColor(r, g, b);
      doc.rect(curX, y, segW, barH, "F");

      // Label inside segment
      if (segW > 12) {
        const [fr, fg, fb] = hexToRgb(cut.color.fg);
        doc.setTextColor(fr, fg, fb);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.text(
          `${cut.label} (${cut.length}")`,
          curX + segW / 2,
          y + barH / 2 + 1.5,
          { align: "center" }
        );
      }

      // Separator line
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.3);
      doc.line(curX + segW, y, curX + segW, y + barH);

      curX += segW;
    }

    // Waste label
    if (board.remainder > 5) {
      doc.setFontSize(5);
      doc.setTextColor(160, 160, 160);
      const wasteW = (board.remainder / board.stockLength) * barW;
      if (wasteW > 8) {
        doc.text(
          `${Math.round(board.remainder * 10) / 10}" waste`,
          curX + wasteW / 2,
          y + barH / 2 + 1.2,
          { align: "center" }
        );
      }
    }

    y += barH + 6;
  }

  // ── Plywood ripping notes ───────────────────────────────────────────
  y += 4;
  y = addSubHeader(doc, "Plywood Ripping Guide", y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.medium);

  for (let i = 0; i < cutList.plywoodNotes.length; i++) {
    const note = cutList.plywoodNotes[i];
    const lines = doc.splitTextToSize(note, CONTENT_W - 10);
    doc.text(`${i + 1}.`, MARGIN, y);
    doc.text(lines, MARGIN + 6, y);
    y += lines.length * 4 + 2;
  }

  addPageNumber(doc, 2, totalPages);
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGES 3-6: Assembly Steps (3D Snapshot + Instructions)
// ═══════════════════════════════════════════════════════════════════════════

function renderAssemblyStepPage(
  doc: jsPDF,
  snapshot: BlueprintSnapshotResult,
  stepIndex: number,
  cutList: CutListResult,
  totalPages: number
) {
  const pageNum = 3 + stepIndex;

  // ── Step header ─────────────────────────────────────────────────────
  let y = MARGIN + 4;

  // Step number badge
  doc.setFillColor(...COLORS.primary);
  doc.circle(MARGIN + 5, y + 2, 5, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.white);
  doc.text(String(stepIndex + 1), MARGIN + 5, y + 3.5, { align: "center" });

  // Step title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(snapshot.title.replace(/^Step \d+:\s*/, ""), MARGIN + 14, y + 4);

  y += 14;

  // ── 3D Snapshot (60% of content area) ──────────────────────────────
  const imgH = CONTENT_H * 0.55;
  const imgW = CONTENT_W;

  try {
    doc.addImage(
      snapshot.imageDataUrl,
      "JPEG",
      MARGIN,
      y,
      imgW,
      imgH
    );
  } catch {
    doc.setFillColor(240, 240, 240);
    doc.rect(MARGIN, y, imgW, imgH, "F");
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.medium);
    doc.text("3D Assembly View", MARGIN + imgW / 2, y + imgH / 2, {
      align: "center",
    });
  }

  // Thin border around image
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, imgW, imgH, "S");

  y += imgH + 8;

  // ── Instructions ───────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.dark);

  const lines = doc.splitTextToSize(snapshot.description, CONTENT_W);
  doc.text(lines, MARGIN, y);
  y += lines.length * 4.5 + 6;

  // ── Parts needed for this step ─────────────────────────────────────
  // Map step IDs to relevant parts
  const stepPartsMap: Record<string, string[]> = {
    "base-frame": ["Bottom/Top Plate"],
    "uprights": ["Upright Post"],
    "rails": ["Plywood Rail Strip", "Back Support Brace"],
    "complete": ["Plywood Top"],
  };

  const relevantPartNames = stepPartsMap[snapshot.stepId] || [];
  const relevantParts = cutList.parts.filter((p) =>
    relevantPartNames.some((name) => p.name.includes(name))
  );

  if (relevantParts.length > 0) {
    // Parts box
    doc.setFillColor(...COLORS.bg);
    const boxH = 6 + relevantParts.length * 5.5;
    doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 2, 2, "F");

    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text("PARTS FOR THIS STEP:", MARGIN + 4, y);
    y += 5;

    for (const part of relevantParts) {
      // Color swatch
      const [r, g, b] = hexToRgb(part.color.bg);
      doc.setFillColor(r, g, b);
      doc.circle(MARGIN + 6, y - 1.2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.dark);
      doc.text(`Part ${part.label}`, MARGIN + 11, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.medium);
      doc.text(
        `${part.qty}× ${part.name} at ${part.lengthStr}`,
        MARGIN + 30,
        y
      );

      y += 5.5;
    }
  }

  // ── Hardware callout for specific steps ─────────────────────────────
  const stepHardware: Record<string, string> = {
    "base-frame":
      "Fasten with #9 × 3\" star drive screws (2 per joint).",
    "uprights":
      "Fasten with #9 × 3\" star drive screws (2 per post-plate connection).",
    "rails":
      "Fasten with #9 × 1-5/8\" star drive screws (2 per rail end, 4 per rail total).",
    "complete": "Fasten plywood top with #9 × 1-5/8\" screws at each post location.",
  };

  const hwNote = stepHardware[snapshot.stepId];
  if (hwNote) {
    y += 4;
    doc.setFillColor(255, 251, 235); // amber-50
    doc.roundedRect(MARGIN, y - 3, CONTENT_W, 8, 1, 1, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.amber);
    doc.text("FASTENER: ", MARGIN + 3, y + 1);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.dark);
    doc.text(hwNote, MARGIN + 22, y + 1);
  }

  addPageNumber(doc, pageNum, totalPages);
}

// ═══════════════════════════════════════════════════════════════════════════
// Main PDF Generation Function
// ═══════════════════════════════════════════════════════════════════════════

export function generateDIYPDF(input: DIYPDFInput): jsPDF {
  const totalPages = 2 + input.snapshots.length; // cover + cut plan + N steps

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  // ── Page 1: Cover ───────────────────────────────────────────────────
  renderCoverPage(doc, input, totalPages);

  // ── Page 2: Cut Plan ────────────────────────────────────────────────
  doc.addPage("letter", "portrait");
  renderCutPlanPage(doc, input, totalPages);

  // ── Pages 3+: Assembly Steps ────────────────────────────────────────
  for (let i = 0; i < input.snapshots.length; i++) {
    doc.addPage("letter", "portrait");
    renderAssemblyStepPage(doc, input.snapshots[i], i, input.cutList, totalPages);
  }

  return doc;
}

/**
 * Generate and download the DIY blueprint PDF.
 */
export function downloadDIYPDF(input: DIYPDFInput): void {
  const doc = generateDIYPDF(input);
  const filename = `DIY-Blueprint-${input.cols}x${input.rows}-${input.toteType}.pdf`;
  doc.save(filename);
}
