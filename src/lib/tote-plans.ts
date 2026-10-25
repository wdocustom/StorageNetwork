// ═══════════════════════════════════════════════════════════════════════════
// TOTE ORGANIZER PLANS — DIY plan products sold network-wide
//
// Two tiers, offered on /plans, in every installer's designer, on quote
// pages and in quote emails:
//   • "pdf"         — printable PDF build plan (cut list, shopping list,
//                     every assembly step rendered in 3D)
//   • "interactive" — everything in "pdf" PLUS lifetime access to the
//                     interactive 3D Assembly Guide installers use
//
// A plan covers a DESIGN: one or more freestanding units (a bestseller such
// as Indiana Joe is three units). Each unit is split into self-contained
// MODULES exactly the way the build engine splits it for installers —
// ≤4 totes wide so plates fit an 8' board, ≤6 totes tall per stacked tier
// so uprights do. Identical modules are grouped into MODULE TYPES (A, B…)
// so the customer builds each type once and repeats it.
//
// Purchases are guest checkouts recorded in public_plan_purchases under
// plan_id = TOTE_PLAN_ID, so one email address can recover every plan it
// bought via /plans "Resend my link".
//
// Client-safe: no server imports.
// ═══════════════════════════════════════════════════════════════════════════

import { BESTSELLER_PRESETS } from "@/lib/presets";
import { RAILS_2X4, upright2x4 } from "@/components/visualizer/assemblySteps";

export const TOTE_PLAN_ID = "tote-organizer";

export type TotePlanTier = "pdf" | "interactive";

export interface TotePlanTierInfo {
  id: TotePlanTier;
  name: string;
  tagline: string;
  /** Price in cents */
  price: number;
  includes: string[];
}

export const TOTE_PLAN_TIERS: Record<TotePlanTier, TotePlanTierInfo> = {
  pdf: {
    id: "pdf",
    name: "PDF Build Plan",
    tagline: "Print it, take it to the garage.",
    price: 1900,
    includes: [
      "Every assembly step rendered in 3D for your exact build",
      "Shopping list with exact quantities",
      "Board-by-board cut diagrams, including the 2×4 rail rips",
      "Tools checklist, fastener callouts, and pro tips",
    ],
  },
  interactive: {
    id: "interactive",
    name: "Interactive Build Guide",
    tagline: "The same 3D guide our pro installers build from.",
    price: 2900,
    includes: [
      "Everything in the PDF Build Plan",
      "Interactive 3D assembly guide — rotate, zoom, step through",
      "Builds one module at a time with a live map of your system",
      "Works on your phone in the garage, lifetime access",
    ],
  },
};

/** Cost to move an existing PDF purchase up to the interactive tier. */
export const TOTE_PLAN_UPGRADE_PRICE =
  TOTE_PLAN_TIERS.interactive.price - TOTE_PLAN_TIERS.pdf.price;

export function formatPlanPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function isTotePlanTier(value: unknown): value is TotePlanTier {
  return value === "pdf" || value === "interactive";
}

// ═══════════════════════════════════════════════════════════════════════════
// Design model
// ═══════════════════════════════════════════════════════════════════════════

export type TotePlanToteType = "HDX" | "GM";

/** One freestanding tote organizer, any size the designer allows. */
export interface TotePlanUnit {
  cols: number;
  rows: number;
  toteType: TotePlanToteType;
  hasWheels: boolean;
  hasTop: boolean;
}

export interface TotePlanDesign {
  units: TotePlanUnit[];
  /** Optional display name, e.g. a bestseller ("Indiana Joe") */
  name?: string;
}

export const TOTE_PLAN_LIMITS = {
  minCols: 1,
  maxCols: 24,
  minRows: 1,
  maxRows: 10, // the designer's own standard-unit maximum
  maxUnits: 8,
};

/** Build-engine split points (must match buildEngine.ts): plates fit an
 *  8' board up to 4 wide; a 2×4-rail upright is a full 8' stud at 6 high. */
export const MODULE_MAX_COLS = 4;
export const MODULE_MAX_ROWS = RAILS_2X4.maxRows;

const MAX_NAME_LENGTH = 40;

