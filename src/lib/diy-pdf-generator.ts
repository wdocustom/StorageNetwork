// ═══════════════════════════════════════════════════════════════════════════
// DIY PDF GENERATOR — Printable tote organizer build plan
//
// Built from the same sources as the interactive 3D Assembly Guide:
//   • CompleteDIYPlan (generate-plan.ts) — build-engine shopping list and
//     cut plan, every guide step with materials, tools, fasteners, pro tips
//   • AssemblyStepSnapshots — one 3D render per guide step
//
// Layout (US Letter, portrait):
//   1. Cover — finished unit render, at-a-glance numbers
//   2. Before you start — tools + shopping checklists, safety, notes
//   3. Cut plan — identical boards grouped, plywood ripping guide
//   4. One page per assembly step — render, instructions, parts, tools,
//      fastener callout, pro tip, step-complete checkbox
//
// Sections flow onto extra pages instead of being clipped, and every page
// after the cover carries a running header and "Page X of Y" footer.
// ═══════════════════════════════════════════════════════════════════════════

import jsPDF from "jspdf";
import type { CompleteDIYPlan, PlanAssemblyStep, PlanCutDiagram } from "@/app/actions/generate-plan";

// ── Layout constants (mm) ──────────────────────────────────────────────

const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN = 16;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const BODY_TOP = 26; // below running header
const BODY_BOTTOM = PAGE_H - 18; // above footer

type RGB = [number, number, number];

const COLORS = {
  ink: [15, 23, 42] as RGB, // slate-900
  body: [51, 65, 85] as RGB, // slate-700
  muted: [100, 116, 139] as RGB, // slate-500
  faint: [203, 213, 225] as RGB, // slate-300
  panel: [241, 245, 249] as RGB, // slate-100
  white: [255, 255, 255] as RGB,
  accent: [250, 204, 21] as RGB, // yellow-400 (brand)
  accentInk: [161, 98, 7] as RGB, // yellow-700
  tipBg: [254, 249, 195] as RGB, // yellow-100
  fastenerBg: [255, 237, 213] as RGB, // orange-100
  fastenerInk: [194, 65, 12] as RGB, // orange-700
  lumber: [217, 180, 130] as RGB,
  lumberInk: [92, 64, 30] as RGB,
  waste: [226, 232, 240] as RGB,
};

// ── Input ──────────────────────────────────────────────────────────────

export interface DIYPDFInput {
  plan: CompleteDIYPlan;
  /** One render per assembly step, matched to plan.assemblySteps by id */
  snapshots: { stepId: string; imageDataUrl: string }[];
  /** Shown under the title on the cover, e.g. "Purchased by jo@example.com" */
  licensedTo?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

// The built-in Helvetica only encodes WinAnsi; map the few characters the
// build engine uses outside it and drop anything else unprintable.
const CHAR_MAP: Record<string, string> = {
  "⅛": "1/8", "¼": "1/4", "⅜": "3/8", "½": "1/2", "⅝": "5/8", "¾": "3/4", "⅞": "7/8",
  "→": "->", "−": "-", "≤": "<=", "≥": ">=", "′": "'", "″": '"',
};

export function pdfText(text: string): string {
  return text
    .replace(/[⅛¼⅜½⅝¾⅞→−≤≥′″]/g, (ch) => CHAR_MAP[ch] ?? ch)
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…×]/g, "");
}

function setText(doc: jsPDF, size: number, color: RGB, style: "normal" | "bold" | "italic" = "normal") {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

/** Line height in mm for a font size in pt. */
function lineH(size: number): number {
  return size * 0.3528 * 1.35;
}

/** Wrap and draw text; returns the y below it. */
function paragraph(doc: jsPDF, text: string, x: number, y: number, width: number, size: number): number {
  const lines = doc.splitTextToSize(pdfText(text), width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineH(size);
}

function measure(doc: jsPDF, text: string, width: number, size: number): number {
  doc.setFontSize(size);
  return (doc.splitTextToSize(pdfText(text), width) as string[]).length * lineH(size);
}

function checkbox(doc: jsPDF, x: number, y: number, size = 3.2) {
  doc.setDrawColor(...COLORS.muted);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y - size + 0.4, size, size, 0.5, 0.5, "S");
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...COLORS.accent);
  doc.rect(MARGIN, y - 4.6, 1.6, 6, "F");
  setText(doc, 14, COLORS.ink, "bold");
  doc.text(pdfText(title), MARGIN + 4, y);
  return y + 8;
}

