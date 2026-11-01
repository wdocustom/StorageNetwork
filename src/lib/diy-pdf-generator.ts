// ═══════════════════════════════════════════════════════════════════════════
// DIY PDF GENERATOR — Printable tote organizer build plan ("e-workbook")
//
// Built from the same sources as the interactive 3D Assembly Guide:
//   • CompleteDIYPlan (generate-plan.ts) — build-engine shopping list and
//     board packing, guide steps per module type, unit assembly steps
//   • AssemblyStepSnapshots — one 3D render per step of every module type
//
// Layout (US Letter, portrait) — black-and-yellow cover, warm paper inside:
//   Cover     — wordmark, title, "Designed for <name>", finished build, tags
//   Contents  — numbered sections with page numbers, at-a-glance numbers
//   01 Design         — dimensioned front + side drawing, angled view,
//                       modules + build order (multi-module)
//   02 Shopping List  — item cards with quantities and buy links
//   03 Tools & Safety — tool cards, safety notes
//   04 Cut List       — parts per module, every 8' board drawn to scale
//   05 Build Process  — per module type: overview, one page per step;
//                       then joining / stacking / worktop / anchoring
//   06 Good to Know   — notes, ladder jig, the interactive 3D guide
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
import { railTopMarks2x4 } from "@/components/visualizer/assemblySteps";

// ── Layout constants (mm) ──────────────────────────────────────────────

const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN = 16;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const BODY_TOP = 26; // below running header
const BODY_BOTTOM = PAGE_H - 18; // above footer
const DEPTH_IN = 30;

type RGB = [number, number, number];

// Storage Network: black + yellow, on warm paper so the inside prints well.
const COLORS = {
  black: [10, 10, 10] as RGB,
  coverPanel: [28, 28, 28] as RGB,
  paper: [250, 248, 242] as RGB,
  card: [255, 255, 255] as RGB,
  cardLine: [231, 226, 214] as RGB,
  ink: [17, 17, 17] as RGB,
  body: [64, 60, 56] as RGB,
  muted: [120, 113, 108] as RGB, // stone-500
  faint: [214, 211, 209] as RGB, // stone-300
  panel: [243, 239, 229] as RGB,
  white: [255, 255, 255] as RGB,
  accent: [250, 204, 21] as RGB, // yellow-400 (brand)
  accentSoft: [254, 240, 138] as RGB, // yellow-200
  accentInk: [161, 98, 7] as RGB, // yellow-700
  tipBg: [254, 249, 195] as RGB, // yellow-100
  fastenerBg: [255, 237, 213] as RGB, // orange-100
  fastenerInk: [194, 65, 12] as RGB, // orange-700
  lumber: [222, 184, 135] as RGB,
  lumberDark: [190, 150, 100] as RGB,
  lumberLight: [236, 210, 170] as RGB,
  lumberInk: [92, 64, 30] as RGB,
  tote: [30, 30, 30] as RGB,
  waste: [236, 232, 222] as RGB,
  link: [29, 78, 216] as RGB, // blue-700
  coverMuted: [163, 163, 163] as RGB,
};

// ── Input ──────────────────────────────────────────────────────────────

export interface DIYPDFInput {
  plan: CompleteDIYPlan;
  /** Step renders keyed by planSnapshotKey(typeLetter, stepId) */
  snapshots: Record<string, string>;
  /** Cover + every page footer, e.g. "Licensed to jo@example.com · Order SN-3F9A2C1B" */
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
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…×]/g, "");
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

/** Small uppercase label, letter-spaced. */
function kicker(doc: jsPDF, text: string, x: number, y: number, color: RGB = COLORS.accentInk, size = 7.5) {
  setText(doc, size, color, "bold");
  doc.setCharSpace(0.5);
  doc.text(pdfText(text.toUpperCase()), x, y);
  doc.setCharSpace(0);
}

/** Kicker + headline, the workbook's section heading. Returns the y below it. */
function heading(doc: jsPDF, label: string, title: string, y: number): number {
  kicker(doc, label, MARGIN, y);
  setText(doc, 17, COLORS.ink, "bold");
  doc.text(pdfText(title), MARGIN, y + 8);
  return y + 15;
}

/** Yellow pill; returns its width. */
function pill(doc: jsPDF, text: string, x: number, y: number, size = 8, url?: string): number {
  setText(doc, size, COLORS.ink, "bold");
  const w = doc.getTextWidth(pdfText(text)) + 6;
  const h = size * 0.3528 + 3.2;
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(x, y - h + 1.1, w, h, h / 2, h / 2, "F");
  doc.text(pdfText(text), x + 3, y);
  if (url) doc.link(x, y - h + 1.1, w, h, { url });
  return w;
}

function card(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...COLORS.card);
  doc.setDrawColor(...COLORS.cardLine);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
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