function cleanName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const name = raw.replace(/[^\p{L}\p{N} '&.\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  return name || undefined;
}

/** Validate one untrusted unit. Mini, sideways and 2×4-rail units aren't modeled. */
export function parseTotePlanUnit(raw: unknown): TotePlanUnit | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;

  if (c.unitType !== undefined && c.unitType !== "standard") return null;
  if (c.orientation !== undefined && c.orientation !== "standard") return null;
  if (c.use2x4Rails === true) return null;

  const cols = Number(c.cols);
  const rows = Number(c.rows);
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) return null;
  if (cols < TOTE_PLAN_LIMITS.minCols || cols > TOTE_PLAN_LIMITS.maxCols) return null;
  if (rows < TOTE_PLAN_LIMITS.minRows || rows > TOTE_PLAN_LIMITS.maxRows) return null;
  if (c.toteType !== "HDX" && c.toteType !== "GM") return null;

  return {
    cols,
    rows,
    toteType: c.toteType,
    hasWheels: c.hasWheels === true,
    hasTop: c.hasTop === true,
  };
}

/**
 * Validate an untrusted design. Accepts {units:[…], name?}, a single legacy
 * unit config ({cols, rows, toteType…} — purchases made before multi-unit
 * plans), or the compact string form. Returns null if ANY unit is invalid.
 */
export function parseTotePlanDesign(raw: unknown): TotePlanDesign | null {
  if (typeof raw === "string") return decodeTotePlanDesign(raw);
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;

  const rawUnits = Array.isArray(c.units) ? c.units : "cols" in c ? [c] : null;
  if (!rawUnits || rawUnits.length === 0 || rawUnits.length > TOTE_PLAN_LIMITS.maxUnits) return null;

  const units: TotePlanUnit[] = [];
  for (const u of rawUnits) {
    const unit = parseTotePlanUnit(u);
    if (!unit) return null;
    units.push(unit);
  }
  const name = cleanName(c.name);
  return name ? { units, name } : { units };
}

// ── Compact string form (URLs, Stripe metadata) ──────────────────────────
// Unit token: <H|G><cols>x<rows>[w][t]   e.g. "H4x4wt", "G2x6"
// Design:     tokens joined by "."      e.g. "H2x4t.H2x2t.H2x4t"

const UNIT_TOKEN = /^([HG])(\d{1,2})x(\d{1,2})(w?)(t?)$/;

export function encodeTotePlanDesign(design: TotePlanDesign): string {
  return design.units
    .map((u) => `${u.toteType === "HDX" ? "H" : "G"}${u.cols}x${u.rows}${u.hasWheels ? "w" : ""}${u.hasTop ? "t" : ""}`)
    .join(".");
}

export function decodeTotePlanDesign(value: string | null | undefined, name?: string | null): TotePlanDesign | null {
  if (!value) return null;
  const tokens = value.trim().split(".");
  if (tokens.length === 0 || tokens.length > TOTE_PLAN_LIMITS.maxUnits) return null;
  const units: unknown[] = [];
  for (const token of tokens) {
    const m = UNIT_TOKEN.exec(token);
    if (!m) return null;
    units.push({
      toteType: m[1] === "H" ? "HDX" : "GM",
      cols: Number(m[2]),
      rows: Number(m[3]),
      hasWheels: m[4] === "w",
      hasTop: m[5] === "t",
    });
  }
  return parseTotePlanDesign({ units, name: name ?? undefined });
}

/** Relative link to the plans designer pre-filled with a design. */
export function totePlanDesignHref(design: TotePlanDesign, source?: string): string {
  const params = new URLSearchParams({ design: encodeTotePlanDesign(design) });
  if (design.name) params.set("name", design.name);
  if (source) params.set("utm_source", source);
  return `/plans/checkout?${params.toString()}`;
}