/** Flowing page cursor: adds a page when the next block won't fit. */
class Cursor {
  y = BODY_TOP;
  constructor(private doc: jsPDF) {}
  newPage() {
    this.doc.addPage("letter", "portrait");
    this.y = BODY_TOP;
  }
  ensure(height: number) {
    if (this.y + height > BODY_BOTTOM) this.newPage();
  }
}

function addImageSafe(doc: jsPDF, dataUrl: string | undefined, x: number, y: number, w: number, h: number, label: string) {
  if (dataUrl) {
    try {
      doc.addImage(dataUrl, "JPEG", x, y, w, h);
      return;
    } catch {
      // fall through to placeholder
    }
  }
  doc.setFillColor(...COLORS.panel);
  doc.rect(x, y, w, h, "F");
  setText(doc, 10, COLORS.muted);
  doc.text(label, x + w / 2, y + h / 2, { align: "center" });
}

// ═══════════════════════════════════════════════════════════════════════════
// Cover
// ═══════════════════════════════════════════════════════════════════════════

function renderCover(doc: jsPDF, input: DIYPDFInput) {
  const { plan } = input;

  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, PAGE_W, 58, "F");
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 58, PAGE_W, 1.4, "F");

  setText(doc, 9, COLORS.accent, "bold");
  doc.text("STORAGE NETWORK  ·  DIY BUILD PLAN", MARGIN, 18);
  setText(doc, 26, COLORS.white, "bold");
  doc.text(pdfText(plan.unitName), MARGIN, 33);

  const features = [
    `${plan.toteCount} totes`,
    plan.toteType === "HDX" ? "HDX / Home Depot 27-gal totes" : "Greenmade / Costco 27-gal totes",
    plan.hasWheels ? "on casters" : "stationary",
    plan.hasTop ? "plywood worktop" : "open top",
  ];
  setText(doc, 11, [203, 213, 225]);
  doc.text(pdfText(features.join("  ·  ")), MARGIN, 43);
  if (input.licensedTo) {
    setText(doc, 8, [148, 163, 184]);
    doc.text(pdfText(input.licensedTo), MARGIN, 51);
  }

  // Hero — the finished unit (last step render)
  const hero = input.snapshots[input.snapshots.length - 1]?.imageDataUrl;
  const heroW = CONTENT_W;
  const heroH = heroW * 0.75;
  const heroY = 68;
  addImageSafe(doc, hero, MARGIN, heroY, heroW, heroH, "Finished unit");

  // At a glance
  const d = plan.dimensions;
  const stats: [string, string][] = [
    ["Width", d.totalWidth],
    ["Height", d.totalHeightWithWheels ?? d.totalHeight],
    ["Depth", d.depth],
    ["2×4×8' boards", String(plan.totals.boards)],
    ['3/4" plywood sheets', String(plan.totals.sheets)],
    ["Assembly steps", String(plan.assemblySteps.length)],
  ];
  const statY = heroY + heroH + 8;
  const cellW = CONTENT_W / 3;
  const cellH = 17;
  stats.forEach(([label, value], i) => {
    const cx = MARGIN + (i % 3) * cellW;
    const cy = statY + Math.floor(i / 3) * (cellH + 3);
    doc.setFillColor(...COLORS.panel);
    doc.roundedRect(cx + 1, cy, cellW - 2, cellH, 2, 2, "F");
    setText(doc, 7.5, COLORS.muted, "bold");
    doc.text(pdfText(label.toUpperCase()), cx + 5, cy + 6);
    setText(doc, 14, COLORS.ink, "bold");
    doc.text(pdfText(value), cx + 5, cy + 13.5);
  });

  setText(doc, 8, COLORS.muted);
  paragraph(
    doc,
    "Read the whole plan once before you buy materials. Cut every piece first, then assemble in order — each step builds on the last.",
    MARGIN,
    PAGE_H - 16,
    CONTENT_W,
    8,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Before you start — tools, shopping list, safety, notes
// ═══════════════════════════════════════════════════════════════════════════

function renderBeforeYouStart(doc: jsPDF, cur: Cursor, plan: CompleteDIYPlan) {
  cur.y = sectionTitle(doc, "Before You Start", cur.y);

  // Tools — two-column checklist
  setText(doc, 10, COLORS.ink, "bold");
  doc.text("Tools", MARGIN, cur.y);
  cur.y += 5.5;
  const colW = CONTENT_W / 2;
  const toolRows = Math.ceil(plan.allTools.length / 2);
  plan.allTools.forEach((tool, i) => {
    const x = MARGIN + (i < toolRows ? 0 : colW);
    const y = cur.y + (i % toolRows) * 6;
    checkbox(doc, x, y);
    setText(doc, 9, COLORS.body);
    doc.text(pdfText(tool), x + 5.5, y);
  });
  cur.y += toolRows * 6 + 5;

  // Shopping list
  cur.ensure(20);
  setText(doc, 10, COLORS.ink, "bold");
  doc.text("Shopping List", MARGIN, cur.y);
  cur.y += 5.5;
  for (const item of plan.shoppingList) {
    cur.ensure(7);
    checkbox(doc, MARGIN, cur.y);
    setText(doc, 9, COLORS.ink, "bold");
    doc.text(pdfText(String(item.qty)), MARGIN + 6, cur.y);
    doc.text(pdfText(item.name), MARGIN + 24, cur.y);
    setText(doc, 9, COLORS.muted);
    doc.text(pdfText(item.detail), MARGIN + 82, cur.y);
    doc.setDrawColor(...COLORS.panel);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, cur.y + 2.2, MARGIN + CONTENT_W, cur.y + 2.2);
    cur.y += 6.5;
  }
  cur.y += 4;

  const bulletList = (title: string, items: string[]) => {
    cur.ensure(14);
    setText(doc, 10, COLORS.ink, "bold");
    doc.text(title, MARGIN, cur.y);
    cur.y += 5.5;
    for (const item of items) {
      const h = measure(doc, item, CONTENT_W - 6, 9);
      cur.ensure(h + 1);
      setText(doc, 9, COLORS.body);
      doc.text("•", MARGIN + 1, cur.y);
      cur.y = paragraph(doc, item, MARGIN + 5, cur.y, CONTENT_W - 6, 9) + 1;
    }
    cur.y += 3;
  };

  bulletList("Safety", plan.safetyNotes);
  bulletList("Good to Know", plan.generalNotes);
}