/** Filled polygon from absolute points. */
function poly(doc: jsPDF, pts: [number, number][], style: "F" | "FD" | "S" = "F") {
  const deltas = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], style, true);
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
  get page() {
    return this.doc.getNumberOfPages();
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
// Icons — small line drawings for shopping-list and tool cards
// ═══════════════════════════════════════════════════════════════════════════

type IconKind =
  | "lumber" | "plywood" | "tote" | "caster" | "screw" | "bracket"
  | "saw" | "drill" | "bit" | "square" | "tape" | "glasses" | "pencil"
  | "level" | "clamp" | "blanket" | "stick" | "tool";

function iconFor(name: string): IconKind {
  const n = name.toLowerCase();
  const rules: [RegExp, IconKind][] = [
    [/plywood|sheet/, "plywood"],
    [/2x4|2×4|lumber|stud|board/, "lumber"],
    [/tote/, "tote"],
    [/caster|wheel/, "caster"],
    [/screw/, "screw"],
    [/bracket/, "bracket"],
    [/saw/, "saw"],
    [/bit\b|t-25|star bit/, "bit"],
    [/drill|driver/, "drill"],
    [/square/, "square"],
    [/tape/, "tape"],
    [/glasses|goggles/, "glasses"],
    [/pencil/, "pencil"],
    [/level/, "level"],
    [/clamp/, "clamp"],
    [/blanket/, "blanket"],
    [/push stick/, "stick"],
  ];
  return rules.find(([re]) => re.test(n))?.[1] ?? "tool";
}

/** Draw `kind` inside an s×s tile at (x, y). */
function drawIcon(doc: jsPDF, kind: IconKind, x: number, y: number, s: number) {
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(x, y, s, s, 1.6, 1.6, "F");
  const cx = x + s / 2;
  const cy = y + s / 2;
  const u = s / 14; // drawing unit
  doc.setLineWidth(0.35);
  doc.setDrawColor(...COLORS.ink);

  switch (kind) {
    case "lumber":
      for (let i = 0; i < 3; i++) {
        doc.setFillColor(...(i === 1 ? COLORS.lumberDark : COLORS.lumber));
        doc.rect(x + 2 * u, y + (3.2 + i * 2.8) * u, 10 * u, 2.2 * u, "F");
      }
      break;
    case "plywood":
      doc.setFillColor(...COLORS.lumberLight);
      poly(doc, [[x + 2 * u, y + 9.5 * u], [x + 5 * u, y + 4 * u], [x + 12 * u, y + 4 * u], [x + 9 * u, y + 9.5 * u]], "F");
      doc.setFillColor(...COLORS.lumberDark);
      poly(doc, [[x + 2 * u, y + 9.5 * u], [x + 9 * u, y + 9.5 * u], [x + 9 * u, y + 10.4 * u], [x + 2 * u, y + 10.4 * u]], "F");
      break;
    case "tote":
      doc.setFillColor(...COLORS.tote);
      doc.roundedRect(x + 2.5 * u, y + 5 * u, 9 * u, 6.5 * u, 0.5 * u, 0.5 * u, "F");
      doc.setFillColor(...COLORS.accent);
      doc.rect(x + 2 * u, y + 3.6 * u, 10 * u, 1.8 * u, "F");
      break;
    case "caster":
      doc.setFillColor(...COLORS.body);
      doc.rect(x + 4 * u, y + 3 * u, 6 * u, 1.2 * u, "F");
      doc.rect(x + 6.4 * u, y + 4.2 * u, 1.2 * u, 2.2 * u, "F");
      doc.setFillColor(...COLORS.ink);
      doc.circle(cx, y + 8.6 * u, 2.6 * u, "F");
      doc.setFillColor(...COLORS.accent);
      doc.circle(cx, y + 8.6 * u, 0.9 * u, "F");
      break;
    case "screw":
      doc.setFillColor(...COLORS.muted);
      doc.rect(x + 3 * u, y + 6.3 * u, 7.5 * u, 1.4 * u, "F");
      poly(doc, [[x + 10.5 * u, y + 6.3 * u], [x + 12 * u, y + 7 * u], [x + 10.5 * u, y + 7.7 * u]], "F");
      doc.setFillColor(...COLORS.body);
      doc.rect(x + 2 * u, y + 4.8 * u, 1.2 * u, 4.4 * u, "F");
      doc.setDrawColor(...COLORS.white);
      doc.setLineWidth(0.15);
      for (let i = 0; i < 5; i++) doc.line(x + (4.2 + i * 1.3) * u, y + 6.3 * u, x + (4.8 + i * 1.3) * u, y + 7.7 * u);
      break;
    case "bracket":
      doc.setFillColor(...COLORS.muted);
      doc.rect(x + 4 * u, y + 3 * u, 1.6 * u, 8 * u, "F");
      doc.rect(x + 4 * u, y + 9.4 * u, 7 * u, 1.6 * u, "F");
      break;
    case "saw": {
      doc.setFillColor(...COLORS.muted);
      const r = 4.2 * u;
      const teeth: [number, number][] = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rr = i % 2 ? r : r * 0.85;
        teeth.push([cx - 1 * u + Math.cos(a) * rr, cy + 0.6 * u + Math.sin(a) * rr]);
      }
      poly(doc, teeth, "F");
      doc.setFillColor(...COLORS.accent);
      doc.roundedRect(x + 6 * u, y + 2 * u, 6.5 * u, 3.4 * u, 0.8 * u, 0.8 * u, "F");
      doc.setFillColor(...COLORS.ink);
      doc.circle(cx - 1 * u, cy + 0.6 * u, 0.9 * u, "F");
      break;
    }
    case "drill":
      doc.setFillColor(...COLORS.accent);
      doc.roundedRect(x + 3 * u, y + 3.5 * u, 7 * u, 3.2 * u, 0.8 * u, 0.8 * u, "F");
      doc.setFillColor(...COLORS.ink);
      doc.rect(x + 5 * u, y + 6.5 * u, 2.4 * u, 4 * u, "F");
      doc.rect(x + 4.4 * u, y + 10.3 * u, 3.6 * u, 1.4 * u, "F");
      doc.setFillColor(...COLORS.muted);
      doc.rect(x + 10 * u, y + 4.6 * u, 2.6 * u, 1 * u, "F");
      break;
    case "bit":
      doc.setFillColor(...COLORS.muted);
      doc.rect(x + 3 * u, y + 6.2 * u, 6 * u, 1.6 * u, "F");
      poly(doc, [[x + 9 * u, y + 5.6 * u], [x + 11.5 * u, y + 7 * u], [x + 9 * u, y + 8.4 * u]], "F");
      break;
    case "square":
      doc.setFillColor(...COLORS.muted);
      poly(doc, [[x + 3 * u, y + 11 * u], [x + 3 * u, y + 3 * u], [x + 11 * u, y + 11 * u]], "F");
      doc.setFillColor(...COLORS.panel);
      poly(doc, [[x + 5 * u, y + 9.6 * u], [x + 5 * u, y + 7 * u], [x + 7.6 * u, y + 9.6 * u]], "F");
      break;
    case "tape":
      doc.setFillColor(...COLORS.accent);
      doc.roundedRect(x + 3 * u, y + 3 * u, 7.5 * u, 7.5 * u, 1.5 * u, 1.5 * u, "F");
      doc.setFillColor(...COLORS.ink);
      doc.circle(x + 6.75 * u, y + 6.75 * u, 1.8 * u, "F");
      doc.setFillColor(...COLORS.muted);
      doc.rect(x + 10.5 * u, y + 9.2 * u, 2 * u, 1.3 * u, "F");
      break;
    case "glasses":
      doc.setDrawColor(...COLORS.ink);
      doc.setLineWidth(0.5);
      doc.setFillColor(220, 235, 245);
      doc.roundedRect(x + 2 * u, y + 5 * u, 4.4 * u, 3.6 * u, 1.2 * u, 1.2 * u, "FD");
      doc.roundedRect(x + 7.6 * u, y + 5 * u, 4.4 * u, 3.6 * u, 1.2 * u, 1.2 * u, "FD");
      doc.line(x + 6.4 * u, y + 6.2 * u, x + 7.6 * u, y + 6.2 * u);
      break;
    case "pencil":
      doc.setFillColor(...COLORS.accent);
      doc.rect(x + 2.5 * u, y + 6 * u, 7.5 * u, 2 * u, "F");
      doc.setFillColor(...COLORS.lumberLight);
      poly(doc, [[x + 10 * u, y + 6 * u], [x + 12 * u, y + 7 * u], [x + 10 * u, y + 8 * u]], "F");
      doc.setFillColor(...COLORS.ink);
      poly(doc, [[x + 11.3 * u, y + 6.65 * u], [x + 12 * u, y + 7 * u], [x + 11.3 * u, y + 7.35 * u]], "F");
      break;
    case "level":
      doc.setFillColor(...COLORS.accent);
      doc.rect(x + 1.5 * u, y + 5.5 * u, 11 * u, 3 * u, "F");
      doc.setFillColor(150, 220, 160);
      doc.roundedRect(x + 5.5 * u, y + 6.2 * u, 3 * u, 1.6 * u, 0.6 * u, 0.6 * u, "F");
      break;
    case "clamp":
      doc.setFillColor(...COLORS.ink);
      doc.rect(x + 3 * u, y + 3 * u, 1.4 * u, 8 * u, "F");
      doc.rect(x + 3 * u, y + 3 * u, 7 * u, 1.4 * u, "F");
      doc.rect(x + 3 * u, y + 9.6 * u, 7 * u, 1.4 * u, "F");
      doc.setFillColor(...COLORS.accent);
      doc.rect(x + 9 * u, y + 5.6 * u, 3 * u, 2.8 * u, "F");
      break;
    case "blanket":
      doc.setFillColor(70, 110, 160);
      doc.rect(x + 2.5 * u, y + 4 * u, 9 * u, 6 * u, "F");
      doc.setDrawColor(...COLORS.white);
      doc.setLineWidth(0.2);
      for (let i = 1; i < 4; i++) doc.line(x + 2.5 * u, y + (4 + i * 1.5) * u, x + 11.5 * u, y + (4 + i * 1.5) * u);
      break;
    case "stick":
      doc.setFillColor(...COLORS.accent);
      poly(doc, [[x + 2 * u, y + 9 * u], [x + 11 * u, y + 5 * u], [x + 12 * u, y + 7 * u], [x + 3 * u, y + 11 * u]], "F");
      break;
    default:
      doc.setFillColor(...COLORS.muted);
      doc.circle(cx, cy, 3 * u, "F");
      doc.setFillColor(...COLORS.panel);
      doc.circle(cx, cy, 1.2 * u, "F");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Drawings — front elevation, side view, angled view (all to scale)
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
    doc.setFillColor(...(lit ? COLORS.accentSoft : COLORS.card));
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
  return { scale, toX, toY, floorY };
}

/** Dimension line with end ticks and a centered label. */
function dimLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, label: string) {
  doc.setDrawColor(...COLORS.accentInk);
  doc.setLineWidth(0.25);
  doc.line(x1, y1, x2, y2);
  const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1);
  const t = 1.2;
  if (vertical) {
    doc.line(x1 - t, y1, x1 + t, y1);
    doc.line(x2 - t, y2, x2 + t, y2);
  } else {
    doc.line(x1, y1 - t, x1, y1 + t);
    doc.line(x2, y2 - t, x2, y2 + t);
  }
  setText(doc, 7.5, COLORS.accentInk, "bold");
  const lx = (x1 + x2) / 2;
  const ly = (y1 + y2) / 2;
  if (vertical) {
    doc.setFillColor(...COLORS.card);
    const w = doc.getTextWidth(pdfText(label)) + 2;
    doc.rect(lx - w / 2, ly - 2.2, w, 3.4, "F");
    doc.text(pdfText(label), lx, ly + 0.6, { align: "center" });
  } else {
    doc.text(pdfText(label), lx, ly - 1.4, { align: "center" });
  }
}