/** Reads ?design=&name= (current) or ?config= (legacy single-unit JSON). */
export function designFromSearchParams(params: { get(key: string): string | null }): TotePlanDesign | null {
  const compact = decodeTotePlanDesign(params.get("design"), params.get("name"));
  if (compact) return compact;
  const legacy = params.get("config");
  if (!legacy) return null;
  for (const candidate of [legacy, safeDecode(legacy)]) {
    if (!candidate) continue;
    try {
      return parseTotePlanDesign(JSON.parse(candidate));
    } catch {
      // try the next form
    }
  }
  return null;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Geometry — DIY plans are built with 2×4 RAILS (the plans standard).
// Same numbers as the build engine / Rack3D in 2×4-rail mode.
// ═══════════════════════════════════════════════════════════════════════════

/** Universal 21" bay between uprights — fits HDX and Greenmade 27-gal totes */
export const BAY_OPENING_IN = RAILS_2X4.opening;
export const POST_IN = 1.5;
/** Bottom plate + top plate, 1-1/2" each */
export const PLATES_H_IN = 3;
export const CASTER_IN = 2.75;
export const UNIT_DEPTH_IN = 30;

/** Width split: greedy 4s, remainder last — identical to buildEngine. */
export function splitWidth(cols: number): number[] {
  const mods: number[] = [];
  let remaining = cols;
  while (remaining > MODULE_MAX_COLS) {
    mods.push(MODULE_MAX_COLS);
    remaining -= MODULE_MAX_COLS;
  }
  if (remaining > 0) mods.push(remaining);
  return mods;
}

/** Height split: 6-row tiers, remainder on top — identical to buildEngine. */
export function splitHeight(rows: number): number[] {
  const tiers: number[] = [];
  let remaining = rows;
  while (remaining > MODULE_MAX_ROWS) {
    tiers.push(MODULE_MAX_ROWS);
    remaining -= MODULE_MAX_ROWS;
  }
  if (remaining > 0) tiers.push(remaining);
  return tiers;
}

/** Outside width of one module. Tote brand doesn't matter: the 21" bay fits both. */
export function moduleWidthIn(cols: number): number {
  return cols * BAY_OPENING_IN + (cols + 1) * POST_IN;
}

/** Frame height of one module (plates + upright), without casters. */
export function moduleFrameHeightIn(rows: number): number {
  return PLATES_H_IN + upright2x4(rows);
}

export function unitOuterSize(unit: TotePlanUnit): { widthIn: number; heightIn: number; depthIn: number } {
  return {
    widthIn: splitWidth(unit.cols).reduce((s, c) => s + moduleWidthIn(c), 0),
    heightIn:
      splitHeight(unit.rows).reduce((s, r) => s + moduleFrameHeightIn(r), 0) + (unit.hasWheels ? CASTER_IN : 0),
    depthIn: UNIT_DEPTH_IN,
  };
}

// ── Casters ──────────────────────────────────────────────────────────────
// Up to 4 wide (one module, under 8') rolls on 4 casters at the corners.
// Over 8' rolls on 6, and every further 48" of length adds a pair. Each
// pair (front + back) sits under an upright, as close to even spacing as
// the 22-1/2" upright pitch allows.

const CASTER_BASE_LENGTH_IN = 96;
const CASTER_EXTRA_PAIR_EVERY_IN = 48;

/** Upright centerlines across a unit, inches from its left end (seams have two). */
export function unitUprightXs(unit: Pick<TotePlanUnit, "cols">): number[] {
  const xs: number[] = [];
  let offset = 0;
  for (const cols of splitWidth(unit.cols)) {
    for (let i = 0; i <= cols; i++) xs.push(offset + POST_IN / 2 + i * (BAY_OPENING_IN + POST_IN));
    offset += moduleWidthIn(cols);
  }
  return xs;
}

/** Number of caster PAIRS (front + back) a rolling unit gets. */
export function casterPairCount(unit: Pick<TotePlanUnit, "cols">): number {
  const width = unitOuterSize({ cols: unit.cols, rows: 1, toteType: "HDX", hasWheels: false, hasTop: false }).widthIn;
  if (width <= CASTER_BASE_LENGTH_IN) return 2;
  return 2 + Math.ceil((width - CASTER_BASE_LENGTH_IN) / CASTER_EXTRA_PAIR_EVERY_IN);
}

/**
 * Where each caster pair goes: the upright centerline (inches from the
 * unit's left end) nearest to evenly spaced targets, ends always included.
 * Empty for units without casters.
 */
export function casterPositions(unit: TotePlanUnit): number[] {
  if (!unit.hasWheels) return [];
  const xs = unitUprightXs(unit);
  const first = xs[0];
  const last = xs[xs.length - 1];
  const pairs = casterPairCount(unit);
  const picked: number[] = [];
  for (let p = 0; p < pairs; p++) {
    const target = first + ((last - first) * p) / (pairs - 1);
    const candidates = xs.filter((x) => !picked.includes(x));
    const nearest = candidates.reduce((best, x) => (Math.abs(x - target) < Math.abs(best - target) ? x : best), candidates[0]);
    picked.push(nearest);
  }
  return picked.sort((a, b) => a - b);
}

/** Units stand side by side: total width, tallest unit. */
export function designOuterSize(design: TotePlanDesign): { widthIn: number; heightIn: number; depthIn: number } {
  const sizes = design.units.map(unitOuterSize);
  return {
    widthIn: sizes.reduce((s, u) => s + u.widthIn, 0),
    heightIn: Math.max(...sizes.map((u) => u.heightIn)),
    depthIn: UNIT_DEPTH_IN,
  };
}

/**
 * Largest single unit (within plan limits) that fits a wall opening.
 * Accounts for the extra upright at every module seam and the plates of
 * every stacked tier. Returns null when not even a 1×1 fits.
 */
export function fitTotePlanToWall(
  wallWidthIn: number,
  wallHeightIn: number,
  options: Pick<TotePlanUnit, "toteType" | "hasWheels">,
): { cols: number; rows: number } | null {
  if (!(wallWidthIn > 0) || !(wallHeightIn > 0)) return null;
  const base = { ...options, hasTop: false };
  let cols = 0;
  while (cols < TOTE_PLAN_LIMITS.maxCols && unitOuterSize({ ...base, cols: cols + 1, rows: 1 }).widthIn <= wallWidthIn) cols++;
  let rows = 0;
  while (rows < TOTE_PLAN_LIMITS.maxRows && unitOuterSize({ ...base, cols: 1, rows: rows + 1 }).heightIn <= wallHeightIn) rows++;
  if (cols < 1 || rows < 1) return null;
  return { cols, rows };
}

// ═══════════════════════════════════════════════════════════════════════════
// Modules and module types
// ═══════════════════════════════════════════════════════════════════════════

export interface PlanModule {
  /** Build-engine key: "<unitIdx>-<widthModIndex>-<heightTierIndex>" */
  key: string;
  unitIndex: number;
  widthIndex: number;
  widthCount: number;
  tierIndex: number;
  tierCount: number;
  cols: number;
  rows: number;
  toteType: TotePlanToteType;
  /** True when this module gets its casters in its own steps (one-module-wide rolling units) */
  hasWheels: boolean;
  /** Worktop is part of the module build only when the module IS the unit */
  hasTop: boolean;
  /** Module type letter, A, B, C… */
  type: string;
}

export interface PlanModuleType {
  letter: string;
  cols: number;
  rows: number;
  toteType: TotePlanToteType;
  hasWheels: boolean;
  hasTop: boolean;
  /** How many of this module the design needs */
  count: number;
}

export interface DesignModules {
  modules: PlanModule[];
  types: PlanModuleType[];
}

const typeKey = (m: Pick<PlanModule, "cols" | "rows" | "toteType" | "hasWheels" | "hasTop">) =>
  `${m.toteType}:${m.cols}x${m.rows}:${m.hasWheels ? "w" : ""}${m.hasTop ? "t" : ""}`;

/** Break a design into modules (build order) and group identical ones. */
export function designModules(design: TotePlanDesign): DesignModules {
  const modules: PlanModule[] = [];
  const types: PlanModuleType[] = [];
  const letterByKey = new Map<string, string>();

  design.units.forEach((unit, unitIndex) => {
    const widths = splitWidth(unit.cols);
    const tiers = splitHeight(unit.rows);
    const single = widths.length === 1 && tiers.length === 1;
    // Build order matches the engine: bottom tier first, left to right.
    tiers.forEach((rows, tierIndex) => {
      widths.forEach((cols, widthIndex) => {
        const spec = {
          cols,
          rows,
          toteType: unit.toteType,
          // A one-module-wide unit gets its 4 casters while its bottom module
          // is laid down; wider units get theirs after the modules are joined.
          hasWheels: unit.hasWheels && tierIndex === 0 && widths.length === 1,
          hasTop: unit.hasTop && single,
        };
        const k = typeKey(spec);
        let letter = letterByKey.get(k);
        if (!letter) {
          letter = String.fromCharCode(65 + types.length);
          letterByKey.set(k, letter);
          types.push({ letter, ...spec, count: 0 });
        }
        types.find((t) => t.letter === letter)!.count += 1;
        modules.push({
          key: `${unitIndex}-${widthIndex}-${tierIndex}`,
          unitIndex,
          widthIndex,
          widthCount: widths.length,
          tierIndex,
          tierCount: tiers.length,
          ...spec,
          type: letter,
        });
      });
    });
  });

  return { modules, types };
}

// ═══════════════════════════════════════════════════════════════════════════
// Naming
// ═══════════════════════════════════════════════════════════════════════════

export function totePlanUnitLabel(unit: TotePlanUnit): string {
  return `${unit.cols}×${unit.rows}`;
}

export function totePlanName(design: TotePlanDesign): string {
  if (design.name) return design.name;
  if (design.units.length === 1) return `${totePlanUnitLabel(design.units[0])} Tote Organizer`;
  return `${design.units.length}-Unit Tote Organizer System`;
}

export function totePlanSummary(design: TotePlanDesign): string {
  const totes = design.units.reduce((s, u) => s + u.cols * u.rows, 0);
  const brands = new Set(design.units.map((u) => u.toteType));
  const parts = [
    design.units.length > 1
      ? `${design.units.map(totePlanUnitLabel).join(" + ")} · ${totes} totes`
      : `${totes} totes`,
    brands.size > 1
      ? "HDX + Greenmade totes"
      : brands.has("HDX")
        ? "HDX / Home Depot totes"
        : "Greenmade / Costco totes",
  ];
  if (design.units.some((u) => u.hasWheels)) parts.push("casters");
  if (design.units.some((u) => u.hasTop)) parts.push("plywood worktop");
  return parts.join(" · ");
}

export const DEFAULT_TOTE_PLAN_UNIT: TotePlanUnit = {
  cols: 4,
  rows: 4,
  toteType: "HDX",
  hasWheels: true,
  hasTop: true,
};

export const DEFAULT_TOTE_PLAN_DESIGN: TotePlanDesign = { units: [DEFAULT_TOTE_PLAN_UNIT] };

// ═══════════════════════════════════════════════════════════════════════════
// Translating designer / quote items into a plan design
// ═══════════════════════════════════════════════════════════════════════════

/** The subset of a designer cart item / saved quote unit we can read. */
export interface PlanSourceItem {
  cols?: number;
  rows?: number;
  toteType?: string;
  unitType?: string;
  orientation?: string;
  hasWheels?: boolean;
  hasTop?: boolean;
  use2x4Rails?: boolean;
  quantity?: number;
  shelvingConfigId?: string | null;
  overheadStorageConfig?: unknown;
  overheadGridPresetId?: string | null;
  raisedBedConfig?: unknown;
  chairConfig?: unknown;
  chairId?: string | null;
  presetUnits?: Array<{ cols: number; rows: number; hasTop: boolean; hasWheels: boolean }> | null;
  desc?: string;
}

/**
 * Name of a bestseller collapsed into one quote line by the installer
 * dashboard — "Indiana Joe (2×4 + 2×2 + 2×4 — 20 slots, Totes, Top)" —
 * or null for any other description.
 */
export function collapsedPresetName(desc: string | undefined): string | null {
  if (!desc) return null;
  const m = /^(.+?) \((\d+\s*[×x]\s*\d+(?:\s*\+\s*\d+\s*[×x]\s*\d+)*)\s+—\s+\d+ slots/.exec(desc);
  return m ? m[1].trim() : null;
}

export interface PlanTranslation {
  design: TotePlanDesign | null;
  /** Items that became plan units */
  covered: number;
  /** Items we can't produce plans for (shelving, chairs, mini, sideways…) */
  skipped: number;
}

/**
 * Turn designer cart items / saved quote units into a plan design.
 * Bestsellers break out into their sub-units; quantity repeats a unit.
 * Non-tote items are skipped (and counted) rather than failing the design.
 */
export function designFromItems(items: PlanSourceItem[], name?: string): PlanTranslation {
  const units: TotePlanUnit[] = [];
  let covered = 0;
  let skipped = 0;

  for (const item of items) {
    const isOtherProduct =
      !!item.shelvingConfigId ||
      !!item.overheadStorageConfig ||
      !!item.overheadGridPresetId ||
      !!item.raisedBedConfig ||
      !!item.chairConfig ||
      !!item.chairId;
    if (isOtherProduct) {
      skipped++;
      continue;
    }

    const base = {
      toteType: item.toteType,
      unitType: item.unitType,
      orientation: item.orientation,
    };
    let presetUnits = item.presetUnits && item.presetUnits.length > 0 ? item.presetUnits : null;
    if (!presetUnits) {
      const collapsed = collapsedPresetName(item.desc);
      if (collapsed !== null) {
        // Installer quotes store a bestseller as ONE line carrying only its
        // first sub-unit's size. Rebuild it from the catalog, or skip it —
        // never sell a plan for the wrong build.
        const preset = BESTSELLER_PRESETS.find((p) => p.name.toLowerCase() === collapsed.toLowerCase());
        if (!preset) {
          skipped++;
          continue;
        }
        presetUnits = preset.units;
      }
    }
    const subUnits = presetUnits
      ? presetUnits.map((su) => ({ ...base, ...su }))
      : [{ ...base, cols: item.cols, rows: item.rows, hasWheels: item.hasWheels, hasTop: item.hasTop }];

    const parsed = subUnits.map(parseTotePlanUnit);
    if (parsed.some((u) => !u)) {
      skipped++;
      continue;
    }
    const quantity = Math.max(1, Math.min(TOTE_PLAN_LIMITS.maxUnits, Math.floor(item.quantity ?? 1)));
    for (let q = 0; q < quantity; q++) units.push(...(parsed as TotePlanUnit[]));
    covered++;
  }

  if (units.length === 0 || units.length > TOTE_PLAN_LIMITS.maxUnits) {
    return { design: null, covered: units.length > 0 ? covered : 0, skipped };
  }
  const clean = cleanName(name);
  return { design: clean ? { units, name: clean } : { units }, covered, skipped };
}

// ═══════════════════════════════════════════════════════════════════════════
// Layout — front elevation of the whole design, in inches
// (drawn by the PDF, the plans page and the 3D guide's module map)
// ═══════════════════════════════════════════════════════════════════════════

export interface LayoutModule {
  key: string;
  unitIndex: number;
  type: string;
  cols: number;
  rows: number;
  /** Left edge, inches from the left end of the design */
  x: number;
  /** Bottom edge, inches above the floor (casters lift rolling units) */
  y: number;
  w: number;
  h: number;
}

export interface LayoutUnit {
  unitIndex: number;
  x: number;
  w: number;
  h: number;
  hasWheels: boolean;
  hasTop: boolean;
  /** Caster pair centerlines, inches from the left end of the design */
  casters: number[];
}

export interface DesignLayout {
  modules: LayoutModule[];
  units: LayoutUnit[];
  widthIn: number;
  heightIn: number;
}

/** Units drawn side by side with a small visual gap between them. */
export function designLayout(design: TotePlanDesign, unitGapIn = 8): DesignLayout {
  const { modules } = designModules(design);
  const out: LayoutModule[] = [];
  const units: LayoutUnit[] = [];
  let unitX = 0;

  design.units.forEach((unit, unitIndex) => {
    const widths = splitWidth(unit.cols);
    const tiers = splitHeight(unit.rows);
    const base = unit.hasWheels ? CASTER_IN : 0;
    const colX: number[] = [];
    widths.reduce((x, c, i) => {
      colX[i] = x;
      return x + moduleWidthIn(c);
    }, unitX);
    const tierY: number[] = [];
    tiers.reduce((y, r, i) => {
      tierY[i] = y;
      return y + moduleFrameHeightIn(r);
    }, base);

    for (const m of modules.filter((mm) => mm.unitIndex === unitIndex)) {
      out.push({
        key: m.key,
        unitIndex,
        type: m.type,
        cols: m.cols,
        rows: m.rows,
        x: colX[m.widthIndex],
        y: tierY[m.tierIndex],
        w: moduleWidthIn(m.cols),
        h: moduleFrameHeightIn(m.rows),
      });
    }
    const size = unitOuterSize(unit);
    units.push({
      unitIndex,
      x: unitX,
      w: size.widthIn,
      h: size.heightIn,
      hasWheels: unit.hasWheels,
      hasTop: unit.hasTop,
      casters: casterPositions(unit).map((c) => unitX + c),
    });
    unitX += size.widthIn + unitGapIn;
  });

  return {
    modules: out,
    units,
    widthIn: unitX - unitGapIn,
    heightIn: Math.max(...units.map((u) => u.h)),
  };
}

/** Key for a module type's step render, shared by the renderer and the PDF. */
export function planSnapshotKey(typeLetter: string, stepId: string): string {
  return `${typeLetter}:${stepId}`;
}
