// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — printable PDF of a custom plan
//
// Same workbook as the tote-rack PDF (diy-pdf-generator.ts): black cover
// with the yellow stripe, warm paper inside, kicker + headline sections,
// yellow accents, US Letter.
//
//   Cover        name, finished size, the build rendered in 3D
//   01 Shopping  boards, sheets, screws, hardware, with tick boxes
//   02 Tools     tools checklist and safety
//   03 Parts     every lettered part with its size and quantity
//   04 Cut list  each board and each plywood sheet drawn to scale
//   05 Build     one illustrated step at a time
//   06 Notes     assumptions, leftovers worth keeping, things to fix
//
// Step pictures come from PlanSnapshots (the same 3D scene as the guide).
// Runs in the browser; jsPDF only.
// ═══════════════════════════════════════════════════════════════════════════

import jsPDF from "jspdf";
import { pdfText } from "@/lib/diy-pdf-generator";
import { getStock } from "@/lib/builder/catalog";
import type { CustomPlan, PlanBoard, PlanSheet, PlanStep } from "@/lib/builder/plan";
import { formatInches } from "@/lib/builder/units";

// ── Layout (mm) and colors: the tote-rack workbook's ─────────────────────

const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN = 16;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const BODY_TOP = 26;
const BODY_BOTTOM = PAGE_H - 18;

type RGB = [number, number, number];

const COLORS = {
  black: [10, 10, 10] as RGB,
  paper: [250, 248, 242] as RGB,
  card: [255, 255, 255] as RGB,
  cardLine: [231, 226, 214] as RGB,
  ink: [17, 17, 17] as RGB,
  body: [64, 60, 56] as RGB,
  muted: [120, 113, 108] as RGB,
  panel: [243, 239, 229] as RGB,
  white: [255, 255, 255] as RGB,
  accent: [250, 204, 21] as RGB,
  accentInk: [161, 98, 7] as RGB,
  tipBg: [254, 249, 195] as RGB,
  fastenerInk: [194, 65, 12] as RGB,
  warnBg: [255, 237, 213] as RGB,
  lumber: [222, 184, 135] as RGB,
  lumberLight: [236, 210, 170] as RGB,
  lumberInk: [92, 64, 30] as RGB,
  waste: [236, 232, 222] as RGB,
  coverMuted: [163, 163, 163] as RGB,
};

/** Step pictures are 1200 × 820 */
const SHOT_RATIO = 820 / 1200;

export interface CustomPlanPDFInput {
  plan: CustomPlan;
  /** Renders keyed by "overview" and step id (see PlanSnapshots) */
  snapshots: Record<string, string>;
  /** Storage Network wordmark as a PNG data URL */
  logoDataUrl?: string;
  /** Footer line on every page, e.g. the buyer's license */
  licensedTo?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setText(doc: jsPDF, size: number, color: RGB, style: "normal" | "bold" | "italic" = "normal") {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

/** Line height in mm for a font size in pt. */
const lineH = (size: number) => size * 0.3528 * 1.35;

function wrap(doc: jsPDF, text: string, width: number, size: number): string[] {
  doc.setFontSize(size);
  return doc.splitTextToSize(pdfText(text), width) as string[];
}

/** Wrap and draw text; returns the y below it. */
function paragraph(doc: jsPDF, text: string, x: number, y: number, width: number, size: number): number {
  const lines = wrap(doc, text, width, size);
  doc.text(lines, x, y);
  return y + lines.length * lineH(size);
}

function kicker(doc: jsPDF, text: string, x: number, y: number, color: RGB = COLORS.accentInk, size = 7.5) {
  setText(doc, size, color, "bold");
  doc.setCharSpace(0.5);
  doc.text(pdfText(text.toUpperCase()), x, y);
  doc.setCharSpace(0);
}

function heading(doc: jsPDF, label: string, title: string, y: number): number {
  kicker(doc, label, MARGIN, y);
  setText(doc, 17, COLORS.ink, "bold");
  doc.text(pdfText(title), MARGIN, y + 8);
  return y + 15;
}

function card(doc: jsPDF, x: number, y: number, w: number, h: number, fill: RGB = COLORS.card) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...COLORS.cardLine);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
}

function checkbox(doc: jsPDF, x: number, y: number, size = 3.2) {
  doc.setDrawColor(...COLORS.muted);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y - size + 0.4, size, size, 0.5, 0.5, "S");
}

