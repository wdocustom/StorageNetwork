// ═══════════════════════════════════════════════════════════════════════════
// LADDER JIG PDF — the printable jig plans, in the same "e-workbook" style
// as the tote organizer plans (diy-pdf-generator), built from its own
// building blocks (pdfKit) so every Storage Network PDF looks like one family.
//
//   Cover        black + yellow, the jig with a ladder in it
//   Contents     sections + at a glance + read me first
//   01 The Jig   dimensioned top view (to scale), the six rail marks
//   02 Shopping  materials · 03 Tools & Safety
//   04 Cut List  parts, the OSB rip and the three 2×4s drawn to scale
//   05 Build the Jig   one drawing per step
//   06 Use the Jig     loading uprights, rails on the lines, fasten, repeat
//   07 Good to Know
//
// Content comes from ladderJigContent() (the server sends it to buyers and
// installers who own the plans); this file only lays it out, in the browser.
// ═══════════════════════════════════════════════════════════════════════════

import jsPDF from "jspdf";
import { pdfKit, type PdfCursor, type PdfRGB } from "@/lib/diy-pdf-generator";
import type { JigDiagramKind, JigStep, LadderJigContent } from "@/lib/ladder-jig-content";
import { LADDER_JIG_NAME, LADDER_JIG_TAGLINE } from "@/lib/ladder-jig";

const {
  PAGE_W,
  PAGE_H,
  MARGIN,
  CONTENT_W,
  BODY_TOP,
  COLORS,
  pdfText,
  setText,
  paragraph,
  measure,
  checkbox,
  kicker,
  heading,
  pill,
  card,
  formatInches,
  drawIcon,
  iconFor,
  hatch,
  stepBadge,
  bullets,
  Cursor,
} = pdfKit;

export interface LadderJigPDFInput {
  content: LadderJigContent;
  /** Cover + every page footer, e.g. "Licensed to jo@example.com · Order SN-…" */
  licensedTo?: string;
  /** "installer": the copy on the installer dashboard (cover line only) */
  edition?: "diy" | "installer";
  /** Storage Network wordmark as a PNG data URL (the browser loads it; tests omit it) */
  logoDataUrl?: string;
  links?: {
    /** Their tote plans (My Builds), shown on the last page */
    libraryUrl?: string;
  };
}

// ── Jig geometry (inches) ───────────────────────────────────────────────────
const L = 96; // base length
const W = 37; // base width
const RAIL = 3.5; // 2×4 laid flat
const STOP = 1.5; // stop block thickness (2×4 on edge)
const GAP = 30; // between the rails
const LADDER_RAIL = 1.6; // a ripped 2×4 rail, laid flat

const OSB: PdfRGB = [226, 212, 182];
const OSB_EDGE: PdfRGB = [196, 176, 138];
const MARK: PdfRGB = [225, 29, 72]; // rose-600: the lines you draw
const DARK_PANEL: PdfRGB = [28, 28, 28];

type Part = "base" | "railA" | "railB" | "stop" | "marks" | "uprights" | "rails" | "screws";
const ORDER: Part[] = ["base", "railA", "railB", "stop", "marks", "uprights", "rails", "screws"];