// ═══════════════════════════════════════════════════════════════════════════
// Cut plan — identical boards grouped
// ═══════════════════════════════════════════════════════════════════════════

export interface BoardGroup {
  count: number;
  firstIndex: number;
  board: PlanCutDiagram;
}

/** Collapse boards with the same cuts into "×N" groups, keeping order. */
export function groupBoards(boards: PlanCutDiagram[]): BoardGroup[] {
  const groups: BoardGroup[] = [];
  const key = (b: PlanCutDiagram) => b.cuts.map((c) => `${c.label}:${c.length}`).join("|");
  for (const board of boards) {
    const existing = groups.find((g) => key(g.board) === key(board));
    if (existing) existing.count += 1;
    else groups.push({ count: 1, firstIndex: board.boardIndex, board });
  }
  return groups;
}

function renderCutPlan(doc: jsPDF, cur: Cursor, plan: CompleteDIYPlan) {
  cur.newPage();
  cur.y = sectionTitle(doc, "Cut Plan", cur.y);

  setText(doc, 9, COLORS.body);
  cur.y = paragraph(
    doc,
    `Each bar is one 2×4×8' board (96"). Tan sections are your cuts, gray is offcut. ${plan.totals.boards} boards total. Cut everything before you assemble, and stack identical parts to check they match.`,
    MARGIN,
    cur.y,
    CONTENT_W,
    9,
  ) + 4;

  const barH = 9;
  for (const group of groupBoards(plan.cutDiagrams)) {
    cur.ensure(barH + 10);
    const { board, count } = group;
    setText(doc, 8.5, COLORS.ink, "bold");
    doc.text(count > 1 ? `Cut ${count} boards like this` : "Cut 1 board like this", MARGIN, cur.y);
    cur.y += 2.5;

    doc.setFillColor(...COLORS.waste);
    doc.rect(MARGIN, cur.y, CONTENT_W, barH, "F");
    let x = MARGIN;
    for (const cut of board.cuts) {
      const w = (cut.length / board.stockLength) * CONTENT_W;
      doc.setFillColor(...COLORS.lumber);
      doc.rect(x, cur.y, w, barH, "F");
      doc.setDrawColor(...COLORS.white);
      doc.setLineWidth(0.6);
      doc.line(x + w, cur.y, x + w, cur.y + barH);
      if (w > 16) {
        setText(doc, 7.5, COLORS.lumberInk, "bold");
        doc.text(pdfText(`${cut.label} ${formatInches(cut.length)}`), x + w / 2, cur.y + barH / 2 + 1.3, { align: "center" });
      }
      x += w;
    }
    const wasteW = (board.remainder / board.stockLength) * CONTENT_W;
    if (wasteW > 14) {
      setText(doc, 7, COLORS.muted);
      doc.text(pdfText(`${formatInches(board.remainder)} offcut`), x + wasteW / 2, cur.y + barH / 2 + 1.2, { align: "center" });
    }
    doc.setDrawColor(...COLORS.faint);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, cur.y, CONTENT_W, barH, "S");
    cur.y += barH + 6;
  }

  cur.ensure(20);
  cur.y += 2;
  setText(doc, 10, COLORS.ink, "bold");
  doc.text("Plywood Ripping Guide", MARGIN, cur.y);
  cur.y += 5.5;
  plan.plywoodNotes.forEach((note, i) => {
    const h = measure(doc, note, CONTENT_W - 7, 9);
    cur.ensure(h + 1.5);
    setText(doc, 9, COLORS.ink, "bold");
    doc.text(`${i + 1}.`, MARGIN, cur.y);
    setText(doc, 9, COLORS.body);
    cur.y = paragraph(doc, note, MARGIN + 6, cur.y, CONTENT_W - 7, 9) + 1.5;
  });
}