function paperPage(doc: jsPDF) {
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

/** Flowing page cursor: adds a page when the next block won't fit. */
class Cursor {
  y = BODY_TOP;
  constructor(private doc: jsPDF) {}
  newPage() {
    this.doc.addPage("letter", "portrait");
    paperPage(this.doc);
    this.y = BODY_TOP;
  }
  ensure(height: number) {
    if (this.y + height > BODY_BOTTOM) this.newPage();
  }
}

function image(doc: jsPDF, dataUrl: string | undefined, x: number, y: number, w: number, h: number) {
  if (dataUrl) {
    try {
      doc.addImage(dataUrl, "JPEG", x, y, w, h);
      return;
    } catch {
      // fall through to the placeholder
    }
  }
  doc.setFillColor(...COLORS.panel);
  doc.rect(x, y, w, h, "F");
}

/** A yellow letter badge for a part; returns its width. */
function letterBadge(doc: jsPDF, letter: string, x: number, y: number): number {
  setText(doc, 8.5, COLORS.ink, "bold");
  const w = Math.max(6, doc.getTextWidth(letter) + 3.4);
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(x, y - 3.6, w, 5, 1, 1, "F");
  doc.text(letter, x + w / 2, y, { align: "center" });
  return w;
}

// ── Cover ────────────────────────────────────────────────────────────────

function renderCover(doc: jsPDF, input: CustomPlanPDFInput) {
  const { plan } = input;
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, 3, PAGE_H, "F");

  // Wordmark (549 × 219 source); text if it didn't load
  const logoH = 17;
  let logoPlaced = false;
  if (input.logoDataUrl) {
    try {
      doc.addImage(input.logoDataUrl, "PNG", MARGIN - 1, 12, (logoH * 549) / 219, logoH);
      logoPlaced = true;
    } catch {
      // fall through to the text mark
    }
  }
  if (!logoPlaced) kicker(doc, "Storage Network", MARGIN, 22, COLORS.accent, 11);

  kicker(doc, "Custom build plan", MARGIN, 48, COLORS.accent, 9);
  setText(doc, 30, COLORS.white, "bold");
  const title = wrap(doc, plan.name, CONTENT_W, 30).slice(0, 2);
  doc.text(title, MARGIN, 61);
  let y = 61 + title.length * 12;
  setText(doc, 11, COLORS.coverMuted);
  doc.text(pdfText(plan.summary), MARGIN, y);
  y += 10;

  // The build, on a white card
  const shotW = CONTENT_W;
  const shotH = shotW * SHOT_RATIO;
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(MARGIN, y, shotW, shotH, 3, 3, "F");
  image(doc, input.snapshots.overview, MARGIN + 1.5, y + 1.5, shotW - 3, shotH - 3);
  y += shotH + 12;

  // Finished size
  const cells: [string, string][] = [
    ["Width", plan.dimensions.width],
    ["Height", plan.dimensions.height],
    ["Depth", plan.dimensions.depth],
  ];
  const cellW = CONTENT_W / 3;
  cells.forEach(([label, value], i) => {
    const x = MARGIN + i * cellW;
    kicker(doc, label, x, y, COLORS.coverMuted, 7.5);
    setText(doc, 20, COLORS.accent, "bold");
    doc.text(pdfText(value), x, y + 9);
  });

  setText(doc, 8.5, COLORS.coverMuted);
  doc.text("Shopping list  ·  Cut list  ·  Step-by-step build  ·  storage-network.app", MARGIN, PAGE_H - 14);
}

// ── 01 Shopping ──────────────────────────────────────────────────────────

function renderShopping(doc: jsPDF, cur: Cursor, plan: CustomPlan) {
  cur.y = heading(doc, "01 · Before you start", "Shopping List", cur.y);
  for (const item of plan.shoppingList) {
    const detail = wrap(doc, item.detail, CONTENT_W - 44, 8.5);
    const h = 9 + detail.length * lineH(8.5);
    cur.ensure(h + 2);
    card(doc, MARGIN, cur.y, CONTENT_W, h);
    checkbox(doc, MARGIN + 4, cur.y + 7.2);
    setText(doc, 11, COLORS.accentInk, "bold");
    doc.text(pdfText(String(item.qty)), MARGIN + 11, cur.y + 7);
    setText(doc, 10.5, COLORS.ink, "bold");
    doc.text(pdfText(item.name), MARGIN + 30, cur.y + 7);
    setText(doc, 8.5, COLORS.muted);
    doc.text(detail, MARGIN + 30, cur.y + 11.6);
    cur.y += h + 2;
  }
}