/** What a step's drawing shows, and which part is new in it. */
function stage(kind: JigDiagramKind): { upTo: Part; highlight: Part[] } {
  switch (kind) {
    case "railA":
      return { upTo: "railA", highlight: ["railA"] };
    case "railB":
      return { upTo: "railB", highlight: ["railB"] };
    case "stop":
      return { upTo: "stop", highlight: ["stop"] };
    case "marks":
      return { upTo: "marks", highlight: ["marks"] };
    case "uprights":
      return { upTo: "uprights", highlight: ["uprights"] };
    case "rails":
      return { upTo: "rails", highlight: ["rails"] };
    case "screws":
      return { upTo: "screws", highlight: ["screws"] };
    case "repeat":
      return { upTo: "screws", highlight: ["uprights", "rails"] };
    default:
      return { upTo: "screws", highlight: [] };
  }
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Top view of the jig, to scale. The stop block is on the left; Rail A along
 * the top edge, Rail B along the bottom, 30" apart.
 */
function drawJig(
  doc: jsPDF,
  box: Box,
  marks: number[],
  opts: { upTo?: Part; highlight?: Part[]; dims?: boolean; markLabels?: boolean; dark?: boolean } = {},
) {
  const upTo = ORDER.indexOf(opts.upTo ?? "screws");
  const has = (p: Part) => ORDER.indexOf(p) <= upTo;
  const hi = (p: Part) => (opts.highlight ?? []).includes(p);
  const padX = opts.dims ? 10 : 2;
  const padBottom = opts.dims || opts.markLabels ? 13 : 2;
  const s = Math.min((box.w - padX * 2) / L, (box.h - 4 - padBottom) / W);
  const ox = box.x + (box.w - L * s) / 2;
  const oy = box.y + 4 + (box.h - 4 - padBottom - W * s) / 2;
  const X = (inch: number) => ox + inch * s;
  const Y = (inch: number) => oy + inch * s;

  const part = (x: number, y: number, w: number, h: number, fill: PdfRGB, edge: PdfRGB, lit: boolean, dashed = false) => {
    doc.setFillColor(...(lit ? COLORS.accent : fill));
    doc.setDrawColor(...(lit ? COLORS.accentInk : edge));
    doc.setLineWidth(lit ? 0.5 : 0.25);
    if (dashed) doc.setLineDashPattern([0.8, 0.6], 0);
    doc.rect(X(x), Y(y), w * s, h * s, "FD");
    doc.setLineDashPattern([], 0);
  };

  // Base
  part(0, 0, L, W, OSB, OSB_EDGE, hi("base"));
  // Rails (2×4 flat), flush along the long edges, 30" apart
  if (has("railA")) part(0, 0, L, RAIL, COLORS.lumber, COLORS.lumberDark, hi("railA"));
  if (has("railB")) part(0, W - RAIL, L, RAIL, COLORS.lumber, COLORS.lumberDark, hi("railB"));
  // Stop block between the rails
  if (has("stop")) part(0, RAIL, STOP, GAP, COLORS.lumberDark, COLORS.lumberInk, hi("stop"));

  // Rail lines: measured from the stop block's inside face
  if (has("marks")) {
    doc.setDrawColor(...MARK);
    doc.setLineWidth(hi("marks") ? 0.5 : 0.3);
    for (const m of marks) {
      const x = X(STOP + m);
      doc.line(x, Y(0), x, Y(RAIL));
      doc.line(x, Y(W - RAIL), x, Y(W));
      doc.setLineDashPattern([0.9, 0.7], 0);
      doc.line(x, Y(RAIL), x, Y(W - RAIL));
      doc.setLineDashPattern([], 0);
    }
  }

  // A ladder being built: two uprights against the rails, rails across them
  const upLen = Math.min(L - STOP, (marks[marks.length - 1] ?? 90) + 3);
  if (has("uprights")) {
    part(STOP, RAIL, upLen, RAIL, COLORS.lumberLight, COLORS.lumberDark, hi("uprights"), true);
    part(STOP, W - 2 * RAIL, upLen, RAIL, COLORS.lumberLight, COLORS.lumberDark, hi("uprights"), true);
  }
  if (has("rails")) {
    for (const m of marks) {
      part(STOP + m - LADDER_RAIL, RAIL, LADDER_RAIL, GAP, COLORS.lumber, COLORS.lumberInk, hi("rails"));
    }
  }
  if (has("screws")) {
    doc.setFillColor(...(hi("screws") ? COLORS.fastenerInk : COLORS.ink));
    for (const m of marks) {
      const cx = X(STOP + m - LADDER_RAIL / 2);
      for (const yy of [RAIL + 1.1, RAIL + 2.4, W - 2 * RAIL + 1.1, W - 2 * RAIL + 2.4]) {
        doc.circle(cx, Y(yy), Math.max(0.35, 0.28 * s), "F");
      }
    }
  }

  const ink = opts.dark ? COLORS.coverMuted : COLORS.muted;
  if (opts.markLabels && has("marks")) {
    setText(doc, 7, MARK, "bold");
    for (const m of marks) doc.text(pdfText(formatInches(m)), X(STOP + m), Y(W) + 4, { align: "center" });
  }

  if (opts.dims) {
    dim(doc, X(0), Y(W) + (opts.markLabels ? 9 : 5), X(L), Y(W) + (opts.markLabels ? 9 : 5), `${L}" long`, ink);
    vdim(doc, X(L) + 4, Y(0), Y(W), `${W}"`, ink);
    vdim(doc, X(0) - 4, Y(RAIL), Y(W - RAIL), `${GAP}"`, ink, true);
  }
}

/** Horizontal dimension line with ticks and a centered label. */
function dim(doc: jsPDF, x1: number, y: number, x2: number, _y2: number, label: string, color: PdfRGB) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.25);
  doc.line(x1, y, x2, y);
  doc.line(x1, y - 1.3, x1, y + 1.3);
  doc.line(x2, y - 1.3, x2, y + 1.3);
  setText(doc, 7, color, "bold");
  const t = pdfText(label);
  const tw = doc.getTextWidth(t) + 3;
  doc.setFillColor(...COLORS.paper);
  doc.rect((x1 + x2) / 2 - tw / 2, y - 1.8, tw, 3.6, "F");
  doc.text(t, (x1 + x2) / 2, y + 1, { align: "center" });
}

