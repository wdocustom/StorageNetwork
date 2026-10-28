// ═══════════════════════════════════════════════════════════════════════════
// DIY PDF GENERATOR — Printable tote organizer build plan
//
// Built from the same sources as the interactive 3D Assembly Guide:
//   • CompleteDIYPlan (generate-plan.ts) — build-engine shopping list and
//     board packing, guide steps per module type, unit assembly steps
//   • AssemblyStepSnapshots — one 3D render per step of every module type
//
// Layout (US Letter, portrait):
//   1. Cover — brand band (wordmark, "Designed for <name>"), finished unit render
//      (or system map), at-a-glance numbers, Storage Network footer
//   2. Before you start — tools + shopping checklists, safety, notes
//   3. Your system — elevation map, module types, build order (multi-module)
//   4. Cut plan — parts per module type, identical boards grouped, plywood
//   5. Per module type — overview page, then one page per step: render,
//      instructions, parts, tools, fastener callout, pro tip, checkbox
//   6. Per unit — joining / stacking / worktop / anchoring steps
//   7. Back page — link to the interactive 3D guide (upgrade for PDF buyers)
//
// Sections flow onto extra pages instead of being clipped, and every page
// after the cover carries a running header and "Page X of Y" footer.
// ═══════════════════════════════════════════════════════════════════════════

import jsPDF from "jspdf";
import type {
  CompleteDIYPlan,
  PlanAssemblyStep,
  PlanCutBoard,
  PlanModuleTypeBuild,
  PlanUnit,
} from "@/app/actions/generate-plan";
import { AFFILIATE_DISCLOSURE } from "@/lib/plan-product-links";
import { LADDER_JIG_OWNER_PRICE } from "@/lib/ladder-jig";
import {
  TOTE_PLAN_UPGRADE_PRICE,
  designLayout,
  formatPlanPrice,
  moduleTypeTitle,
  planSnapshotKey,
  type DesignLayout,
  type LayoutModule,
} from "@/lib/tote-plans";

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
  accentSoft: [254, 240, 138] as RGB, // yellow-200
  accentInk: [161, 98, 7] as RGB, // yellow-700
  tipBg: [254, 249, 195] as RGB, // yellow-100
  fastenerBg: [255, 237, 213] as RGB, // orange-100
  fastenerInk: [194, 65, 12] as RGB, // orange-700
  lumber: [217, 180, 130] as RGB,
  lumberInk: [92, 64, 30] as RGB,
  waste: [226, 232, 240] as RGB,
  link: [29, 78, 216] as RGB, // blue-700
};

// ── Input ──────────────────────────────────────────────────────────────