function formatInches(n: number): string {
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 16);
  if (frac === 0) return `${whole}"`;
  if (frac === 16) return `${whole + 1}"`;
  let num = frac;
  let den = 16;
  while (num % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  return whole ? `${whole}-${num}/${den}"` : `${num}/${den}"`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Assembly step pages
// ═══════════════════════════════════════════════════════════════════════════

function renderStep(doc: jsPDF, cur: Cursor, step: PlanAssemblyStep, total: number, image: string | undefined) {
  cur.newPage();

  // Header row
  doc.setFillColor(...COLORS.ink);
  doc.circle(MARGIN + 6, cur.y - 1.5, 6, "F");
  setText(doc, 13, COLORS.accent, "bold");
  doc.text(String(step.stepNumber), MARGIN + 6, cur.y + 0.4, { align: "center" });
  setText(doc, 7.5, COLORS.muted, "bold");
  doc.text(`STEP ${step.stepNumber} OF ${total}`, MARGIN + 15, cur.y - 3.5);
  setText(doc, 16, COLORS.ink, "bold");
  doc.text(pdfText(step.title), MARGIN + 15, cur.y + 2.5);
  cur.y += 10;

  // Render — 4:3, slightly narrower than the page so text fits below
  const imgW = CONTENT_W;
  const imgH = imgW * 0.62;
  addImageSafe(doc, image, MARGIN, cur.y, imgW, imgH, `Step ${step.stepNumber}`);
  doc.setDrawColor(...COLORS.faint);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, cur.y, imgW, imgH, "S");
  cur.y += imgH + 7;

  // Instruction
  setText(doc, 10.5, COLORS.ink);
  cur.y = paragraph(doc, step.instruction, MARGIN, cur.y, CONTENT_W, 10.5) + 4;

  // Parts | Tools columns
  const gap = 6;
  const leftW = CONTENT_W * 0.58;
  const rightW = CONTENT_W - leftW - gap;
  const partLines = step.materials.map((m) => `${m.qty} × ${m.name}${m.detail ? ` — ${m.detail}` : ""}`);
  const toolLines = step.tools.map((t) => (t.detail ? `${t.name} (${t.detail})` : t.name));
  const colHeight = (lines: string[], w: number) =>
    lines.reduce((h, l) => h + measure(doc, l, w - 6, 9) + 1, 0);
  const boxH = 10 + Math.max(colHeight(partLines, leftW), colHeight(toolLines, rightW));

  if (partLines.length || toolLines.length) {
    cur.ensure(boxH);
    const top = cur.y;
    doc.setFillColor(...COLORS.panel);
    doc.roundedRect(MARGIN, top, CONTENT_W, boxH, 2, 2, "F");

    const column = (title: string, lines: string[], x: number, w: number) => {
      setText(doc, 7.5, COLORS.muted, "bold");
      doc.text(title, x + 3, top + 5.5);
      let y = top + 10.5;
      for (const line of lines) {
        setText(doc, 9, COLORS.body);
        doc.text("•", x + 3, y);
        y = paragraph(doc, line, x + 6, y, w - 6, 9) + 1;
      }
    };
    if (partLines.length) column("YOU'LL NEED", partLines, MARGIN, leftW);
    if (toolLines.length) column("TOOLS", toolLines, MARGIN + leftW + gap, rightW);
    cur.y = top + boxH + 4;
  }

  // Fastener callout
  if (step.screwType) {
    const text = `${step.screwType.label} — ${step.screwType.description}`;
    const h = measure(doc, text, CONTENT_W - 30, 9) + 5;
    cur.ensure(h);
    doc.setFillColor(...COLORS.fastenerBg);
    doc.roundedRect(MARGIN, cur.y, CONTENT_W, h, 2, 2, "F");
    setText(doc, 7.5, COLORS.fastenerInk, "bold");
    doc.text("FASTENER", MARGIN + 3, cur.y + 5.2);
    setText(doc, 9, COLORS.ink);
    paragraph(doc, text, MARGIN + 25, cur.y + 5.2, CONTENT_W - 30, 9);
    cur.y += h + 3;
  }

  // Pro tip
  if (step.proTip) {
    const h = measure(doc, step.proTip, CONTENT_W - 30, 9) + 5;
    cur.ensure(h);
    doc.setFillColor(...COLORS.tipBg);
    doc.roundedRect(MARGIN, cur.y, CONTENT_W, h, 2, 2, "F");
    setText(doc, 7.5, COLORS.accentInk, "bold");
    doc.text("PRO TIP", MARGIN + 3, cur.y + 5.2);
    setText(doc, 9, COLORS.ink, "italic");
    paragraph(doc, step.proTip, MARGIN + 25, cur.y + 5.2, CONTENT_W - 30, 9);
    cur.y += h + 3;
  }

  // Step complete
  cur.ensure(8);
  cur.y += 2;
  checkbox(doc, MARGIN, cur.y + 1, 4);
  setText(doc, 9, COLORS.muted, "bold");
  doc.text("Step complete", MARGIN + 6.5, cur.y + 0.6);
}