/** Vertical dimension line; `left` puts the label on the left of it. */
function vdim(doc: jsPDF, x: number, y1: number, y2: number, label: string, color: PdfRGB, left = false) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.25);
  doc.line(x, y1, x, y2);
  doc.line(x - 1.3, y1, x + 1.3, y1);
  doc.line(x - 1.3, y2, x + 1.3, y2);
  setText(doc, 7, color, "bold");
  doc.text(pdfText(label), left ? x - 1.5 : x + 1.5, (y1 + y2) / 2 + 1, { align: left ? "right" : "left" });
}

/** The 4'×8' sheet with the 37" piece kept and the 11" offcut, to scale. */
function drawSheet(doc: jsPDF, box: Box, highlightKeep = true) {
  const s = Math.min((box.w - 20) / 96, (box.h - 14) / 48);
  const ox = box.x + (box.w - 96 * s) / 2;
  const oy = box.y + 4 + (box.h - 14 - 48 * s) / 2;
  const keepH = 37 * s;
  doc.setFillColor(...(highlightKeep ? COLORS.accent : OSB));
  doc.setDrawColor(...(highlightKeep ? COLORS.accentInk : OSB_EDGE));
  doc.setLineWidth(highlightKeep ? 0.5 : 0.25);
  doc.rect(ox, oy, 96 * s, keepH, "FD");
  hatch(doc, ox, oy + keepH, 96 * s, 11 * s);
  doc.setDrawColor(...COLORS.faint);
  doc.setLineWidth(0.3);
  doc.rect(ox, oy, 96 * s, 48 * s, "S");
  // rip line
  doc.setDrawColor(...MARK);
  doc.setLineWidth(0.45);
  doc.setLineDashPattern([1.4, 0.9], 0);
  doc.line(ox - 3, oy + keepH, ox + 96 * s + 3, oy + keepH);
  doc.setLineDashPattern([], 0);

  setText(doc, 9, COLORS.ink, "bold");
  doc.text(pdfText('Keep: 37" × 96" base'), ox + (96 * s) / 2, oy + keepH / 2, { align: "center" });
  setText(doc, 7, COLORS.muted);
  doc.text("factory edge", ox + 2, oy + 3.6);
  setText(doc, 7, COLORS.muted, "bold");
  if (11 * s > 4) doc.text(pdfText('11" offcut'), ox + (96 * s) / 2, oy + keepH + (11 * s) / 2 + 1.2, { align: "center" });
  vdim(doc, ox + 96 * s + 5, oy, oy + keepH, '37"', COLORS.muted);
  vdim(doc, ox - 5, oy, oy + 48 * s, '48"', COLORS.muted, true);
  dim(doc, ox, oy + 48 * s + 5, ox + 96 * s, oy + 48 * s + 5, '96"', COLORS.muted);
}

// ── Cover ───────────────────────────────────────────────────────────────────