// ── 02 Tools & safety ────────────────────────────────────────────────────

function renderTools(doc: jsPDF, cur: Cursor, plan: CustomPlan) {
  cur.y = heading(doc, "02 · Before you start", "Tools & Safety", cur.y);
  const colW = CONTENT_W / 2;
  const rows = Math.ceil(plan.tools.length / 2);
  card(doc, MARGIN, cur.y, CONTENT_W, rows * 7 + 5);
  plan.tools.forEach((tool, i) => {
    const x = MARGIN + 4 + (i % 2) * colW;
    const y = cur.y + 7.5 + Math.floor(i / 2) * 7;
    checkbox(doc, x, y);
    setText(doc, 10, COLORS.ink);
    doc.text(pdfText(tool), x + 6, y);
  });
  cur.y += rows * 7 + 12;

  kicker(doc, "Safety", MARGIN, cur.y);
  cur.y += 6;
  bullets(doc, cur, plan.safetyNotes);
}

function bullets(doc: jsPDF, cur: Cursor, items: string[], color: RGB = COLORS.body) {
  for (const item of items) {
    const lines = wrap(doc, item, CONTENT_W - 6, 9.5);
    cur.ensure(lines.length * lineH(9.5) + 2);
    doc.setFillColor(...COLORS.accent);
    doc.circle(MARGIN + 1.2, cur.y - 1.1, 0.9, "F");
    setText(doc, 9.5, color);
    doc.text(lines, MARGIN + 5, cur.y);
    cur.y += lines.length * lineH(9.5) + 1.8;
  }
}

// ── 03 Parts ─────────────────────────────────────────────────────────────

function renderParts(doc: jsPDF, cur: Cursor, plan: CustomPlan) {
  cur.y = heading(doc, "03 · What you'll cut", "Parts", cur.y);
  setText(doc, 9.5, COLORS.body);
  cur.y = paragraph(doc, "Every part has a letter. Write it on the part as it comes off the saw; the cut list and the build steps use the same letters.", MARGIN, cur.y, CONTENT_W, 9.5) + 3;

  const cols = [MARGIN + 4, MARGIN + 18, MARGIN + 88, MARGIN + 140];
  kicker(doc, "Part", cols[0], cur.y, COLORS.muted, 7);
  kicker(doc, "Made from", cols[1], cur.y, COLORS.muted, 7);
  kicker(doc, "Cut to", cols[2], cur.y, COLORS.muted, 7);
  kicker(doc, "How many", cols[3], cur.y, COLORS.muted, 7);
  cur.y += 3;
  for (const part of plan.parts.filter((p) => p.letter)) {
    cur.ensure(10);
    card(doc, MARGIN, cur.y, CONTENT_W, 8.5);
    letterBadge(doc, part.letter, cols[0], cur.y + 5.8);
    setText(doc, 10, COLORS.ink);
    doc.text(pdfText(part.label + (part.ripped ? `, ripped to ${formatInches(part.width)}` : "")), cols[1], cur.y + 5.8);
    setText(doc, 10, COLORS.ink, "bold");
    doc.text(pdfText(part.size), cols[2], cur.y + 5.8);
    doc.text(String(part.qty), cols[3], cur.y + 5.8);
    cur.y += 10;
  }
}

// ── 04 Cut list ──────────────────────────────────────────────────────────

/** Diagonal hatching for waste. */
function hatch(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...COLORS.waste);
  doc.rect(x, y, w, h, "F");
  doc.setDrawColor(...COLORS.cardLine);
  doc.setLineWidth(0.2);
  for (let d = 2; d < w + h; d += 2.5) {
    const x1 = x + Math.min(d, w);
    const y1 = y + Math.max(0, d - w);
    const x2 = x + Math.max(0, d - h);
    const y2 = y + Math.min(d, h);
    doc.line(x1, y1, x2, y2);
  }
}