export interface DIYPDFInput {
  plan: CompleteDIYPlan;
  /** Step renders keyed by planSnapshotKey(typeLetter, stepId) */
  snapshots: Record<string, string>;
  /** Shown on the cover, e.g. "Licensed to jo@example.com" */
  licensedTo?: string;
  /** Buyer's first name — the cover reads "Designed for Skyler" (else "for you") */
  designedFor?: string;
  /** Storage Network wordmark as a PNG data URL (the browser loads it; tests omit it) */
  logoDataUrl?: string;
  /**
   * Back-page call to action. upgradeUrl → PDF buyer, offer the 3D guide;
   * guideUrl → they already own it, link straight to it.
   */
  links?: {
    upgradeUrl?: string;
    guideUrl?: string;
    /** The buyer's My Builds library */
    libraryUrl?: string;
    /** Ladder jig: the $5 owner offer, or their own jig plans when jigOwned */
    jigUrl?: string;
    jigOwned?: boolean;
  };
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
// System map — front elevation, drawn to scale
// ═══════════════════════════════════════════════════════════════════════════

function drawSystemMap(
  doc: jsPDF,
  layout: DesignLayout,
  box: { x: number; y: number; w: number; h: number },
  options: { highlight?: (m: LayoutModule) => boolean; dimensions?: boolean } = {},
) {
  const dimSpace = options.dimensions ? 9 : 2;
  const scale = Math.min(box.w / layout.widthIn, (box.h - dimSpace) / layout.heightIn);
  const drawW = layout.widthIn * scale;
  const ox = box.x + (box.w - drawW) / 2;
  const floorY = box.y + box.h - dimSpace;
  const toX = (inches: number) => ox + inches * scale;
  const toY = (inches: number) => floorY - inches * scale;

  // Floor
  doc.setDrawColor(...COLORS.faint);
  doc.setLineWidth(0.4);
  doc.line(box.x, floorY, box.x + box.w, floorY);

  // Casters, under the uprights they're fastened to
  const casterR = Math.max(0.6, 1.4 * scale);
  doc.setFillColor(...COLORS.body);
  for (const unit of layout.units) {
    for (const cx of unit.casters) doc.circle(toX(cx), floorY - casterR, casterR, "F");
  }

  for (const m of layout.modules) {
    const lit = options.highlight?.(m) ?? false;
    const x = toX(m.x);
    const y = toY(m.y + m.h);
    const w = m.w * scale;
    const h = m.h * scale;
    doc.setFillColor(...(lit ? COLORS.accentSoft : COLORS.panel));
    doc.setDrawColor(...(lit ? COLORS.accentInk : COLORS.muted));
    doc.setLineWidth(lit ? 0.6 : 0.3);
    doc.rect(x, y, w, h, "FD");

    // Tote openings
    const cellW = w / m.cols;
    const cellH = h / m.rows;
    doc.setDrawColor(...COLORS.faint);
    doc.setLineWidth(0.15);
    for (let c = 1; c < m.cols; c++) doc.line(x + c * cellW, y + 0.6, x + c * cellW, y + h - 0.6);
    for (let r = 1; r < m.rows; r++) doc.line(x + 0.6, y + r * cellH, x + w - 0.6, y + r * cellH);

    // Name: A, B… or A1, A2… (mm → pt is ×2.83; a glyph is ~0.6 em wide)
    const size = Math.max(6, Math.min(22, h * 0.9, (w * 0.8 * 2.83) / (m.name.length * 0.62)));
    setText(doc, size, lit ? COLORS.accentInk : COLORS.ink, "bold");
    doc.text(m.name, x + w / 2, y + h / 2 + size * 0.12, { align: "center" });
  }

  for (const unit of layout.units) {
    if (unit.hasTop) {
      doc.setFillColor(...COLORS.lumber);
      doc.rect(toX(unit.x) - 0.3, toY(unit.h) - 1.1, unit.w * scale + 0.6, 1.1, "F");
    }
    if (options.dimensions) {
      setText(doc, 7, COLORS.muted);
      doc.text(formatInches(unit.w), toX(unit.x + unit.w / 2), floorY + 4.5, { align: "center" });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Cover
// ═══════════════════════════════════════════════════════════════════════════

function renderCover(doc: jsPDF, input: DIYPDFInput, layout: DesignLayout) {
  const { plan } = input;

  // ── Brand band ──────────────────────────────────────────────────────
  const bandH = 98;
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, PAGE_W, bandH, "F");
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, bandH, PAGE_W, 1.6, "F");

  // Yellow-and-white ® wordmark (549×219 source) top-left; text if it didn't load.
  const logoH = 22;
  const logoW = (logoH * 549) / 219;
  let logoPlaced = false;
  if (input.logoDataUrl) {
    try {
      doc.addImage(input.logoDataUrl, "PNG", MARGIN - 1, 10, logoW, logoH);
      logoPlaced = true;
    } catch {
      // fall through to the text mark
    }
  }
  if (!logoPlaced) {
    setText(doc, 13, COLORS.accent, "bold");
    doc.text("STORAGE-NETWORK.APP", MARGIN, 24);
  }
  setText(doc, 8.5, COLORS.accent, "bold");
  doc.text("DIY BUILD PLAN", PAGE_W - MARGIN, 18, { align: "right" });
  setText(doc, 8, [148, 163, 184]);
  doc.text("storage-network.app", PAGE_W - MARGIN, 24, { align: "right" });

  // "Designed for Skyler"
  const name = input.designedFor?.trim();
  setText(doc, 10, COLORS.accent, "bold");
  doc.text("DESIGNED FOR", MARGIN, 50);
  setText(doc, name && name.length > 14 ? 30 : 38, COLORS.white, "bold");
  doc.text(pdfText(name || "You"), MARGIN, 64);

  setText(doc, plan.name.length > 34 ? 13 : 15, COLORS.white, "bold");
  doc.text(pdfText(plan.name), MARGIN, 77);
  setText(doc, 9.5, [203, 213, 225]);
  paragraph(doc, plan.summary.replace(/ · /g, "  ·  "), MARGIN, 84, CONTENT_W, 9.5);
  if (input.licensedTo) {
    setText(doc, 7.5, [148, 163, 184]);
    doc.text(pdfText(input.licensedTo), MARGIN, 94);
  }

  // ── Hero — the finished module when the design is one module; otherwise
  // the whole system drawn to scale.
  const heroY = bandH + 7;
  const heroH = CONTENT_W * 0.56;
  if (plan.moduleCount === 1) {
    const t = plan.moduleTypes[0];
    const last = t.steps[t.steps.length - 1];
    addImageSafe(doc, input.snapshots[planSnapshotKey(t.letter, last.id)], MARGIN, heroY, CONTENT_W, heroH, "Finished unit");
  } else {
    doc.setFillColor(250, 250, 250);
    doc.rect(MARGIN, heroY, CONTENT_W, heroH, "F");
    drawSystemMap(doc, layout, { x: MARGIN + 8, y: heroY + 10, w: CONTENT_W - 16, h: heroH - 16 }, { dimensions: true });
    setText(doc, 8, COLORS.muted, "bold");
    doc.text("FRONT VIEW — units A, B, C…; modules A1, A2…", MARGIN + 4, heroY + 6);
  }

  // ── At a glance
  const d = plan.dimensions;
  const stats: [string, string][] = [
    ["Width", d.totalWidth],
    ["Height", d.totalHeight],
    ["Depth", d.depth],
    ["Totes", String(plan.toteCount)],
    ["2×4×8' boards", String(plan.totals.boards)],
    plan.moduleCount > 1 ? ["Modules to build", String(plan.moduleCount)] : ["2×4 rails", String(plan.railBoards.rails)],
  ];
  const statY = heroY + heroH + 6;
  const cellW = CONTENT_W / 3;
  const cellH = 15;
  stats.forEach(([label, value], i) => {
    const cx = MARGIN + (i % 3) * cellW;
    const cy = statY + Math.floor(i / 3) * (cellH + 3);
    doc.setFillColor(...COLORS.panel);
    doc.roundedRect(cx + 1, cy, cellW - 2, cellH, 2, 2, "F");
    setText(doc, 7, COLORS.muted, "bold");
    doc.text(pdfText(label.toUpperCase()), cx + 5, cy + 5.5);
    setText(doc, 13, COLORS.ink, "bold");
    doc.text(pdfText(value), cx + 5, cy + 12);
  });

  setText(doc, 8, COLORS.muted);
  paragraph(
    doc,
    "Read the whole plan once before you buy materials. Cut every piece first, then assemble in order — each step builds on the last.",
    MARGIN,
    statY + 2 * cellH + 3 + 7,
    CONTENT_W,
    8,
  );

  // ── Brand footer
  const footH = 15;
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, PAGE_H - footH, PAGE_W, footH, "F");
  setText(doc, 9, COLORS.accent, "bold");
  doc.text("STORAGE-NETWORK.APP", MARGIN, PAGE_H - footH + 9.5);
  setText(doc, 8, [203, 213, 225]);
  doc.text("Rather have it built for you? Book a local pro at storage-network.app", PAGE_W - MARGIN, PAGE_H - footH + 9.5, {
    align: "right",
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Before you start — tools, shopping list, safety, notes
// ═══════════════════════════════════════════════════════════════════════════

/** Small green "ladder jig" box; returns nothing when there's no link. */
function jigCallout(doc: jsPDF, cur: Cursor, links: DIYPDFInput["links"]) {
  if (!links?.jigUrl) return;
  const h = 15;
  cur.ensure(h + 2);
  const top = cur.y;
  doc.setFillColor(220, 252, 231); // green-100
  doc.roundedRect(MARGIN, top, CONTENT_W, h, 2, 2, "F");
  setText(doc, 7.5, [21, 128, 61], "bold"); // green-700
  doc.text("LADDER JIG", MARGIN + 4, top + 5.5);
  setText(doc, 9.5, COLORS.ink, "bold");
  doc.text(
    links.jigOwned ? "You have the ladder jig plans — build it before your ladder frames." : "Build a ladder jig first — every ladder frame square and identical.",
    MARGIN + 26,
    top + 5.5,
  );
  setText(doc, 8.5, COLORS.link, "bold");
  const label = links.jigOwned ? "Open my jig plans" : `Get the jig plans — ${formatPlanPrice(LADDER_JIG_OWNER_PRICE)} for plan owners`;
  doc.textWithLink(label, MARGIN + 26, top + 11, { url: links.jigUrl });
  cur.y = top + h + 4;
}

function renderBeforeYouStart(doc: jsPDF, cur: Cursor, plan: CompleteDIYPlan, links: DIYPDFInput["links"]) {
  cur.y = sectionTitle(doc, "Before You Start", cur.y);

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

  cur.ensure(20);
  setText(doc, 10, COLORS.ink, "bold");
  doc.text("Shopping List", MARGIN, cur.y);
  cur.y += 5.5;
  const hasLinks = plan.shoppingList.some((i) => i.url);
  for (const item of plan.shoppingList) {
    cur.ensure(7);
    checkbox(doc, MARGIN, cur.y);
    setText(doc, 9, COLORS.ink, "bold");
    doc.text(pdfText(String(item.qty)), MARGIN + 6, cur.y);
    doc.text(pdfText(item.name), MARGIN + 24, cur.y);
    setText(doc, 8.5, COLORS.muted);
    const detailW = hasLinks ? CONTENT_W - 82 - 26 : CONTENT_W - 82;
    const detail = (doc.splitTextToSize(pdfText(item.detail), detailW) as string[])[0];
    doc.text(detail, MARGIN + 82, cur.y);
    if (item.url) {
      setText(doc, 8.5, COLORS.link, "bold");
      const label = `Buy ${item.store === "Amazon" ? "on" : "at"} ${item.store}`;
      doc.textWithLink(label, MARGIN + CONTENT_W - doc.getTextWidth(label), cur.y, { url: item.url });
    }
    doc.setDrawColor(...COLORS.panel);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, cur.y + 2.2, MARGIN + CONTENT_W, cur.y + 2.2);
    cur.y += 6.5;
  }
  if (hasLinks) {
    setText(doc, 7, COLORS.muted, "italic");
    cur.y = paragraph(doc, AFFILIATE_DISCLOSURE, MARGIN, cur.y + 1, CONTENT_W, 7);
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
  jigCallout(doc, cur, links);
}

// ═══════════════════════════════════════════════════════════════════════════
// Your system (multi-module designs)
// ═══════════════════════════════════════════════════════════════════════════

function renderSystemOverview(doc: jsPDF, cur: Cursor, plan: CompleteDIYPlan, layout: DesignLayout) {
  cur.newPage();
  cur.y = sectionTitle(doc, "Your System", cur.y);
  setText(doc, 9, COLORS.body);
  cur.y = paragraph(
    doc,
    "Your build is made of self-contained modules — each one a complete frame. Units are lettered A, B, C…; a unit made of several modules numbers them A1, A2… Identical modules are grouped below: build one, then repeat it. Then join them into units in the order below.",
    MARGIN,
    cur.y,
    CONTENT_W,
    9,
  ) + 3;

  const mapH = 86;
  doc.setFillColor(250, 250, 250);
  doc.rect(MARGIN, cur.y, CONTENT_W, mapH, "F");
  drawSystemMap(doc, layout, { x: MARGIN + 6, y: cur.y + 5, w: CONTENT_W - 12, h: mapH - 9 }, { dimensions: true });
  cur.y += mapH + 8;

  // Module types table
  setText(doc, 10, COLORS.ink, "bold");
  doc.text("Modules to Build", MARGIN, cur.y);
  cur.y += 6;
  const cols = [MARGIN, MARGIN + 30, MARGIN + 60, MARGIN + 100, MARGIN + 138];
  setText(doc, 7.5, COLORS.muted, "bold");
  ["MODULES", "SIZE", "OUTSIDE (W × H)", "INCLUDES", "BUILD"].forEach((h, i) => doc.text(h, cols[i], cur.y));
  cur.y += 5;
  for (const t of plan.moduleTypes) {
    cur.ensure(8);
    const label = t.label.length > 14 ? `${t.moduleNames[0]}…` : t.label;
    setText(doc, label.length > 7 ? 8 : 10, COLORS.accentInk, "bold");
    const chipW = Math.min(28, doc.getTextWidth(label) + 4);
    doc.setFillColor(...COLORS.accentSoft);
    doc.roundedRect(cols[0], cur.y - 4.2, chipW, 6, 1, 1, "F");
    doc.text(label, cols[0] + chipW / 2, cur.y, { align: "center" });
    setText(doc, 9, COLORS.ink, "bold");
    doc.text(`${t.cols} wide × ${t.rows} tall`, cols[1], cur.y);
    setText(doc, 9, COLORS.body);
    doc.text(pdfText(`${formatInches(t.widthIn)} × ${formatInches(t.frameHeightIn)}`), cols[2], cur.y);
    const extras = [t.hasWheels ? "casters" : "", t.hasTop ? "worktop" : ""].filter(Boolean).join(" + ") || "frame";
    doc.text(extras, cols[3], cur.y);
    setText(doc, 10, COLORS.ink, "bold");
    doc.text(`× ${t.count}`, cols[4], cur.y);
    cur.y += 7.5;
  }
  cur.y += 3;

  // Build order
  cur.ensure(20);
  setText(doc, 10, COLORS.ink, "bold");
  doc.text("Build Order", MARGIN, cur.y);
  cur.y += 6;
  const order = [
    "Cut every part on the cut plan.",
    ...plan.moduleTypes.map((t) => `Build ${moduleTypeTitle(t)} (${t.cols}×${t.rows})${t.count > 1 ? ` — ${t.count} identical` : ""}.`),
    ...plan.units
      .filter((u) => u.assemblySteps.length > 0)
      .map((u) => `Assemble Unit ${u.letter} (${u.label}): ${u.assemblySteps.map((s) => s.title.toLowerCase()).join(", ")}.`),
  ];
  order.forEach((line, i) => {
    const h = measure(doc, line, CONTENT_W - 8, 9);
    cur.ensure(h + 1);
    setText(doc, 9, COLORS.ink, "bold");
    doc.text(`${i + 1}.`, MARGIN, cur.y);
    setText(doc, 9, COLORS.body);
    cur.y = paragraph(doc, line, MARGIN + 7, cur.y, CONTENT_W - 8, 9) + 1.5;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Cut plan
// ═══════════════════════════════════════════════════════════════════════════

export interface BoardGroup {
  count: number;
  board: PlanCutBoard;
}

/** Collapse boards with the same cuts into "×N" groups, keeping order. */
export function groupBoards(boards: PlanCutBoard[]): BoardGroup[] {
  const groups: BoardGroup[] = [];
  const key = (b: PlanCutBoard) => b.cuts.map((c) => `${c.label}:${c.length}`).join("|");
  for (const board of boards) {
    const existing = groups.find((g) => key(g.board) === key(board));
    if (existing) existing.count += 1;
    else groups.push({ count: 1, board });
  }
  return groups;
}

function renderCutPlan(doc: jsPDF, cur: Cursor, plan: CompleteDIYPlan) {
  cur.newPage();
  cur.y = sectionTitle(doc, "Cut Plan", cur.y);

  // Parts per module type
  setText(doc, 10, COLORS.ink, "bold");
  doc.text("Parts to Cut", MARGIN, cur.y);
  cur.y += 5.5;
  for (const t of plan.moduleTypes) {
    cur.ensure(8 + t.parts.length * 5.5);
    setText(doc, 8.5, COLORS.ink, "bold");
    doc.text(
      plan.moduleTypes.length > 1 || t.count > 1
        ? `${moduleTypeTitle(t)} (${t.cols}×${t.rows}) — for each of ${t.count} module${t.count > 1 ? "s" : ""}`
        : `${moduleTypeTitle(t)} (${t.cols}×${t.rows})`,
      MARGIN,
      cur.y,
    );
    cur.y += 5;
    for (const p of t.parts) {
      setText(doc, 9, COLORS.ink, "bold");
      doc.text(`${p.qty} ×`, MARGIN + 4, cur.y);
      setText(doc, 9, COLORS.body);
      doc.text(pdfText(p.name), MARGIN + 16, cur.y);
      doc.text(pdfText(p.length), MARGIN + 52, cur.y);
      setText(doc, 9, COLORS.muted);
      doc.text(pdfText(p.material), MARGIN + 120, cur.y);
      cur.y += 5;
    }
    cur.y += 3;
  }

  cur.ensure(30);
  setText(doc, 10, COLORS.ink, "bold");
  doc.text("2×4 Board Layout", MARGIN, cur.y);
  cur.y += 5;
  setText(doc, 9, COLORS.body);
  cur.y = paragraph(
    doc,
    `Uprights and plates: each bar is one 2×4×8' board (96"). Tan sections are your cuts, labeled with the modules they're for; gray is offcut. ${plan.cutBoards.length} boards, plus ${plan.railBoards.boards} more ripped into rails and back braces below. Stack identical parts to check they match.`,
    MARGIN,
    cur.y,
    CONTENT_W,
    9,
  ) + 4;

  const barH = 9;
  for (const group of groupBoards(plan.cutBoards)) {
    cur.ensure(barH + 10);
    const { board, count } = group;
    setText(doc, 8.5, COLORS.ink, "bold");
    doc.text(count > 1 ? `Cut ${count} boards like this` : "Cut 1 board like this", MARGIN, cur.y);
    cur.y += 2.5;

    doc.setFillColor(...COLORS.waste);
    doc.rect(MARGIN, cur.y, CONTENT_W, barH, "F");
    let x = MARGIN;
    for (const cut of board.cuts) {
      const w = (cut.length / 96) * CONTENT_W;
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
    const wasteW = (board.remainder / 96) * CONTENT_W;
    if (wasteW > 14) {
      setText(doc, 7, COLORS.muted);
      doc.text(pdfText(`${formatInches(board.remainder)} offcut`), x + wasteW / 2, cur.y + barH / 2 + 1.2, { align: "center" });
    }
    doc.setDrawColor(...COLORS.faint);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, cur.y, CONTENT_W, barH, "S");
    cur.y += barH + 6;
  }

  // Rail boards — one 2×4 ripped in half, three 30" rails per half
  cur.ensure(36);
  cur.y += 2;
  setText(doc, 10, COLORS.ink, "bold");
  doc.text("2×4 Rail Boards", MARGIN, cur.y);
  cur.y += 5;
  setText(doc, 8.5, COLORS.ink, "bold");
  doc.text(
    `Rip ${plan.railBoards.boards} board${plan.railBoards.boards === 1 ? "" : "s"} like this — 6 pieces each: ${plan.railBoards.rails} rails + ${plan.railBoards.braces} back braces`,
    MARGIN,
    cur.y,
  );
  cur.y += 2.5;
  const halfH = 5.5;
  for (let half = 0; half < 2; half++) {
    const y = cur.y + half * (halfH + 0.8);
    doc.setFillColor(...COLORS.waste);
    doc.rect(MARGIN, y, CONTENT_W, halfH, "F");
    let x = MARGIN;
    for (let r = 0; r < 3; r++) {
      const w = (30 / 96) * CONTENT_W;
      doc.setFillColor(...COLORS.lumber);
      doc.rect(x, y, w, halfH, "F");
      doc.setDrawColor(...COLORS.white);
      doc.setLineWidth(0.6);
      doc.line(x + w, y, x + w, y + halfH);
      setText(doc, 7, COLORS.lumberInk, "bold");
      doc.text('Rail / brace 30"', x + w / 2, y + halfH / 2 + 1.1, { align: "center" });
      x += w;
    }
    doc.setDrawColor(...COLORS.faint);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, y, CONTENT_W, halfH, "S");
  }
  cur.y += halfH * 2 + 0.8 + 4;
  setText(doc, 7.5, COLORS.muted);
  doc.text('Rip down the middle (fence at 1-11/16"), then crosscut each half into 3 pieces at 30" — about 5-5/8" offcut per half.', MARGIN, cur.y);
  cur.y += 7;

  cur.ensure(20);
  setText(doc, 10, COLORS.ink, "bold");
  doc.text("Rails & Plywood", MARGIN, cur.y);
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

// ═══════════════════════════════════════════════════════════════════════════
// Module sections
// ═══════════════════════════════════════════════════════════════════════════

function renderModuleIntro(
  doc: jsPDF,
  cur: Cursor,
  t: PlanModuleTypeBuild,
  layout: DesignLayout,
  hero: string | undefined,
) {
  cur.newPage();
  setText(doc, 8, COLORS.accentInk, "bold");
  doc.text(pdfText(moduleTypeTitle(t).toUpperCase()), MARGIN, cur.y);
  setText(doc, 20, COLORS.ink, "bold");
  doc.text(`${t.cols} wide × ${t.rows} tall`, MARGIN, cur.y + 9);
  setText(doc, 10, COLORS.body);
  doc.text(
    pdfText(
      `Build ${t.count === 1 ? "1" : `${t.count} identical`} · ${formatInches(t.widthIn)} W × ${formatInches(t.frameHeightIn)} H × 30" D` +
        `${t.hasWheels ? " · on casters" : ""}${t.hasTop ? " · with worktop" : ""}`,
    ),
    MARGIN,
    cur.y + 16,
  );
  cur.y += 22;

  // Where it goes
  const mapH = 42;
  doc.setFillColor(250, 250, 250);
  doc.rect(MARGIN, cur.y, CONTENT_W, mapH, "F");
  setText(doc, 7, COLORS.muted, "bold");
  doc.text("WHERE IT GOES", MARGIN + 3, cur.y + 4.5);
  drawSystemMap(doc, layout, { x: MARGIN + 4, y: cur.y + 6, w: CONTENT_W - 8, h: mapH - 8 }, { highlight: (m) => m.type === t.letter });
  cur.y += mapH + 6;

  const imgH = CONTENT_W * 0.55;
  addImageSafe(doc, hero, MARGIN, cur.y, CONTENT_W, imgH, moduleTypeTitle(t));
  cur.y += imgH + 6;

  if (t.count > 1) {
    doc.setFillColor(...COLORS.tipBg);
    doc.roundedRect(MARGIN, cur.y, CONTENT_W, 10, 2, 2, "F");
    setText(doc, 9, COLORS.ink, "bold");
    doc.text(
      `You need ${t.count} of these. Quantities on the next pages are for ONE module — repeat the steps ${t.count} times.`,
      MARGIN + 4,
      cur.y + 6.3,
    );
  }
}

function renderStep(
  doc: jsPDF,
  cur: Cursor,
  step: PlanAssemblyStep,
  total: number,
  image: string | undefined,
  eyebrow: string,
  links?: DIYPDFInput["links"],
) {
  const jigLine = step.id === "build-ladders" && links?.jigUrl;
  cur.newPage();

  doc.setFillColor(...COLORS.ink);
  doc.circle(MARGIN + 6, cur.y - 1.5, 6, "F");
  setText(doc, 13, COLORS.accent, "bold");
  doc.text(String(step.stepNumber), MARGIN + 6, cur.y + 0.4, { align: "center" });
  setText(doc, 7.5, COLORS.muted, "bold");
  doc.text(pdfText(`${eyebrow}STEP ${step.stepNumber} OF ${total}`), MARGIN + 15, cur.y - 3.5);
  setText(doc, 16, COLORS.ink, "bold");
  doc.text(pdfText(step.title), MARGIN + 15, cur.y + 2.5);
  cur.y += 10;

  // Shrink the render (never below ~half size) so the whole step fits on its page
  const imgW = CONTENT_W;
  const room = BODY_BOTTOM - cur.y - 7 - stepBodyHeight(doc, step) - (jigLine ? 7 : 0);
  const imgH = Math.max(imgW * 0.34, Math.min(imgW * 0.62, room));
  addImageSafe(doc, image, MARGIN, cur.y, imgW, imgH, `Step ${step.stepNumber}`);
  doc.setDrawColor(...COLORS.faint);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, cur.y, imgW, imgH, "S");
  cur.y += imgH + 7;

  renderStepBody(doc, cur, step);
  if (jigLine) {
    setText(doc, 8.5, COLORS.link, "bold");
    doc.textWithLink(
      links!.jigOwned ? "Faster with your ladder jig — open the jig plans" : `Build these faster with a ladder jig — ${formatPlanPrice(LADDER_JIG_OWNER_PRICE)} for plan owners`,
      MARGIN,
      cur.y,
      { url: links!.jigUrl! },
    );
    cur.y += 6;
  }
}

const STEP_BOX_GAP = 6;
const STEP_BOX_LEFT = CONTENT_W * 0.58;

function stepLines(step: PlanAssemblyStep) {
  return {
    partLines: step.materials.map((m) => `${m.qty} × ${m.name}${m.detail ? ` — ${m.detail}` : ""}`),
    toolLines: step.tools.map((t) => (t.detail ? `${t.name} (${t.detail})` : t.name)),
  };
}

function stepBoxHeight(doc: jsPDF, step: PlanAssemblyStep): number {
  const { partLines, toolLines } = stepLines(step);
  if (!partLines.length && !toolLines.length) return 0;
  const rightW = CONTENT_W - STEP_BOX_LEFT - STEP_BOX_GAP;
  const colHeight = (lines: string[], w: number) => lines.reduce((h, l) => h + measure(doc, l, w - 6, 9) + 1, 0);
  return 10 + Math.max(colHeight(partLines, STEP_BOX_LEFT), colHeight(toolLines, rightW));
}

/** Height renderStepBody will use — keep in step with it. */
function stepBodyHeight(doc: jsPDF, step: PlanAssemblyStep): number {
  let h = measure(doc, step.instruction, CONTENT_W, 10.5) + 4;
  const box = stepBoxHeight(doc, step);
  if (box) h += box + 4;
  if (step.screwType) h += measure(doc, `${step.screwType.label} — ${step.screwType.description}`, CONTENT_W - 30, 9) + 5 + 3;
  if (step.proTip) h += measure(doc, step.proTip, CONTENT_W - 30, 9) + 5 + 3;
  return h + 10;
}

/** Instruction, parts/tools box, fastener, pro tip, checkbox. */
function renderStepBody(doc: jsPDF, cur: Cursor, step: PlanAssemblyStep) {
  setText(doc, 10.5, COLORS.ink);
  const instrH = measure(doc, step.instruction, CONTENT_W, 10.5);
  cur.ensure(instrH);
  setText(doc, 10.5, COLORS.ink);
  cur.y = paragraph(doc, step.instruction, MARGIN, cur.y, CONTENT_W, 10.5) + 4;

  const gap = STEP_BOX_GAP;
  const leftW = STEP_BOX_LEFT;
  const rightW = CONTENT_W - leftW - gap;
  const { partLines, toolLines } = stepLines(step);
  const boxH = stepBoxHeight(doc, step);

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

  cur.ensure(8);
  cur.y += 2;
  checkbox(doc, MARGIN, cur.y + 1, 4);
  setText(doc, 9, COLORS.muted, "bold");
  doc.text("Step complete", MARGIN + 6.5, cur.y + 0.6);
  cur.y += 8;
}

// ═══════════════════════════════════════════════════════════════════════════
// Unit assembly (joining, stacking, worktop, anchoring)
// ═══════════════════════════════════════════════════════════════════════════

function renderUnitAssembly(doc: jsPDF, cur: Cursor, unit: PlanUnit, layout: DesignLayout, unitCount: number) {
  cur.newPage();
  setText(doc, 8, COLORS.accentInk, "bold");
  doc.text(unitCount > 1 ? `UNIT ${unit.letter} · ${unit.index + 1} OF ${unitCount}` : "FINAL ASSEMBLY", MARGIN, cur.y);
  setText(doc, 20, COLORS.ink, "bold");
  doc.text(pdfText(`Assemble Unit ${unit.letter} (${unit.label})`), MARGIN, cur.y + 9);
  setText(doc, 10, COLORS.body);
  doc.text(
    pdfText(`Modules ${unit.modules.map((m) => m.name).join(" + ")} · ${formatInches(unit.widthIn)} W × ${formatInches(unit.heightIn)} H × 30" D`),
    MARGIN,
    cur.y + 16,
  );
  cur.y += 22;

  const mapH = 56;
  doc.setFillColor(250, 250, 250);
  doc.rect(MARGIN, cur.y, CONTENT_W, mapH, "F");
  drawSystemMap(doc, layout, { x: MARGIN + 4, y: cur.y + 4, w: CONTENT_W - 8, h: mapH - 6 }, {
    highlight: (m) => m.unitIndex === unit.index,
    dimensions: true,
  });
  cur.y += mapH + 8;

  for (const step of unit.assemblySteps) {
    // Keep each heading with at least its instruction
    cur.ensure(9 + measure(doc, step.instruction, CONTENT_W, 10.5) + 12);
    doc.setFillColor(...COLORS.ink);
    doc.circle(MARGIN + 5, cur.y - 1.3, 5, "F");
    setText(doc, 11, COLORS.accent, "bold");
    doc.text(String(step.stepNumber), MARGIN + 5, cur.y + 0.4, { align: "center" });
    setText(doc, 13, COLORS.ink, "bold");
    doc.text(pdfText(step.title), MARGIN + 13, cur.y + 0.8);
    cur.y += 9;
    renderStepBody(doc, cur, step);
    cur.y += 2;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Back page — the interactive guide
// ═══════════════════════════════════════════════════════════════════════════

function renderGuidePage(doc: jsPDF, cur: Cursor, links: NonNullable<DIYPDFInput["links"]>) {
  const url = links.upgradeUrl ?? links.guideUrl;
  if (!url) return;
  const upgrade = !!links.upgradeUrl;

  cur.ensure(70);
  if (cur.y > BODY_TOP) cur.y += 6;
  const top = cur.y;
  const h = 62;
  doc.setFillColor(...COLORS.ink);
  doc.roundedRect(MARGIN, top, CONTENT_W, h, 3, 3, "F");
  doc.setFillColor(...COLORS.accent);
  doc.rect(MARGIN, top, CONTENT_W, 1.4, "F");

  setText(doc, 8, COLORS.accent, "bold");
  doc.text(upgrade ? "SEE IT IN 3D" : "YOUR INTERACTIVE GUIDE", MARGIN + 8, top + 12);
  setText(doc, 17, COLORS.white, "bold");
  doc.text(
    upgrade
      ? `Add the Interactive 3D Build Guide — ${formatPlanPrice(TOTE_PLAN_UPGRADE_PRICE)}`
      : "Build along with the interactive 3D guide",
    MARGIN + 8,
    top + 22,
  );
  setText(doc, 10, [203, 213, 225]);
  paragraph(
    doc,
    upgrade
      ? "Rotate, zoom and step through every module on your phone, with a live map of your whole system showing which module you're on. Pay only the difference."
      : "Rotate, zoom and step through every module on your phone, with a live map of your system showing which module you're on.",
    MARGIN + 8,
    top + 30,
    CONTENT_W - 16,
    10,
  );

  const btnW = 76;
  const btnY = top + h - 17;
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(MARGIN + 8, btnY, btnW, 10, 2, 2, "F");
  setText(doc, 10, COLORS.ink, "bold");
  doc.text(upgrade ? "Upgrade my plan" : "Open my guide", MARGIN + 8 + btnW / 2, btnY + 6.6, { align: "center" });
  doc.link(MARGIN + 8, btnY, btnW, 10, { url });

  setText(doc, 7.5, [148, 163, 184]);
  doc.textWithLink(pdfText(url.replace(/^https?:\/\//, "")), MARGIN + 8 + btnW + 6, btnY + 6.3, { url });
  cur.y = top + h + 4;

  if (links.libraryUrl) {
    setText(doc, 9, COLORS.body);
    const lead = "All your plans and guides live in My Builds: ";
    doc.text(lead, MARGIN, cur.y + 4);
    const leadW = doc.getTextWidth(lead);
    setText(doc, 9, COLORS.link, "bold");
    doc.textWithLink("Open My Builds", MARGIN + leadW, cur.y + 4, {
      url: links.libraryUrl,
    });
    cur.y += 9;
  }
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
    doc.text(pdfText(`${plan.name} — Build Plan`), PAGE_W - MARGIN, 12, { align: "right" });
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
  const layout = designLayout(plan.design);
  const multi = plan.moduleCount > 1;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  doc.setProperties({
    title: `${pdfText(plan.name)} — Build Plan`,
    author: "Storage Network",
    subject: "DIY tote organizer build plan",
  });

  renderCover(doc, input, layout);

  const cur = new Cursor(doc);
  cur.newPage();
  renderBeforeYouStart(doc, cur, plan, input.links);
  if (multi) renderSystemOverview(doc, cur, plan, layout);
  renderCutPlan(doc, cur, plan);

  for (const t of plan.moduleTypes) {
    const last = t.steps[t.steps.length - 1];
    if (multi) renderModuleIntro(doc, cur, t, layout, input.snapshots[planSnapshotKey(t.letter, last.id)]);
    for (const step of t.steps) {
      renderStep(
        doc,
        cur,
        step,
        t.steps.length,
        input.snapshots[planSnapshotKey(t.letter, step.id)],
        multi ? `${moduleTypeTitle(t).toUpperCase()} · ` : "",
        input.links,
      );
    }
  }

  for (const unit of plan.units) {
    if (unit.assemblySteps.length > 0) renderUnitAssembly(doc, cur, unit, layout, plan.units.length);
  }

  if (input.links) renderGuidePage(doc, cur, input.links);

  stampPages(doc, plan);
  return doc;
}

export function downloadDIYPDF(input: DIYPDFInput): void {
  const slug = input.plan.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Tote-Organizer";
  generateDIYPDF(input).save(`Build-Plan-${slug}.pdf`);
}