function renderCover(doc: jsPDF, input: LadderJigPDFInput) {
  const { content } = input;
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, 3, PAGE_H, "F");

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

  kicker(doc, input.edition === "installer" ? "Shop jig plans · Installer edition" : "Shop jig plans · For your tote racks", MARGIN, 45, COLORS.accent, 8.5);
  setText(doc, 30, COLORS.white, "bold");
  doc.text(pdfText(LADDER_JIG_NAME.toUpperCase()), MARGIN, 58);
  setText(doc, 9.5, COLORS.coverMuted);
  let y = paragraph(doc, `${LADDER_JIG_TAGLINE} Lay two uprights in, set each rail on its line, screw.`, MARGIN, 66, CONTENT_W, 9.5) + 4;

  const heroH = 104;
  doc.setFillColor(...DARK_PANEL);
  doc.roundedRect(MARGIN, y, CONTENT_W, heroH, 3, 3, "F");
  drawJig(doc, { x: MARGIN + 6, y: y + 6, w: CONTENT_W - 12, h: heroH - 12 }, content.marks, {
    upTo: "screws",
    highlight: [],
    markLabels: true,
    dark: true,
  });
  y += heroH + 9;

  const boards = content.materials.find((m) => /2\s*[x×]\s*4/i.test(m.item))?.qty ?? 3;
  const screws = content.materials.find((m) => /screw/i.test(m.item))?.qty ?? 38;
  const tags = ["1 sheet of OSB", `${boards} 2×4×8' boards`, `${screws} screws`, "About an hour"];
  let tx = MARGIN;
  for (const tag of tags) tx += pill(doc, tag, tx, y, 8.5) + 2.5;
  y += 10;

  const stats: [string, string][] = [
    ["Length", `${L}"`],
    ["Width", `${W}"`],
    ["Between rails", `${GAP}"`],
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
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, PAGE_H - 16, PAGE_W - MARGIN, PAGE_H - 16);
  setText(doc, 8.5, COLORS.accent, "bold");
  doc.text("STORAGE-NETWORK.APP", MARGIN, PAGE_H - 9.5);
  setText(doc, 8, COLORS.coverMuted);
  doc.text("Build every ladder square, fast, and identical.", PAGE_W - MARGIN, PAGE_H - 9.5, { align: "right" });
}

// ── Contents ────────────────────────────────────────────────────────────────

interface Section {
  num: string;
  title: string;
  page: number;
}