function renderBoard(doc: jsPDF, cur: Cursor, board: PlanBoard) {
  const stock = getStock(board.stock);
  const fullWidth = stock?.width ?? 3.5;
  const laneH = 9;
  const barH = Math.max(laneH, board.lanes.length * laneH + (board.spareWidth > 0 ? 3 : 0));
  cur.ensure(barH + 12);

  setText(doc, 9.5, COLORS.ink, "bold");
  doc.text(pdfText(`${board.count} × 2×4 × ${board.length / 12} ft`), MARGIN, cur.y);
  const ripped = board.lanes.some((l) => l.width < fullWidth - 1e-6);
  if (ripped) {
    setText(doc, 8.5, COLORS.muted);
    doc.text(pdfText(`rip first: ${board.lanes.map((l) => formatInches(l.width)).join(" + ")}`), MARGIN + 42, cur.y);
  }
  cur.y += 2.5;

  const scale = CONTENT_W / board.length;
  board.lanes.forEach((lane, li) => {
    const y = cur.y + li * laneH;
    let x = MARGIN;
    for (const cut of lane.cuts) {
      const w = cut.length * scale;
      doc.setFillColor(...(li % 2 === 0 ? COLORS.lumber : COLORS.lumberLight));
      doc.setDrawColor(...COLORS.lumberInk);
      doc.setLineWidth(0.25);
      doc.rect(x, y, w, laneH, "FD");
      const label = `${cut.letter}  ${formatInches(cut.length)}`;
      setText(doc, 7.5, COLORS.lumberInk, "bold");
      if (doc.getTextWidth(label) + 2 < w) doc.text(pdfText(label), x + w / 2, y + laneH / 2 + 1.1, { align: "center" });
      else if (doc.getTextWidth(cut.letter) + 1 < w) doc.text(cut.letter, x + w / 2, y + laneH / 2 + 1.1, { align: "center" });
      x += w + 0.125 * scale;
    }
    const end = MARGIN + CONTENT_W;
    if (end - x > 0.6) {
      hatch(doc, x, y, end - x, laneH);
      if (lane.offcut >= 6) {
        setText(doc, 7, COLORS.muted);
        const label = `${formatInches(lane.offcut)} left`;
        if (doc.getTextWidth(label) + 2 < end - x) doc.text(pdfText(label), x + (end - x) / 2, y + laneH / 2 + 1, { align: "center" });
      }
    }
  });
  if (board.spareWidth > 0) hatch(doc, MARGIN, cur.y + board.lanes.length * laneH, CONTENT_W, 3);
  cur.y += barH + 7;
}

function renderSheet(doc: jsPDF, cur: Cursor, sheet: PlanSheet, index: number, total: number) {
  const stock = getStock(sheet.stock);
  const long = stock?.stockLengths[0] ?? 96;
  const short = stock?.width ?? 48;
  const w = CONTENT_W;
  const h = (w * short) / long;
  cur.ensure(h + 12);
  setText(doc, 9.5, COLORS.ink, "bold");
  doc.text(pdfText(`${sheet.label}, 4 × 8 sheet${total > 1 ? ` (${index + 1} of ${total})` : ""}`), MARGIN, cur.y);
  setText(doc, 8.5, COLORS.muted);
  doc.text(`${Math.round(sheet.used * 100)}% used`, MARGIN + CONTENT_W, cur.y, { align: "right" });
  cur.y += 2.5;

  hatch(doc, MARGIN, cur.y, w, h);
  const scale = w / long;
  for (const p of sheet.placements) {
    const x = MARGIN + p.x * scale;
    const y = cur.y + p.y * scale;
    doc.setFillColor(...COLORS.lumberLight);
    doc.setDrawColor(...COLORS.lumberInk);
    doc.setLineWidth(0.3);
    doc.rect(x, y, p.w * scale, p.h * scale, "FD");
    setText(doc, 11, COLORS.lumberInk, "bold");
    if (p.h * scale > 9 && p.w * scale > 12) {
      doc.text(p.letter, x + (p.w * scale) / 2, y + (p.h * scale) / 2, { align: "center" });
      setText(doc, 7.5, COLORS.lumberInk);
      doc.text(pdfText(`${formatInches(p.w)} × ${formatInches(p.h)}`), x + (p.w * scale) / 2, y + (p.h * scale) / 2 + 4, { align: "center" });
    } else if (p.h * scale > 4 && p.w * scale > 4) {
      setText(doc, 8, COLORS.lumberInk, "bold");
      doc.text(p.letter, x + (p.w * scale) / 2, y + (p.h * scale) / 2 + 1, { align: "center" });
    }
  }
  doc.setDrawColor(...COLORS.lumberInk);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, cur.y, w, h, "S");
  cur.y += h + 8;
}