// ═══════════════════════════════════════════════════════════════════════════
// Running header / footer (stamped after all pages exist)
// ═══════════════════════════════════════════════════════════════════════════

function stampPages(doc: jsPDF, plan: CompleteDIYPlan) {
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    setText(doc, 7.5, COLORS.muted, "bold");
    doc.text("STORAGE NETWORK", MARGIN, 12);
    setText(doc, 7.5, COLORS.muted);
    doc.text(pdfText(`${plan.unitName} — Build Plan`), PAGE_W - MARGIN, 12, { align: "right" });
    doc.setDrawColor(...COLORS.faint);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 14.5, PAGE_W - MARGIN, 14.5);

    setText(doc, 7.5, COLORS.muted);
    doc.text(`Page ${p} of ${total}`, PAGE_W / 2, PAGE_H - 9, { align: "center" });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Entry points
// ═══════════════════════════════════════════════════════════════════════════

export function generateDIYPDF(input: DIYPDFInput): jsPDF {
  const { plan } = input;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  doc.setProperties({
    title: `${pdfText(plan.unitName)} — Build Plan`,
    author: "Storage Network",
    subject: "DIY tote organizer build plan",
  });

  renderCover(doc, input);

  const cur = new Cursor(doc);
  cur.newPage();
  renderBeforeYouStart(doc, cur, plan);
  renderCutPlan(doc, cur, plan);

  const imageById = new Map(input.snapshots.map((s) => [s.stepId, s.imageDataUrl]));
  for (const step of plan.assemblySteps) {
    renderStep(doc, cur, step, plan.assemblySteps.length, imageById.get(step.id));
  }

  stampPages(doc, plan);
  return doc;
}

export function downloadDIYPDF(input: DIYPDFInput): void {
  const { plan } = input;
  generateDIYPDF(input).save(`Build-Plan-${plan.cols}x${plan.rows}-${plan.toteType}.pdf`);
}