function renderContents(doc: jsPDF, page: number, content: LadderJigContent, sections: Section[]) {
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
  const boards = content.materials.find((m) => /2\s*[x×]\s*4/i.test(m.item))?.qty ?? 3;
  const screws = content.materials.find((m) => /screw/i.test(m.item))?.qty ?? 38;
  const stats: [string, string][] = [
    ["Length", `${L}"`],
    ["Width", `${W}"`],
    ["Between rails", `${GAP}"`],
    ["Rail marks", String(content.marks.length)],
    ["2×4×8' boards", String(boards)],
    ['2" screws', String(screws)],
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
  doc.roundedRect(MARGIN, y, CONTENT_W, 22, 2, 2, "F");
  kicker(doc, "Read me first", MARGIN + 5, y + 6.5);
  setText(doc, 9.5, COLORS.ink);
  paragraph(
    doc,
    "Build the jig once, on a flat floor, and it squares every ladder frame in every rack you build. The rails set the width, the stop block sets the bottom, and the lines set every tote rail. Take your time on steps 3 to 5: everything after depends on them.",
    MARGIN + 5,
    y + 12,
    CONTENT_W - 10,
    9.5,
  );
}

// ── 01 The jig ─────────────────────────────────────────────────────────────

function renderTheJig(doc: jsPDF, cur: PdfCursor, content: LadderJigContent) {
  cur.y = heading(doc, "The jig", "Dimensioned drawing", cur.y);
  const h = 92;
  card(doc, MARGIN, cur.y, CONTENT_W, h);
  kicker(doc, "Top view · Drawn to scale", MARGIN + 4, cur.y + 6, COLORS.muted, 6.5);
  drawJig(doc, { x: MARGIN + 2, y: cur.y + 7, w: CONTENT_W - 4, h: h - 9 }, content.marks, {
    upTo: "marks",
    dims: true,
    markLabels: true,
  });
  cur.y += h + 4;

  // Legend
  const legend: [PdfRGB, string][] = [
    [OSB, '1/2" OSB base'],
    [COLORS.lumber, "2×4 rails (A top, B bottom)"],
    [COLORS.lumberDark, "Stop block"],
    [MARK, "Rail lines"],
  ];
  let lx = MARGIN;
  for (const [color, label] of legend) {
    doc.setFillColor(...color);
    doc.roundedRect(lx, cur.y - 2.6, 3.2, 3.2, 0.6, 0.6, "F");
    setText(doc, 8, COLORS.body);
    doc.text(pdfText(label), lx + 4.6, cur.y);
    lx += doc.getTextWidth(pdfText(label)) + 12;
  }
  cur.y += 10;

  kicker(doc, "Rail marks", MARGIN, cur.y);
  cur.y += 3;
  const n = content.marks.length;
  const gap = 3;
  const cw = (CONTENT_W - gap * (n - 1)) / n;
  content.marks.forEach((m, i) => {
    const x = MARGIN + i * (cw + gap);
    card(doc, x, cur.y, cw, 17);
    kicker(doc, `#${i + 1}`, x + cw / 2 - 2, cur.y + 5.5, MARK, 6.5);
    setText(doc, 15, COLORS.ink, "bold");
    doc.text(pdfText(formatInches(m)), x + cw / 2, cur.y + 13, { align: "center" });
  });
  cur.y += 22;
  setText(doc, 9.5, COLORS.body);
  cur.y = paragraph(
    doc,
    "Measure every mark from the inside face of the stop block (the bottom of your uprights), on both rails. Each line is the TOP edge of a tote rail.",
    MARGIN,
    cur.y + 1,
    CONTENT_W,
    9.5,
  ) + 4;
}

// ── 02 Shopping · 03 Tools & safety ─────────────────────────────────────────

function renderShopping(doc: jsPDF, cur: PdfCursor, content: LadderJigContent) {
  cur.y = heading(doc, "Shopping list", "Everything you need to buy", cur.y);
  const rowH = 17;
  for (const m of content.materials) {
    cur.ensure(rowH + 2);
    card(doc, MARGIN, cur.y, CONTENT_W, rowH);
    drawIcon(doc, iconFor(m.item), MARGIN + 2.5, cur.y + 2.5, rowH - 5);
    const tx = MARGIN + rowH + 2;
    setText(doc, 10, COLORS.ink, "bold");
    doc.text(pdfText(m.item), tx, cur.y + 7);
    setText(doc, 8, COLORS.muted);
    doc.text(pdfText(m.note), tx, cur.y + 12);
    setText(doc, 14, COLORS.ink, "bold");
    doc.text(String(m.qty), PAGE_W - MARGIN - 4, cur.y + 10.5, { align: "right" });
    cur.y += rowH + 2;
  }
  setText(doc, 8.5, COLORS.body);
  cur.y = paragraph(
    doc,
    "Pick the straightest 2×4s in the pile — sight down each one. The two rails set the width of every ladder, so a bowed rail means a bowed frame.",
    MARGIN,
    cur.y + 3,
    CONTENT_W,
    8.5,
  ) + 8;
}

function renderTools(doc: jsPDF, cur: PdfCursor, content: LadderJigContent) {
  cur.ensure(60);
  cur.y = heading(doc, "Tools & safety", "What you'll use", cur.y);
  const gap = 4;
  const w = (CONTENT_W - gap) / 2;
  const h = 15;
  content.tools.forEach((tool, i) => {
    if (i % 2 === 0) cur.ensure(h + gap);
    const x = MARGIN + (i % 2) * (w + gap);
    card(doc, x, cur.y, w, h);
    drawIcon(doc, iconFor(tool), x + 2.5, cur.y + 2.5, h - 5);
    setText(doc, 9.5, COLORS.ink, "bold");
    doc.text(pdfText(tool), x + h + 2, cur.y + h / 2 + 1.3);
    if (i % 2 === 1 || i === content.tools.length - 1) cur.y += h + gap;
  });
  cur.y += 4;
  cur.ensure(20);
  kicker(doc, "Safety", MARGIN, cur.y);
  cur.y += 6;
  bullets(doc, cur, content.safety);
}

// ── 04 Cut list ─────────────────────────────────────────────────────────────

function boardRow(doc: jsPDF, y: number, label: string, cuts: { length: number; label: string }[], remainder: number) {
  setText(doc, 9, COLORS.ink, "bold");
  doc.text(pdfText(label), MARGIN, y);
  const top = y + 2;
  const h = 8;
  let x = MARGIN;
  for (const c of cuts) {
    const w = (c.length / 96) * CONTENT_W;
    doc.setFillColor(...COLORS.lumber);
    doc.rect(x, top, w, h, "F");
    doc.setDrawColor(...COLORS.paper);
    doc.setLineWidth(0.7);
    doc.line(x + w, top, x + w, top + h);
    setText(doc, 7.5, COLORS.lumberInk, "bold");
    doc.text(pdfText(`${c.label} ${formatInches(c.length)}`), x + w / 2, top + h / 2 + 1.3, { align: "center" });
    x += w;
  }
  const ww = (remainder / 96) * CONTENT_W;
  if (remainder > 0) {
    hatch(doc, x, top, ww, h);
    setText(doc, 6.5, COLORS.muted, "bold");
    doc.text(pdfText(`${formatInches(remainder)} offcut`), x + ww / 2, top + h / 2 + 1.1, { align: "center" });
  }
  doc.setDrawColor(...COLORS.faint);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, top, CONTENT_W, h, "S");
  return top + h + 6;
}