function renderCutList(doc: jsPDF, cur: Cursor, plan: CustomPlan) {
  cur.y = heading(doc, "04 · At the saw", "Cut List", cur.y);
  setText(doc, 9.5, COLORS.body);
  cur.y = paragraph(doc, "Each bar is one board, drawn to scale, with its cuts in order from one end. Hatching is waste. The layout allows 1/8\" for every saw cut.", MARGIN, cur.y, CONTENT_W, 9.5) + 4;
  if (plan.boards.length === 0 && plan.sheets.length === 0) {
    setText(doc, 10, COLORS.muted, "italic");
    doc.text("Nothing to cut.", MARGIN, cur.y);
    cur.y += 8;
  }
  for (const board of plan.boards) renderBoard(doc, cur, board);
  plan.sheets.forEach((sheet, i) => {
    // "1 of 2" counts sheets of the same thickness
    const same = plan.sheets.filter((other) => other.stock === sheet.stock);
    renderSheet(doc, cur, sheet, plan.sheets.slice(0, i).filter((other) => other.stock === sheet.stock).length, same.length);
  });
}

// ── 05 Build ─────────────────────────────────────────────────────────────

/** Share of the page width a step's picture takes; its text runs beside it */
const STEP_SHOT_SHARE = 0.55;
const STEP_GAP = 5;

function renderStep(doc: jsPDF, cur: Cursor, step: PlanStep, total: number, shot: string | undefined) {
  const pictured = step.pieceIds.length > 0;
  const shotW = pictured ? CONTENT_W * STEP_SHOT_SHARE : 0;
  const shotH = shotW * SHOT_RATIO;
  const textX = pictured ? MARGIN + shotW + STEP_GAP : MARGIN;
  const textW = pictured ? CONTENT_W - shotW - STEP_GAP : CONTENT_W;
  const body = wrap(doc, step.instruction, textW, 9.5);
  const listRows = step.parts.length + step.fasteners.length;
  const textH = body.length * lineH(9.5) + 3 + listRows * 5;
  const tools = step.tools.length > 0 ? wrap(doc, `Tools: ${step.tools.join(", ")}`, CONTENT_W, 8.5) : [];
  const tip = step.tip ? wrap(doc, step.tip, CONTENT_W - 8, 9) : [];
  const blockH = Math.max(pictured ? shotH + 3 : 0, textH);
  const needed = 12 + blockH + 3 + tools.length * lineH(8.5) + (tip.length ? tip.length * lineH(9) + 7 : 0) + 8;
  // A step never splits across pages
  cur.ensure(needed);

  // Number badge + title
  doc.setFillColor(...COLORS.accent);
  doc.circle(MARGIN + 4.5, cur.y + 2, 4.5, "F");
  setText(doc, 11, COLORS.ink, "bold");
  doc.text(String(step.number), MARGIN + 4.5, cur.y + 3.4, { align: "center" });
  kicker(doc, `Step ${step.number} of ${total}`, MARGIN + 12, cur.y, COLORS.accentInk, 7);
  setText(doc, 13.5, COLORS.ink, "bold");
  doc.text(pdfText(step.title), MARGIN + 12, cur.y + 6);
  cur.y += 12;

  if (pictured) {
    card(doc, MARGIN, cur.y, shotW, shotH + 3);
    image(doc, shot, MARGIN + 1.5, cur.y + 1.5, shotW - 3, shotH);
  }

  let y = cur.y + 4;
  setText(doc, 9.5, COLORS.body);
  doc.text(body, textX, y);
  y += body.length * lineH(9.5) + 3;
  for (const part of step.parts) {
    setText(doc, 9.5, COLORS.accentInk, "bold");
    doc.text(`${part.qty} ×`, textX, y);
    setText(doc, 9.5, COLORS.ink);
    doc.text(pdfText(`${part.label}${part.size ? `  ·  ${part.size}` : ""}`), textX + 10, y);
    y += 5;
  }
  for (const f of step.fasteners) {
    setText(doc, 9.5, COLORS.fastenerInk, "bold");
    doc.text(`${f.qty} ×`, textX, y);
    doc.text(pdfText(f.name), textX + 10, y);
    y += 5;
  }
  cur.y += blockH + 6;

  if (tools.length > 0) {
    setText(doc, 8.5, COLORS.muted);
    doc.text(tools, MARGIN, cur.y);
    cur.y += tools.length * lineH(8.5) + 1;
  }
  if (tip.length) {
    const h = tip.length * lineH(9) + 5;
    doc.setFillColor(...COLORS.tipBg);
    doc.roundedRect(MARGIN, cur.y, CONTENT_W, h, 1.5, 1.5, "F");
    setText(doc, 9, COLORS.accentInk, "italic");
    doc.text(tip, MARGIN + 4, cur.y + 5);
    cur.y += h;
  }
  cur.y += 9;
}