/** One ladder seen from the side: front + back uprights and the rails between. */
function drawSideView(
  doc: jsPDF,
  layout: DesignLayout,
  box: { x: number; y: number; w: number; h: number },
): number[] {
  // The tallest unit's left column of modules, bottom to top
  const tallest = layout.units.reduce((a, b) => (b.h > a.h ? b : a), layout.units[0]);
  const column = layout.modules
    .filter((m) => m.unitIndex === tallest.unitIndex && Math.abs(m.x - tallest.x) < 0.01)
    .sort((a, b) => a.y - b.y);
  const scale = Math.min((box.w - 22) / DEPTH_IN, (box.h - 12) / tallest.h);
  const ox = box.x + 6;
  const floorY = box.y + box.h - 6;
  const toY = (inches: number) => floorY - inches * scale;
  const post = 3.5 * scale;
  const d = DEPTH_IN * scale;

  doc.setDrawColor(...COLORS.faint);
  doc.setLineWidth(0.4);
  doc.line(box.x, floorY, box.x + box.w, floorY);

  const railTops: number[] = [];
  for (const m of column) {
    doc.setFillColor(...COLORS.lumber);
    doc.setDrawColor(...COLORS.lumberInk);
    doc.setLineWidth(0.2);
    doc.rect(ox, toY(m.y + m.h), post, m.h * scale, "FD");
    doc.rect(ox + d - post, toY(m.y + m.h), post, m.h * scale, "FD");
    for (const top of railTopMarks2x4(m.rows)) {
      const at = m.y + top;
      railTops.push(at);
      doc.setFillColor(...COLORS.lumberDark);
      doc.rect(ox + post, toY(at), d - 2 * post, 1.5 * scale, "FD");
      doc.setDrawColor(...COLORS.faint);
      doc.setLineWidth(0.15);
      doc.line(ox + d + 1, toY(at), ox + d + 3, toY(at));
      setText(doc, 6, COLORS.muted);
      doc.text(formatInches(at), ox + d + 3.6, toY(at) + 0.9);
    }
  }
  if (tallest.hasTop) {
    doc.setFillColor(...COLORS.lumberLight);
    doc.rect(ox - 0.5, toY(tallest.h) - 1.1, d + 1, 1.1, "F");
  }
  if (tallest.hasWheels) {
    doc.setFillColor(...COLORS.body);
    const r = Math.max(0.6, 1.4 * scale);
    doc.circle(ox + post / 2, floorY - r, r, "F");
    doc.circle(ox + d - post / 2, floorY - r, r, "F");
  }
  dimLine(doc, ox, floorY + 3, ox + d, floorY + 3, `${DEPTH_IN}" deep`);
  return railTops;
}

/**
 * The whole build at an angle (oblique projection): lumber frames, black
 * totes with yellow lids, worktops and side panels. Drawn, not rendered, so
 * it works for any design and prints crisp.
 */