function renderCutList(doc: jsPDF, cur: PdfCursor, content: LadderJigContent) {
  cur.y = heading(doc, "Cut list", "4 pieces, 2 cuts", cur.y);

  const rowH = 6;
  const h = 10 + content.cutList.length * rowH;
  card(doc, MARGIN, cur.y, CONTENT_W, h);
  kicker(doc, "Parts", MARGIN + 4, cur.y + 6, COLORS.muted, 6.5);
  let y = cur.y + 12;
  for (const c of content.cutList) {
    setText(doc, 9, COLORS.ink, "bold");
    doc.text(`${c.qty} ×`, MARGIN + 4, y);
    doc.text(pdfText(c.piece), MARGIN + 14, y);
    doc.text(pdfText(c.dimensions), MARGIN + 52, y);
    setText(doc, 7.5, COLORS.muted);
    const note = (doc.splitTextToSize(pdfText(c.notes), CONTENT_W - 102) as string[])[0];
    doc.text(note, MARGIN + 96, y);
    y += rowH;
  }
  cur.y += h + 8;

  kicker(doc, "The OSB sheet", MARGIN, cur.y);
  cur.y += 2;
  const sheetH = 62;
  card(doc, MARGIN, cur.y, CONTENT_W, sheetH);
  drawSheet(doc, { x: MARGIN, y: cur.y, w: CONTENT_W, h: sheetH });
  cur.y += sheetH + 8;

  kicker(doc, "The three 2×4s", MARGIN, cur.y);
  cur.y += 6;
  cur.y = boardRow(doc, cur.y, "Board 1", [{ length: 96, label: "Rail A" }], 0);
  cur.y = boardRow(doc, cur.y, "Board 2", [{ length: 96, label: "Rail B" }], 0);
  cur.y = boardRow(doc, cur.y, "Board 3", [{ length: 30, label: "Stop block" }], 66);
  setText(doc, 8, COLORS.muted);
  cur.y = paragraph(doc, "Each bar is one 2×4×8' (96\"), to scale. Keep the 66\" offcut: it makes a handy straightedge for marking.", MARGIN, cur.y, CONTENT_W, 8) + 4;
}

// ── Steps ───────────────────────────────────────────────────────────────────

const DIAGRAM_H = 40;

/** Height renderJigStep uses, so a step is never split across pages. Keep in step with it. */
function stepBodyHeight(doc: jsPDF, step: JigStep): number {
  let h = 11 + DIAGRAM_H + 5 + measure(doc, step.detail, CONTENT_W, 10) + 3;
  const box = stepBoxHeight(doc, step);
  if (box) h += box + 3;
  if (step.tip) h += measure(doc, step.tip, CONTENT_W - 30, 9) + 5 + 3;
  return h + 7;
}