// ── 06 Notes ─────────────────────────────────────────────────────────────

function renderNotes(doc: jsPDF, cur: Cursor, plan: CustomPlan) {
  cur.y = heading(doc, "06 · Good to know", "Notes", cur.y);
  if (plan.warnings.length > 0) {
    const lines = plan.warnings.flatMap((w) => wrap(doc, `! ${w}`, CONTENT_W - 8, 9.5));
    const h = lines.length * lineH(9.5) + 12;
    cur.ensure(h + 4);
    doc.setFillColor(...COLORS.warnBg);
    doc.roundedRect(MARGIN, cur.y, CONTENT_W, h, 2, 2, "F");
    kicker(doc, "Check before you build", MARGIN + 4, cur.y + 6, COLORS.fastenerInk);
    setText(doc, 9.5, COLORS.ink);
    doc.text(lines, MARGIN + 4, cur.y + 11.5);
    cur.y += h + 6;
  }
  bullets(doc, cur, plan.notes);

  if (plan.offcuts.length > 0) {
    cur.y += 4;
    cur.ensure(16);
    kicker(doc, "Leftovers worth keeping", MARGIN, cur.y);
    cur.y += 6;
    bullets(doc, cur, plan.offcuts.map((o) => `${o.qty} × ${o.description}`));
  }
}

// ── Running header and footer ────────────────────────────────────────────

function stampPages(doc: jsPDF, plan: CustomPlan, licensedTo?: string) {
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    kicker(doc, "Storage Network", MARGIN, 12, COLORS.accentInk, 7);
    setText(doc, 7.5, COLORS.muted);
    doc.text(pdfText(`${plan.name} — Custom Build Plan`), PAGE_W - MARGIN, 12, { align: "right" });
    doc.setDrawColor(...COLORS.cardLine);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, 14.5, PAGE_W - MARGIN, 14.5);
    setText(doc, 7.5, COLORS.muted);
    doc.text(pdfText(licensedTo ?? plan.name), MARGIN, PAGE_H - 9);
    doc.text(`Page ${p} of ${total}`, PAGE_W - MARGIN, PAGE_H - 9, { align: "right" });
  }
}

// ── Entry points ─────────────────────────────────────────────────────────

export function generateCustomPlanPDF(input: CustomPlanPDFInput): jsPDF {
  const { plan } = input;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  doc.setProperties({
    title: `${pdfText(plan.name)} — Custom Build Plan`,
    author: "Storage Network",
    subject: `Custom storage build plan: ${pdfText(plan.summary)}`,
  });

  renderCover(doc, input);
  const cur = new Cursor(doc);

  cur.newPage();
  renderShopping(doc, cur, plan);
  // Tools and parts follow on the same page when there's room for them
  cur.y += 8;
  cur.ensure(30 + Math.ceil(plan.tools.length / 2) * 7 + plan.safetyNotes.length * 6);
  renderTools(doc, cur, plan);
  cur.y += 8;
  cur.ensure(40 + plan.parts.length * 10);
  renderParts(doc, cur, plan);
  cur.newPage();
  renderCutList(doc, cur, plan);

  cur.newPage();
  cur.y = heading(doc, "05 · In the garage", "Build It", cur.y);
  setText(doc, 9.5, COLORS.body);
  cur.y =
    paragraph(doc, `${plan.steps.length} steps, from the floor up. In each picture the yellow outline marks what the step adds; everything already built is shown in place. Finished size: ${plan.dimensions.width} wide, ${plan.dimensions.height} tall, ${plan.dimensions.depth} deep.`, MARGIN, cur.y, CONTENT_W, 9.5) + 6;
  for (const step of plan.steps) renderStep(doc, cur, step, plan.steps.length, input.snapshots[step.id]);

  cur.y += 4;
  cur.ensure(70);
  renderNotes(doc, cur, plan);

  stampPages(doc, plan, input.licensedTo);
  return doc;
}

export function downloadCustomPlanPDF(input: CustomPlanPDFInput): void {
  const slug = input.plan.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Custom-Build";
  generateCustomPlanPDF(input).save(`Build-Plan-${slug}.pdf`);
}