function drawAngledView(doc: jsPDF, layout: DesignLayout, box: { x: number; y: number; w: number; h: number }, dark = false) {
  const kx = 0.42; // depth → x per inch
  const ky = 0.26; // depth → y per inch
  const scale = Math.min(box.w / (layout.widthIn + DEPTH_IN * kx), box.h / (layout.heightIn + DEPTH_IN * ky));
  const ox = box.x + (box.w - (layout.widthIn + DEPTH_IN * kx) * scale) / 2;
  const floorY = box.y + box.h - (box.h - (layout.heightIn + DEPTH_IN * ky) * scale) / 2;
  const X = (inches: number, depth = 0) => ox + (inches + depth * kx) * scale;
  const Y = (inches: number, depth = 0) => floorY - (inches + depth * ky) * scale;

  // Floor shadow
  doc.setFillColor(...(dark ? ([40, 40, 40] as RGB) : COLORS.panel));
  poly(doc, [
    [X(-4, 0), Y(0, 0)],
    [X(layout.widthIn + 4, 0), Y(0, 0)],
    [X(layout.widthIn + 4, DEPTH_IN), Y(0, DEPTH_IN)],
    [X(-4, DEPTH_IN), Y(0, DEPTH_IN)],
  ]);

  // Left to right: each unit's front covers the side of the one before it.
  for (const unit of layout.units) {
    const base = unit.hasWheels ? 2.75 : 0;
    const left = unit.x;
    const right = unit.x + unit.w;
    const top = unit.h;

    // Right side and top
    doc.setFillColor(...COLORS.lumberDark);
    poly(doc, [[X(right), Y(base)], [X(right, DEPTH_IN), Y(base, DEPTH_IN)], [X(right, DEPTH_IN), Y(top, DEPTH_IN)], [X(right), Y(top)]]);
    doc.setFillColor(...(unit.hasTop ? COLORS.lumberLight : COLORS.lumber));
    poly(doc, [[X(left), Y(top)], [X(right), Y(top)], [X(right, DEPTH_IN), Y(top, DEPTH_IN)], [X(left, DEPTH_IN), Y(top, DEPTH_IN)]]);

    // Rails on the right side
    for (const m of layout.modules.filter((mm) => mm.unitIndex === unit.unitIndex && Math.abs(mm.x + mm.w - right) < 0.01)) {
      doc.setDrawColor(...COLORS.lumberInk);
      doc.setLineWidth(0.2);
      for (const t of railTopMarks2x4(m.rows)) {
        doc.line(X(right, 3.5), Y(m.y + t, 3.5), X(right, DEPTH_IN - 3.5), Y(m.y + t, DEPTH_IN - 3.5));
      }
    }

    // Front faces
    for (const m of layout.modules.filter((mm) => mm.unitIndex === unit.unitIndex)) {
      doc.setFillColor(...COLORS.lumber);
      doc.setDrawColor(...COLORS.lumberInk);
      doc.setLineWidth(0.2);
      doc.rect(X(m.x), Y(m.y + m.h), m.w * scale, m.h * scale, "FD");
      const cellW = m.w / m.cols;
      const marks = railTopMarks2x4(m.rows);
      for (let r = 0; r < m.rows; r++) {
        // Each tote's lip rides on its rails; the body hangs down toward the rail below.
        const railTop = m.y + marks[r];
        const floor = r === 0 ? m.y + 0.5 : m.y + marks[r - 1] + 1;
        const bodyH = Math.max(0, Math.min(13.5, railTop - floor));
        for (let c = 0; c < m.cols; c++) {
          const tx = m.x + c * cellW + 1.9;
          const tw = cellW - 3.8;
          doc.setFillColor(...COLORS.tote);
          doc.rect(X(tx + 0.4), Y(railTop), (tw - 0.8) * scale, bodyH * scale, "F");
          doc.setFillColor(...COLORS.accent);
          doc.rect(X(tx), Y(railTop + 1.4), tw * scale, 1.4 * scale, "F");
        }
      }
    }

    // Worktop edge
    if (unit.hasTop) {
      doc.setFillColor(...COLORS.lumberLight);
      doc.setDrawColor(...COLORS.lumberInk);
      doc.rect(X(left) - 0.3, Y(top) - 0.2, unit.w * scale + 0.6, 0.75 * scale + 0.4, "FD");
    }

    // Casters
    if (unit.hasWheels) {
      doc.setFillColor(...COLORS.ink);
      const r = Math.max(0.6, 1.3 * scale);
      for (const cx of unit.casters) doc.circle(X(cx), floorY - r, r, "F");
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Cover + contents
// ═══════════════════════════════════════════════════════════════════════════

function renderCover(doc: jsPDF, input: DIYPDFInput, layout: DesignLayout) {
  const { plan } = input;
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, 3, PAGE_H, "F");

  // Yellow-and-white ® wordmark (549×219 source); text if it didn't load.
  const logoH = 17;
  const logoW = (logoH * 549) / 219;
  let logoPlaced = false;
  if (input.logoDataUrl) {
    try {
      doc.addImage(input.logoDataUrl, "PNG", MARGIN - 1, 12, logoW, logoH);
      logoPlaced = true;
    } catch {
      // fall through to the text mark
    }
  }
  if (!logoPlaced) {
    setText(doc, 13, COLORS.accent, "bold");
    doc.text("STORAGE-NETWORK.APP", MARGIN, 24);
  }
  kicker(doc, "E-Workbook", PAGE_W - MARGIN - 22, 18, COLORS.accent);
  setText(doc, 8, COLORS.coverMuted);
  doc.text("storage-network.app", PAGE_W - MARGIN, 24, { align: "right" });

  // Title block
  const name = input.designedFor?.trim();
  kicker(doc, name ? `DIY build plan · Designed for ${name}` : "DIY build plan", MARGIN, 45, COLORS.accent, 8.5);
  setText(doc, 30, COLORS.white, "bold");
  const titleLines = (doc.splitTextToSize(pdfText(plan.name.toUpperCase()), CONTENT_W) as string[]).slice(0, 2);
  doc.text(titleLines, MARGIN, 58);
  let y = 58 + (titleLines.length - 1) * 11.5 + 8;
  setText(doc, 9.5, COLORS.coverMuted);
  y = paragraph(doc, plan.summary.replace(/ · /g, "  ·  "), MARGIN, y, CONTENT_W, 9.5) + 4;

  // Hero — the finished build. A real 3D render when there's one module,
  // else the whole system drawn at an angle.
  const heroH = 136;
  doc.setFillColor(...COLORS.coverPanel);
  doc.roundedRect(MARGIN, y, CONTENT_W, heroH, 3, 3, "F");
  const t = plan.moduleTypes[0];
  const render = plan.moduleCount === 1 ? input.snapshots[planSnapshotKey(t.letter, t.steps[t.steps.length - 1].id)] : undefined;
  if (render) addImageSafe(doc, render, MARGIN + 2, y + 2, CONTENT_W - 4, heroH - 4, "Finished build");
  else drawAngledView(doc, layout, { x: MARGIN + 10, y: y + 10, w: CONTENT_W - 20, h: heroH - 20 }, true);
  y += heroH + 9;

  // Tags
  const tags = [
    `${plan.toteCount} totes`,
    `${plan.totals.boards} 2×4×8' boards`,
    plan.moduleCount > 1 ? `${plan.moduleCount} modules` : "One module",
    "Cut list included",
  ];
  let tx = MARGIN;
  for (const tag of tags) tx += pill(doc, tag, tx, y, 8.5) + 2.5;
  y += 10;

  // At a glance
  const d = plan.dimensions;
  const stats: [string, string][] = [
    ["Width", d.totalWidth],
    ["Height", d.totalHeight],
    ["Depth", d.depth],
  ];
  const cellW = CONTENT_W / 3;
  stats.forEach(([label, value], i) => {
    const cx = MARGIN + i * cellW;
    kicker(doc, label, cx, y + 4, COLORS.coverMuted, 7);
    setText(doc, 18, COLORS.white, "bold");
    doc.text(pdfText(value), cx, y + 12.5);
  });

  if (input.licensedTo) {
    setText(doc, 7.5, COLORS.coverMuted);
    doc.text(pdfText(input.licensedTo), MARGIN, PAGE_H - 22);
  }

  // Footer
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, PAGE_H - 16, PAGE_W - MARGIN, PAGE_H - 16);
  setText(doc, 8.5, COLORS.accent, "bold");
  doc.text("STORAGE-NETWORK.APP", MARGIN, PAGE_H - 9.5);
  setText(doc, 8, COLORS.coverMuted);
  doc.text("Rather have it built for you? Book a local pro at storage-network.app", PAGE_W - MARGIN, PAGE_H - 9.5, {
    align: "right",
  });
}

interface Section {
  num: string;
  title: string;
  page: number;
}

/** Contents is laid out after every section exists, so the page numbers are real. */
function renderContents(doc: jsPDF, page: number, plan: CompleteDIYPlan, sections: Section[]) {
  doc.setPage(page);
  let y = heading(doc, "Inside this workbook", "Contents", BODY_TOP);
  y += 2;
  for (const s of sections) {
    setText(doc, 15, COLORS.accentInk, "bold");
    doc.text(s.num, MARGIN, y + 6);
    setText(doc, 12.5, COLORS.ink, "bold");
    doc.text(pdfText(s.title), MARGIN + 14, y + 6);
    setText(doc, 8.5, COLORS.muted);
    doc.text(`Page ${s.page}`, PAGE_W - MARGIN, y + 6, { align: "right" });
    doc.setDrawColor(...COLORS.cardLine);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, y + 10, PAGE_W - MARGIN, y + 10);
    y += 13;
  }

  y += 8;
  kicker(doc, "At a glance", MARGIN, y);
  y += 4;
  const d = plan.dimensions;
  const stats: [string, string][] = [
    ["Width", d.totalWidth],
    ["Height", d.totalHeight],
    ["Depth", d.depth],
    ["Totes", String(plan.toteCount)],
    ["2×4×8' boards", String(plan.totals.boards)],
    plan.moduleCount > 1 ? ["Modules to build", String(plan.moduleCount)] : ["2×4 rails", String(plan.railBoards.rails)],
  ];
  const cellW = CONTENT_W / 3;
  const cellH = 16;
  stats.forEach(([label, value], i) => {
    const cx = MARGIN + (i % 3) * cellW;
    const cy = y + Math.floor(i / 3) * (cellH + 3);
    card(doc, cx + 1, cy, cellW - 2, cellH);
    kicker(doc, label, cx + 5, cy + 5.8, COLORS.muted, 6.5);
    setText(doc, 14, COLORS.ink, "bold");
    doc.text(pdfText(value), cx + 5, cy + 12.6);
  });
  y += 2 * (cellH + 3) + 8;

  doc.setFillColor(...COLORS.tipBg);
  doc.roundedRect(MARGIN, y, CONTENT_W, 18, 2, 2, "F");
  kicker(doc, "Read me first", MARGIN + 5, y + 6.5);
  setText(doc, 9.5, COLORS.ink);
  paragraph(
    doc,
    "Read the whole plan once before you buy materials. Cut every piece on the cut list first, then assemble in order — each step builds on the last.",
    MARGIN + 5,
    y + 12,
    CONTENT_W - 10,
    9.5,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 01 Design — dimensioned drawing, angled view, modules
// ═══════════════════════════════════════════════════════════════════════════

function renderDesign(doc: jsPDF, cur: Cursor, plan: CompleteDIYPlan, layout: DesignLayout) {
  cur.y = heading(doc, "Design", "Dimensioned drawing", cur.y);

  // Front + side, side by side
  const drawH = 92;
  card(doc, MARGIN, cur.y, CONTENT_W, drawH);
  const sideW = 50;
  const frontBox = { x: MARGIN + 12, y: cur.y + 9, w: CONTENT_W - sideW - 22, h: drawH - 20 };
  kicker(doc, "Front view", MARGIN + 5, cur.y + 5.5, COLORS.muted, 6.5);
  kicker(doc, "Side view", MARGIN + CONTENT_W - sideW, cur.y + 5.5, COLORS.muted, 6.5);
  const map = drawSystemMap(doc, layout, frontBox, { dimensions: false });
  const left = map.toX(0);
  const right = map.toX(layout.widthIn);
  const topY = map.toY(layout.heightIn);
  dimLine(doc, left, map.floorY + 5, right, map.floorY + 5, `${plan.dimensions.totalWidth} overall`);
  dimLine(doc, left - 5, topY, left - 5, map.floorY, plan.dimensions.totalHeight);
  const railTops = drawSideView(doc, layout, { x: MARGIN + CONTENT_W - sideW - 2, y: cur.y + 9, w: sideW, h: drawH - 14 });
  setText(doc, 6.5, COLORS.muted, "bold");
  doc.text("DRAWN TO SCALE", MARGIN + CONTENT_W / 2, cur.y + drawH - 2.5, { align: "center" });
  cur.y += drawH + 5;

  // Measurements table
  const rows: [string, string][] = [
    ["Overall width", plan.dimensions.totalWidth],
    ["Overall height", plan.dimensions.totalHeight],
    ["Overall depth", plan.dimensions.depth],
    ["Tote bay (between uprights)", '21"'],
    ["Rail spacing", '15-3/4" on center'],
    ["Top rail (from floor)", formatInches(Math.max(...railTops))],
  ];
  const colW = CONTENT_W / 2;
  const rowsPerCol = Math.ceil(rows.length / 2);
  rows.forEach(([k, v], i) => {
    const x = MARGIN + (i < rowsPerCol ? 0 : colW + 4);
    const y = cur.y + (i % rowsPerCol) * 6.5;
    const w = colW - 4;
    setText(doc, 8.5, COLORS.muted);
    doc.text(pdfText(k), x, y);
    setText(doc, 8.5, COLORS.ink, "bold");
    const val = (doc.splitTextToSize(pdfText(v), w * 0.5) as string[])[0];
    doc.text(val, x + w, y, { align: "right" });
    doc.setDrawColor(...COLORS.cardLine);
    doc.setLineWidth(0.2);
    doc.line(x, y + 2.2, x + w, y + 2.2);
  });
  cur.y += rowsPerCol * 6.5 + 6;

  // Angled view
  cur.ensure(80);
  kicker(doc, "Design", MARGIN, cur.y);
  setText(doc, 14, COLORS.ink, "bold");
  doc.text("Angled view", MARGIN, cur.y + 7);
  cur.y += 11;
  const angleH = Math.min(96, BODY_BOTTOM - cur.y - 2);
  card(doc, MARGIN, cur.y, CONTENT_W, angleH);
  drawAngledView(doc, layout, { x: MARGIN + 8, y: cur.y + 6, w: CONTENT_W - 16, h: angleH - 12 });
  cur.y += angleH + 6;

  if (plan.moduleCount > 1) renderModules(doc, cur, plan);
}

function renderModules(doc: jsPDF, cur: Cursor, plan: CompleteDIYPlan) {
  cur.newPage();
  cur.y = heading(doc, "Design", "Your system", cur.y);
  setText(doc, 9, COLORS.body);
  cur.y = paragraph(
    doc,
    "Your build is made of self-contained modules — each one a complete frame. Units are lettered A, B, C…; a unit made of several modules numbers them A1, A2… Identical modules are grouped below: build one, then repeat it. Then join them into units in the order below.",
    MARGIN,
    cur.y,
    CONTENT_W,
    9,
  ) + 4;

  // Module types table
  const tableH = 12 + plan.moduleTypes.length * 8;
  card(doc, MARGIN, cur.y, CONTENT_W, tableH);
  const cols = [MARGIN + 4, MARGIN + 34, MARGIN + 64, MARGIN + 104, MARGIN + 142];
  ["Modules", "Size", "Outside (W × H)", "Includes", "Build"].forEach((h, i) => kicker(doc, h, cols[i], cur.y + 6, COLORS.muted, 6.5));
  let y = cur.y + 13;
  for (const t of plan.moduleTypes) {
    const label = t.label.length > 14 ? `${t.moduleNames[0]}…` : t.label;
    setText(doc, label.length > 7 ? 8 : 10, COLORS.ink, "bold");
    const chipW = Math.min(28, doc.getTextWidth(label) + 4);
    doc.setFillColor(...COLORS.accent);
    doc.roundedRect(cols[0], y - 4.2, chipW, 6, 1, 1, "F");
    doc.text(label, cols[0] + chipW / 2, y, { align: "center" });
    setText(doc, 9, COLORS.ink, "bold");
    doc.text(`${t.cols} wide × ${t.rows} tall`, cols[1], y);
    setText(doc, 9, COLORS.body);
    doc.text(pdfText(`${formatInches(t.widthIn)} × ${formatInches(t.frameHeightIn)}`), cols[2], y);
    const extras = [t.hasWheels ? "casters" : "", t.hasTop ? "worktop" : ""].filter(Boolean).join(" + ") || "frame";
    doc.text(extras, cols[3], y);
    setText(doc, 10, COLORS.ink, "bold");
    doc.text(`× ${t.count}`, cols[4], y);
    y += 8;
  }
  cur.y += tableH + 8;

  // Build order
  cur.ensure(20);
  kicker(doc, "Build order", MARGIN, cur.y);
  cur.y += 6;
  const order = [
    "Cut every part on the cut list.",
    ...plan.moduleTypes.map((t) => `Build ${moduleTypeTitle(t)} (${t.cols}×${t.rows})${t.count > 1 ? ` — ${t.count} identical` : ""}.`),
    ...plan.units
      .filter((u) => u.assemblySteps.length > 0)
      .map((u) => `Assemble Unit ${u.letter} (${u.label}): ${u.assemblySteps.map((s) => s.title.toLowerCase()).join(", ")}.`),
  ];
  order.forEach((line, i) => {
    const h = measure(doc, line, CONTENT_W - 12, 9.5);
    cur.ensure(h + 2);
    doc.setFillColor(...COLORS.accent);
    doc.circle(MARGIN + 3, cur.y - 1.2, 3, "F");
    setText(doc, 8, COLORS.ink, "bold");
    doc.text(String(i + 1), MARGIN + 3, cur.y + 0.1, { align: "center" });
    setText(doc, 9.5, COLORS.body);
    cur.y = paragraph(doc, line, MARGIN + 9, cur.y, CONTENT_W - 12, 9.5) + 2.5;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 02 Shopping list, 03 Tools & safety
// ═══════════════════════════════════════════════════════════════════════════

function renderShopping(doc: jsPDF, cur: Cursor, plan: CompleteDIYPlan) {
  cur.y = heading(doc, "Shopping list", "Everything you need to buy", cur.y);
  const rowH = 17;
  const hasLinks = plan.shoppingList.some((i) => i.url);
  for (const item of plan.shoppingList) {
    cur.ensure(rowH + 2);
    card(doc, MARGIN, cur.y, CONTENT_W, rowH);
    const named = iconFor(item.name);
    drawIcon(doc, named === "tool" ? iconFor(item.detail) : named, MARGIN + 2.5, cur.y + 2.5, rowH - 5);
    const tx = MARGIN + rowH + 2;
    const qtyW = 34;
    setText(doc, 10, COLORS.ink, "bold");
    doc.text(pdfText(item.name), tx, cur.y + 7);
    setText(doc, 8, COLORS.muted);
    const detail = (doc.splitTextToSize(pdfText(item.detail), CONTENT_W - rowH - qtyW - 8) as string[])[0];
    doc.text(detail, tx, cur.y + 12);
    setText(doc, 14, COLORS.ink, "bold");
    doc.text(pdfText(String(item.qty)), PAGE_W - MARGIN - 4, cur.y + (item.url ? 7.5 : 10.5), { align: "right" });
    if (item.url) {
      setText(doc, 7, COLORS.ink, "bold");
      const label = `Buy ${item.store === "Amazon" ? "on" : "at"} ${item.store}`;
      const w = doc.getTextWidth(label) + 5;
      pill(doc, label, PAGE_W - MARGIN - 4 - w, cur.y + 13.5, 7, item.url);
    }
    cur.y += rowH + 2;
  }
  if (hasLinks) {
    setText(doc, 7, COLORS.muted, "italic");
    cur.y = paragraph(doc, AFFILIATE_DISCLOSURE, MARGIN, cur.y + 2, CONTENT_W, 7);
  }
  cur.y += 2;
  setText(doc, 8.5, COLORS.body);
  cur.y = paragraph(
    doc,
    "Pick straight boards at the store — sight down each one. A bowed upright or twisted rail makes squaring the ladders harder.",
    MARGIN,
    cur.y + 2,
    CONTENT_W,
    8.5,
  ) + 4;
}

function renderTools(doc: jsPDF, cur: Cursor, plan: CompleteDIYPlan) {
  cur.y = heading(doc, "Tools", "What you'll use for this build", cur.y);
  const gap = 4;
  const w = (CONTENT_W - gap) / 2;
  const h = 15;
  plan.allTools.forEach((tool, i) => {
    if (i % 2 === 0) cur.ensure(h + gap);
    const x = MARGIN + (i % 2) * (w + gap);
    card(doc, x, cur.y, w, h);
    drawIcon(doc, iconFor(tool), x + 2.5, cur.y + 2.5, h - 5);
    setText(doc, 9.5, COLORS.ink, "bold");
    doc.text(pdfText(tool), x + h + 2, cur.y + h / 2 + 1.3);
    if (i % 2 === 1 || i === plan.allTools.length - 1) cur.y += h + gap;
  });
  cur.y += 4;

  cur.ensure(20);
  kicker(doc, "Safety", MARGIN, cur.y);
  cur.y += 6;
  bullets(doc, cur, plan.safetyNotes);
}

function bullets(doc: jsPDF, cur: Cursor, items: string[]) {
  for (const item of items) {
    const h = measure(doc, item, CONTENT_W - 6, 9.5);
    cur.ensure(h + 1.5);
    doc.setFillColor(...COLORS.accent);
    doc.circle(MARGIN + 1.3, cur.y - 1.2, 1, "F");
    setText(doc, 9.5, COLORS.body);
    cur.y = paragraph(doc, item, MARGIN + 5, cur.y, CONTENT_W - 6, 9.5) + 1.5;
  }
  cur.y += 3;
}

// ═══════════════════════════════════════════════════════════════════════════
// 04 Cut list
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

/** Scrap hatch over [x, x + w]. */
function hatch(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...COLORS.waste);
  doc.rect(x, y, w, h, "F");
  if (w < 0.5) return;
  doc.setDrawColor(...COLORS.faint);
  doc.setLineWidth(0.25);
  for (let hx = x - h; hx < x + w; hx += 1.8) {
    const x1 = Math.max(x, hx);
    const y1 = y + h - (x1 - hx);
    const x2 = Math.min(x + w, hx + h);
    const y2 = y + h - (x2 - hx);
    doc.line(x1, y1, x2, y2);
  }
}

function boardBar(doc: jsPDF, y: number, h: number, cuts: { length: number; label: string }[], remainder: number, labelSize = 7.5) {
  let x = MARGIN;
  for (const cut of cuts) {
    const w = (cut.length / 96) * CONTENT_W;
    doc.setFillColor(...COLORS.lumber);
    doc.rect(x, y, w, h, "F");
    doc.setDrawColor(...COLORS.paper);
    doc.setLineWidth(0.7);
    doc.line(x + w, y, x + w, y + h);
    if (w > 16) {
      setText(doc, labelSize, COLORS.lumberInk, "bold");
      doc.text(pdfText(`${cut.label} ${formatInches(cut.length)}`), x + w / 2, y + h / 2 + labelSize * 0.17, { align: "center" });
    }
    x += w;
  }
  const wasteW = (remainder / 96) * CONTENT_W;
  hatch(doc, x, y, wasteW, h);
  if (wasteW > 18) {
    setText(doc, 6.5, COLORS.muted, "bold");
    doc.setFillColor(...COLORS.waste);
    const label = pdfText(`${formatInches(remainder)} scrap`);
    const lw = doc.getTextWidth(label) + 2;
    doc.rect(x + wasteW / 2 - lw / 2, y + h / 2 - 1.8, lw, 3.4, "F");
    doc.text(label, x + wasteW / 2, y + h / 2 + 1.1, { align: "center" });
  }
  doc.setDrawColor(...COLORS.faint);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_W, h, "S");
}

function renderCutList(doc: jsPDF, cur: Cursor, plan: CompleteDIYPlan) {
  const total = plan.cutBoards.length + plan.railBoards.boards;
  cur.y = heading(doc, "Cut list", `${total} boards, cut to plan`, cur.y);

  // Parts per module type
  for (const t of plan.moduleTypes) {
    const h = 10 + t.parts.length * 5.5;
    cur.ensure(h + 4);
    card(doc, MARGIN, cur.y, CONTENT_W, h);
    kicker(
      doc,
      plan.moduleTypes.length > 1 || t.count > 1
        ? `${moduleTypeTitle(t)} (${t.cols}×${t.rows}) — for each of ${t.count} module${t.count > 1 ? "s" : ""}`
        : `Parts — ${moduleTypeTitle(t)} (${t.cols}×${t.rows})`,
      MARGIN + 4,
      cur.y + 5.5,
      COLORS.muted,
      6.5,
    );
    let y = cur.y + 11;
    for (const p of t.parts) {
      setText(doc, 9, COLORS.ink, "bold");
      doc.text(`${p.qty} ×`, MARGIN + 4, y);
      setText(doc, 9, COLORS.body);
      doc.text(pdfText(p.name), MARGIN + 16, y);
      setText(doc, 9, COLORS.ink, "bold");
      doc.text(pdfText(p.length), MARGIN + 60, y);
      setText(doc, 8.5, COLORS.muted);
      doc.text(pdfText(p.material), MARGIN + 100, y);
      y += 5.5;
    }
    cur.y += h + 4;
  }

  cur.ensure(30);
  cur.y += 2;
  kicker(doc, "Board layout", MARGIN, cur.y);
  cur.y += 4;
  setText(doc, 8.5, COLORS.body);
  cur.y = paragraph(
    doc,
    `Each bar is one 2×4×8' board (96"), to scale. Tan is a cut, labeled with the modules it's for; hatched is scrap. ${plan.cutBoards.length} boards for uprights and plates, plus ${plan.railBoards.boards} ripped into rails and back braces.`,
    MARGIN,
    cur.y + 1,
    CONTENT_W,
    8.5,
  ) + 3;

  const barH = 9;
  for (const group of groupBoards(plan.cutBoards)) {
    cur.ensure(barH + 10);
    setText(doc, 8.5, COLORS.ink, "bold");
    doc.text(group.count > 1 ? `Cut ${group.count} boards like this` : "Cut 1 board like this", MARGIN, cur.y);
    cur.y += 2.5;
    boardBar(doc, cur.y, barH, group.board.cuts, group.board.remainder);
    cur.y += barH + 6;
  }

  // Rail boards — one 2×4 ripped in half, three 30" pieces per half
  cur.ensure(30);
  setText(doc, 8.5, COLORS.ink, "bold");
  doc.text(
    `Rip ${plan.railBoards.boards} board${plan.railBoards.boards === 1 ? "" : "s"} like this — 6 pieces each: ${plan.railBoards.rails} rails + ${plan.railBoards.braces} back braces`,
    MARGIN,
    cur.y,
  );
  cur.y += 2.5;
  const halfH = 5.5;
  const railCuts = Array.from({ length: 3 }, () => ({ length: 30, label: "Rail / brace" }));
  boardBar(doc, cur.y, halfH, railCuts, 6, 6.5);
  boardBar(doc, cur.y + halfH + 0.8, halfH, railCuts, 6, 6.5);
  cur.y += halfH * 2 + 0.8 + 4;
  setText(doc, 7.5, COLORS.muted);
  doc.text('Rip down the middle (fence at 1-11/16"), then crosscut each half into 3 pieces at 30" — about 5-5/8" scrap per half.', MARGIN, cur.y);
  cur.y += 8;

  cur.ensure(20);
  kicker(doc, "Rails & plywood", MARGIN, cur.y);
  cur.y += 6;
  plan.plywoodNotes.forEach((note, i) => {
    const h = measure(doc, note, CONTENT_W - 9, 9);
    cur.ensure(h + 2);
    doc.setFillColor(...COLORS.accent);
    doc.circle(MARGIN + 2.6, cur.y - 1.2, 2.6, "F");
    setText(doc, 7.5, COLORS.ink, "bold");
    doc.text(String(i + 1), MARGIN + 2.6, cur.y - 0.1, { align: "center" });
    setText(doc, 9, COLORS.body);
    cur.y = paragraph(doc, note, MARGIN + 8, cur.y, CONTENT_W - 9, 9) + 2;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 05 Build process
// ═══════════════════════════════════════════════════════════════════════════

function renderModuleIntro(
  doc: jsPDF,
  cur: Cursor,
  t: PlanModuleTypeBuild,
  layout: DesignLayout,
  hero: string | undefined,
) {
  cur.newPage();
  kicker(doc, `Build process · ${moduleTypeTitle(t)}`, MARGIN, cur.y);
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
  card(doc, MARGIN, cur.y, CONTENT_W, mapH);
  kicker(doc, "Where it goes", MARGIN + 4, cur.y + 5, COLORS.muted, 6.5);
  drawSystemMap(doc, layout, { x: MARGIN + 4, y: cur.y + 7, w: CONTENT_W - 8, h: mapH - 9 }, { highlight: (m) => m.type === t.letter });
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

/** Yellow number badge. */
function stepBadge(doc: jsPDF, n: number, x: number, y: number, r: number) {
  doc.setFillColor(...COLORS.accent);
  doc.circle(x, y, r, "F");
  setText(doc, r * 2.1, COLORS.ink, "bold");
  doc.text(String(n), x, y + r * 0.36, { align: "center" });
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

  stepBadge(doc, step.stepNumber, MARGIN + 6, cur.y - 1.5, 6);
  kicker(doc, `Build process · ${eyebrow}Step ${step.stepNumber} of ${total}`, MARGIN + 15, cur.y - 3.5, COLORS.accentInk, 7);
  setText(doc, 16, COLORS.ink, "bold");
  doc.text(pdfText(step.title), MARGIN + 15, cur.y + 2.5);
  cur.y += 10;

  // Shrink the render (never below ~half size) so the whole step fits on its page
  const imgW = CONTENT_W;
  const room = BODY_BOTTOM - cur.y - 7 - stepBodyHeight(doc, step) - (jigLine ? 7 : 0);
  const imgH = Math.max(imgW * 0.34, Math.min(imgW * 0.62, room));
  card(doc, MARGIN, cur.y, imgW, imgH);
  addImageSafe(doc, image, MARGIN + 0.5, cur.y + 0.5, imgW - 1, imgH - 1, `Step ${step.stepNumber}`);
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
    card(doc, MARGIN, top, CONTENT_W, boxH);

    const column = (title: string, lines: string[], x: number, w: number) => {
      kicker(doc, title, x + 3, top + 5.5, COLORS.muted, 6.5);
      let y = top + 10.5;
      for (const line of lines) {
        doc.setFillColor(...COLORS.accent);
        doc.circle(x + 4, y - 1.1, 0.8, "F");
        setText(doc, 9, COLORS.body);
        y = paragraph(doc, line, x + 6, y, w - 6, 9) + 1;
      }
    };
    if (partLines.length) column("You'll need", partLines, MARGIN, leftW);
    if (toolLines.length) column("Tools", toolLines, MARGIN + leftW + gap, rightW);
    cur.y = top + boxH + 4;
  }

  if (step.screwType) {
    const text = `${step.screwType.label} — ${step.screwType.description}`;
    const h = measure(doc, text, CONTENT_W - 30, 9) + 5;
    cur.ensure(h);
    doc.setFillColor(...COLORS.fastenerBg);
    doc.roundedRect(MARGIN, cur.y, CONTENT_W, h, 2, 2, "F");
    kicker(doc, "Fastener", MARGIN + 3, cur.y + 5.2, COLORS.fastenerInk, 7);
    setText(doc, 9, COLORS.ink);
    paragraph(doc, text, MARGIN + 25, cur.y + 5.2, CONTENT_W - 30, 9);
    cur.y += h + 3;
  }

  if (step.proTip) {
    const h = measure(doc, step.proTip, CONTENT_W - 30, 9) + 5;
    cur.ensure(h);
    doc.setFillColor(...COLORS.tipBg);
    doc.roundedRect(MARGIN, cur.y, CONTENT_W, h, 2, 2, "F");
    kicker(doc, "Pro tip", MARGIN + 3, cur.y + 5.2, COLORS.accentInk, 7);
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

function renderUnitAssembly(doc: jsPDF, cur: Cursor, unit: PlanUnit, layout: DesignLayout, unitCount: number) {
  cur.newPage();
  kicker(doc, unitCount > 1 ? `Build process · Unit ${unit.letter} · ${unit.index + 1} of ${unitCount}` : "Build process · Final assembly", MARGIN, cur.y);
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
  card(doc, MARGIN, cur.y, CONTENT_W, mapH);
  drawSystemMap(doc, layout, { x: MARGIN + 4, y: cur.y + 4, w: CONTENT_W - 8, h: mapH - 6 }, {
    highlight: (m) => m.unitIndex === unit.index,
    dimensions: true,
  });
  cur.y += mapH + 8;

  for (const step of unit.assemblySteps) {
    // Keep each heading with at least its instruction
    cur.ensure(9 + measure(doc, step.instruction, CONTENT_W, 10.5) + 12);
    stepBadge(doc, step.stepNumber, MARGIN + 5, cur.y - 1.3, 5);
    setText(doc, 13, COLORS.ink, "bold");
    doc.text(pdfText(step.title), MARGIN + 13, cur.y + 0.8);
    cur.y += 9;
    renderStepBody(doc, cur, step);
    cur.y += 2;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 06 Good to know — notes, ladder jig, the interactive guide
// ═══════════════════════════════════════════════════════════════════════════

/** Small "ladder jig" box; returns nothing when there's no link. */
function jigCallout(doc: jsPDF, cur: Cursor, links: DIYPDFInput["links"]) {
  if (!links?.jigUrl) return;
  const h = 15;
  cur.ensure(h + 2);
  const top = cur.y;
  card(doc, MARGIN, top, CONTENT_W, h);
  drawIcon(doc, "clamp", MARGIN + 2, top + 2, h - 4);
  kicker(doc, "Ladder jig", MARGIN + h + 1, top + 5.5, COLORS.accentInk, 6.5);
  setText(doc, 9.5, COLORS.ink, "bold");
  doc.text(
    links.jigOwned ? "You have the ladder jig plans — build it before your ladder frames." : "Build a ladder jig first — every ladder frame square and identical.",
    MARGIN + h + 20,
    top + 5.5,
  );
  setText(doc, 8.5, COLORS.link, "bold");
  const label = links.jigOwned ? "Open my jig plans" : `Get the jig plans — ${formatPlanPrice(LADDER_JIG_OWNER_PRICE)} for plan owners`;
  doc.textWithLink(label, MARGIN + h + 1, top + 11.5, { url: links.jigUrl });
  cur.y = top + h + 4;
}

function renderGoodToKnow(doc: jsPDF, cur: Cursor, plan: CompleteDIYPlan, links: DIYPDFInput["links"]) {
  cur.y = heading(doc, "Extra notes", "Good to know", cur.y);
  bullets(doc, cur, plan.generalNotes);
  jigCallout(doc, cur, links);
  if (links) renderGuidePage(doc, cur, links);
}

function renderGuidePage(doc: jsPDF, cur: Cursor, links: NonNullable<DIYPDFInput["links"]>) {
  const url = links.upgradeUrl ?? links.guideUrl;
  if (url) {
    const upgrade = !!links.upgradeUrl;
    cur.ensure(70);
    if (cur.y > BODY_TOP) cur.y += 4;
    const top = cur.y;
    const h = 62;
    doc.setFillColor(...COLORS.black);
    doc.roundedRect(MARGIN, top, CONTENT_W, h, 3, 3, "F");
    doc.setFillColor(...COLORS.accent);
    doc.rect(MARGIN, top, CONTENT_W, 1.4, "F");

    kicker(doc, upgrade ? "See it in 3D" : "Your interactive guide", MARGIN + 8, top + 12, COLORS.accent);
    setText(doc, 17, COLORS.white, "bold");
    doc.text(
      upgrade
        ? `Add the Interactive 3D Build Guide — ${formatPlanPrice(TOTE_PLAN_UPGRADE_PRICE)}`
        : "Build along with the interactive 3D guide",
      MARGIN + 8,
      top + 22,
    );
    setText(doc, 10, COLORS.coverMuted);
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
    doc.roundedRect(MARGIN + 8, btnY, btnW, 10, 5, 5, "F");
    setText(doc, 10, COLORS.ink, "bold");
    doc.text(upgrade ? "Upgrade my plan" : "Open my guide", MARGIN + 8 + btnW / 2, btnY + 6.6, { align: "center" });
    doc.link(MARGIN + 8, btnY, btnW, 10, { url });

    setText(doc, 7.5, COLORS.coverMuted);
    doc.textWithLink(pdfText(url.replace(/^https?:\/\//, "")), MARGIN + 8 + btnW + 6, btnY + 6.3, { url });
    cur.y = top + h + 4;
  }

  if (links.libraryUrl) {
    cur.ensure(10);
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

function stampPages(doc: jsPDF, plan: CompleteDIYPlan, licensedTo?: string) {
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    kicker(doc, "Storage Network", MARGIN, 12, COLORS.accentInk, 7);
    setText(doc, 7.5, COLORS.muted);
    doc.text(pdfText(`${plan.name} — DIY Build Plan`), PAGE_W - MARGIN, 12, { align: "right" });
    doc.setDrawColor(...COLORS.cardLine);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, 14.5, PAGE_W - MARGIN, 14.5);

    setText(doc, 7.5, COLORS.muted);
    if (licensedTo) {
      // Personal copy — the buyer's email on every page discourages passing it on.
      doc.text(pdfText(licensedTo), MARGIN, PAGE_H - 9);
      doc.text(`Page ${p} of ${total}`, PAGE_W - MARGIN, PAGE_H - 9, { align: "right" });
    } else {
      doc.text(pdfText(plan.name), MARGIN, PAGE_H - 9);
      doc.text(`Page ${p} of ${total}`, PAGE_W - MARGIN, PAGE_H - 9, { align: "right" });
    }
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
  const contentsPage = cur.page; // filled in once page numbers are known

  const sections: Section[] = [];
  const section = (num: string, title: string, render: () => void) => {
    cur.newPage();
    sections.push({ num, title, page: cur.page });
    render();
  };

  section("01", "Design", () => renderDesign(doc, cur, plan, layout));
  section("02", "Shopping List", () => renderShopping(doc, cur, plan));
  section("03", "Tools & Safety", () => renderTools(doc, cur, plan));
  section("04", "Cut List", () => renderCutList(doc, cur, plan));
  sections.push({ num: "05", title: "Build Process", page: cur.page + 1 });

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
        multi ? `${moduleTypeTitle(t)} · ` : "",
        input.links,
      );
    }
  }

  for (const unit of plan.units) {
    if (unit.assemblySteps.length > 0) renderUnitAssembly(doc, cur, unit, layout, plan.units.length);
  }

  section("06", "Good to Know", () => renderGoodToKnow(doc, cur, plan, input.links));

  renderContents(doc, contentsPage, plan, sections);
  stampPages(doc, plan, input.licensedTo);
  return doc;
}

export function downloadDIYPDF(input: DIYPDFInput): void {
  const slug = input.plan.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Tote-Organizer";
  generateDIYPDF(input).save(`Build-Plan-${slug}.pdf`);
}