function stepBoxHeight(doc: jsPDF, step: JigStep): number {
  const parts = step.parts ?? [];
  const tools = step.tools ?? [];
  if (!parts.length && !tools.length) return 0;
  const [leftW, rightW] = boxColumns(step);
  const col = (lines: string[], w: number) => lines.reduce((h, l) => h + measure(doc, l, w - 6, 9) + 1, 0);
  return 10 + Math.max(col(parts, leftW), col(tools, rightW));
}

/** "You'll need" | "Tools" widths; one column takes the full width when the other is empty. */
function boxColumns(step: JigStep): [number, number] {
  const parts = step.parts?.length ?? 0;
  const tools = step.tools?.length ?? 0;
  if (!parts) return [0, CONTENT_W];
  if (!tools) return [CONTENT_W, 0];
  const left = CONTENT_W * 0.58;
  return [left, CONTENT_W - left - 6];
}

function renderJigStep(doc: jsPDF, cur: PdfCursor, step: JigStep, n: number, total: number, phase: string, marks: number[]) {
  cur.ensure(stepBodyHeight(doc, step) + 3);
  if (cur.y > BODY_TOP) cur.y += 3;
  stepBadge(doc, n, MARGIN + 6, cur.y + 1.5, 6);
  kicker(doc, `${phase} · Step ${n} of ${total}`, MARGIN + 15, cur.y - 0.5, COLORS.accentInk, 7);
  setText(doc, 15, COLORS.ink, "bold");
  doc.text(pdfText(step.title), MARGIN + 15, cur.y + 5.5);
  cur.y += 11;

  card(doc, MARGIN, cur.y, CONTENT_W, DIAGRAM_H);
  const box = { x: MARGIN + 2, y: cur.y + 1, w: CONTENT_W - 4, h: DIAGRAM_H - 2 };
  if (step.diagram === "sheet") drawSheet(doc, box);
  else {
    const st = stage(step.diagram);
    drawJig(doc, box, marks, { upTo: st.upTo, highlight: st.highlight, markLabels: step.diagram === "marks", dims: step.diagram === "railB" });
  }
  if (step.diagram === "repeat") pill(doc, "× every ladder in your rack", PAGE_W - MARGIN - 52, cur.y + 7, 7.5);
  cur.y += DIAGRAM_H + 5;

  setText(doc, 10, COLORS.ink);
  cur.y = paragraph(doc, step.detail, MARGIN, cur.y, CONTENT_W, 10) + 3;

  const parts = step.parts ?? [];
  const tools = step.tools ?? [];
  const boxH = stepBoxHeight(doc, step);
  if (boxH) {
    const top = cur.y;
    const [leftW, rightW] = boxColumns(step);
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
    if (parts.length) column("You'll need", parts, MARGIN, leftW);
    if (tools.length) column("Tools", tools, parts.length ? MARGIN + leftW + 6 : MARGIN, rightW);
    cur.y = top + boxH + 3;
  }

  if (step.tip) {
    const h = measure(doc, step.tip, CONTENT_W - 30, 9) + 5;
    doc.setFillColor(...COLORS.tipBg);
    doc.roundedRect(MARGIN, cur.y, CONTENT_W, h, 2, 2, "F");
    kicker(doc, "Pro tip", MARGIN + 3, cur.y + 5.2, COLORS.accentInk, 7);
    setText(doc, 9, COLORS.ink, "italic");
    paragraph(doc, step.tip, MARGIN + 25, cur.y + 5.2, CONTENT_W - 30, 9);
    cur.y += h + 3;
  }

  cur.y += 2;
  checkbox(doc, MARGIN, cur.y + 1, 4);
  setText(doc, 9, COLORS.muted, "bold");
  doc.text("Step complete", MARGIN + 6.5, cur.y + 0.6);
  cur.y += 6;
}

// ── 07 Good to know ─────────────────────────────────────────────────────────

function renderGoodToKnow(doc: jsPDF, cur: PdfCursor, input: LadderJigPDFInput) {
  cur.y = heading(doc, "Extra notes", "Good to know", cur.y);
  bullets(doc, cur, input.content.notes);
  const url = input.links?.libraryUrl;
  if (url) {
    cur.ensure(40);
    const top = cur.y + 2;
    const h = 34;
    doc.setFillColor(...COLORS.black);
    doc.roundedRect(MARGIN, top, CONTENT_W, h, 3, 3, "F");
    doc.setFillColor(...COLORS.accent);
    doc.rect(MARGIN, top, CONTENT_W, 1.4, "F");
    kicker(doc, "Your plans", MARGIN + 8, top + 10, COLORS.accent);
    setText(doc, 13, COLORS.white, "bold");
    doc.text("Your tote rack plans and guides live in My Builds", MARGIN + 8, top + 18);
    const btnW = 56;
    doc.setFillColor(...COLORS.accent);
    doc.roundedRect(MARGIN + 8, top + h - 13, btnW, 9, 4.5, 4.5, "F");
    setText(doc, 9.5, COLORS.ink, "bold");
    doc.text("Open My Builds", MARGIN + 8 + btnW / 2, top + h - 7.2, { align: "center" });
    doc.link(MARGIN + 8, top + h - 13, btnW, 9, { url });
    cur.y = top + h + 4;
  }
}

// ── Header / footer ─────────────────────────────────────────────────────────

function stampPages(doc: jsPDF, licensedTo?: string) {
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    kicker(doc, "Storage Network", MARGIN, 12, COLORS.accentInk, 7);
    setText(doc, 7.5, COLORS.muted);
    doc.text(pdfText(`${LADDER_JIG_NAME} — Build Plan`), PAGE_W - MARGIN, 12, { align: "right" });
    doc.setDrawColor(...COLORS.cardLine);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, 14.5, PAGE_W - MARGIN, 14.5);
    setText(doc, 7.5, COLORS.muted);
    doc.text(pdfText(licensedTo ?? LADDER_JIG_NAME), MARGIN, PAGE_H - 9);
    doc.text(`Page ${p} of ${total}`, PAGE_W - MARGIN, PAGE_H - 9, { align: "right" });
  }
}

// ── Entry points ────────────────────────────────────────────────────────────

export function generateLadderJigPDF(input: LadderJigPDFInput): jsPDF {
  const { content } = input;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  doc.setProperties({ title: `${LADDER_JIG_NAME} — Build Plan`, author: "Storage Network", subject: "Ladder building jig plans" });

  renderCover(doc, input);
  const cur = new Cursor(doc);
  cur.newPage();
  const contentsPage = cur.page;

  const sections: Section[] = [];
  const section = (num: string, title: string, render: () => void) => {
    cur.newPage();
    sections.push({ num, title, page: cur.page });
    render();
  };

  section("01", "The Jig", () => renderTheJig(doc, cur, content));
  section("02", "Shopping List, Tools & Safety", () => {
    renderShopping(doc, cur, content);
    renderTools(doc, cur, content);
  });
  section("03", "Cut List", () => renderCutList(doc, cur, content));
  const steps = content.buildSteps.length + content.useSteps.length;
  section("04", "Build the Jig", () => {
    cur.y = heading(doc, "Build the jig", "One jig, every ladder square", cur.y);
    content.buildSteps.forEach((s, i) => renderJigStep(doc, cur, s, i + 1, steps, "Build the jig", content.marks));
  });
  section("05", "Use the Jig", () => {
    cur.y = heading(doc, "Use the jig", "Building your ladder frames", cur.y);
    content.useSteps.forEach((s, i) =>
      renderJigStep(doc, cur, s, content.buildSteps.length + i + 1, steps, "Use the jig", content.marks),
    );
  });
  section("06", "Good to Know", () => renderGoodToKnow(doc, cur, input));

  renderContents(doc, contentsPage, content, sections);
  stampPages(doc, input.licensedTo);
  return doc;
}

export function downloadLadderJigPDF(input: LadderJigPDFInput): void {
  generateLadderJigPDF(input).save("Build-Plan-Ladder-Building-Jig.pdf");
}
