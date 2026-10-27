// ═══════════════════════════════════════════════════════════════════════════
// Design studio — pure rules for the single-page designer on /design.
//
// In the studio the quote IS the design: every cart item (UnitConfig) is a
// unit on the system map, edited in place and re-priced live. These helpers
// keep a tote unit's options exactly as the step-by-step configurator
// allowed them (effective top / orientation / tote color, size limits, the
// cart description) so a studio quote is indistinguishable from one built
// the old way.
// ═══════════════════════════════════════════════════════════════════════════

import type { CompoundBuildResult, Orientation, UnitType } from "@/app/actions/calculator";
import type { ToteColor, ToteType, UnitConfig } from "@/hooks/configurator/types";
import type { SectionAddon } from "@/types/viewModels";
import { BESTSELLER_PRESETS, type BestsellerPreset } from "@/lib/presets";

/** What the installer offers — drives which options a tote unit can take. */
export interface StudioRules {
  use2x4Rails: boolean;
  totesDisabled: boolean;
  miniEnabled: boolean;
}

export type StudioItemKind = "tote" | "bestseller" | "shelving" | "overhead" | "raised-bed" | "chair";

/** The options a customer picks for a tote unit. */
export interface ToteUnitOptions {
  cols: number;
  rows: number;
  toteType: ToteType;
  toteColor: ToteColor;
  unitType: UnitType;
  orientation: Orientation;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
}

export const STUDIO_MAX_COLS = 12;
const MINI_MAX_ROWS = 4;
const RAILS_2X4_MAX_ROWS = 6;
const STANDARD_MAX_ROWS = 10;

export const DEFAULT_TOTE_UNIT: ToteUnitOptions = {
  cols: 4,
  rows: 4,
  toteType: "HDX",
  toteColor: "black",
  unitType: "standard",
  orientation: "standard",
  hasTotes: false,
  hasWheels: false,
  hasTop: false,
};

export function studioItemKind(item: UnitConfig): StudioItemKind {
  if (item.presetUnits && item.presetUnits.length > 0) return "bestseller";
  if (item.shelvingConfigId) return "shelving";
  if (item.overheadStorageConfig) return "overhead";
  if (item.raisedBedConfig) return "raised-bed";
  if (item.chairConfig) return "chair";
  return "tote";
}

/** Tallest a unit can be — same limits as the step-by-step size inputs. */
export function studioMaxRows(unitType: UnitType, use2x4Rails: boolean): number {
  if (unitType === "mini") return MINI_MAX_ROWS;
  return use2x4Rails ? RAILS_2X4_MAX_ROWS : STANDARD_MAX_ROWS;
}

/** Can this installer's customers pick the Mini unit size? */
export function miniAvailable(rules: StudioRules): boolean {
  return rules.miniEnabled && !rules.totesDisabled && !rules.use2x4Rails;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n) || lo));

/**
 * The options as they'll be priced and built. Mirrors the configurator's
 * effective values: minis always have a top and face standard; clear totes
 * only for included HDX totes on a standard unit; no totes when the
 * installer doesn't sell them; sizes within the configurator's limits.
 */
export function normalizeToteUnit(u: ToteUnitOptions, rules: StudioRules): ToteUnitOptions {
  const unitType: UnitType = u.unitType === "mini" && miniAvailable(rules) ? "mini" : "standard";
  const hasTotes = rules.totesDisabled ? false : u.hasTotes;
  return {
    cols: clamp(u.cols, 1, STUDIO_MAX_COLS),
    rows: clamp(u.rows, 1, studioMaxRows(unitType, rules.use2x4Rails)),
    toteType: u.toteType,
    toteColor: u.toteType === "HDX" && unitType === "standard" && hasTotes ? u.toteColor : "black",
    unitType,
    orientation: unitType === "standard" ? u.orientation : "standard",
    hasTotes,
    hasWheels: u.hasWheels,
    hasTop: unitType === "mini" ? true : u.hasTop,
  };
}

/** The tote options of a cart item. */
export function toteOptionsOf(item: UnitConfig): ToteUnitOptions {
  return {
    cols: item.cols,
    rows: item.rows,
    toteType: item.toteType,
    toteColor: item.toteColor,
    unitType: item.unitType,
    orientation: item.orientation,
    hasTotes: item.hasTotes,
    hasWheels: item.hasWheels,
    hasTop: item.hasTop,
  };
}

/** Everything that changes a tote unit's price — a cache key. */
export function toteUnitSignature(item: UnitConfig): string {
  const o = toteOptionsOf(item);
  return JSON.stringify([o.cols, o.rows, o.toteType, o.toteColor, o.unitType, o.orientation, o.hasTotes, o.hasWheels, o.hasTop, item.addons ?? []]);
}

/** Cart line description — identical to the configurator's "Add to quote". */
export function toteUnitDesc(o: ToteUnitOptions): string {
  let label = o.unitType === "mini" ? "Mini" : "Standard";
  if (o.unitType === "standard" && o.orientation === "sideways") label = "Standard (Sideways)";
  const clear = o.hasTotes && o.toteType === "HDX" && o.unitType === "standard" && o.toteColor === "clear";
  return `${label}: ${o.cols}W × ${o.rows}H${clear ? " (Clear Totes)" : ""}`;
}

/** The bestseller a cart item came from (cart lines carry its name, not its id). */
export function presetOfItem(item: UnitConfig): BestsellerPreset | undefined {
  if (studioItemKind(item) !== "bestseller") return undefined;
  return BESTSELLER_PRESETS.find((p) => item.desc.startsWith(p.name));
}

/** Can the customer choose whether a bestseller includes totes? */
export function presetTotesChoice(preset: BestsellerPreset, totesDisabled: boolean): "choice" | "always" | "never" {
  if (totesDisabled || preset.totesDisabled) return "never";
  if (preset.totesAreMandatory) return "always";
  return "choice";
}

/** A bestseller's cart line — the shape the configurator has always submitted. */
export function presetOrderItem(preset: BestsellerPreset, build: CompoundBuildResult, hasTotes: boolean): UnitConfig {
  const subDesc = build.subUnits.map((su) => `${su.cols}x${su.rows}`).join(" + ");
  return {
    cols: build.subUnits.reduce((s, u) => s + u.cols, 0),
    rows: Math.max(...build.subUnits.map((u) => u.rows)),
    toteType: preset.toteModel as ToteType,
    toteColor: preset.toteColor as ToteColor,
    unitType: preset.unitType,
    orientation: preset.orientation,
    hasTotes,
    hasWheels: preset.units.some((u) => u.hasWheels),
    hasTop: preset.units.some((u) => u.hasTop),
    price: build.totalPrice,
    totalW: build.combinedW,
    totalH: build.maxH,
    depth: build.depth,
    desc: `${preset.name} (${subDesc})`,
    addons: [],
    presetUnits: build.subUnits.map((su, idx) => ({
      cols: su.cols,
      rows: su.rows,
      totalW: su.totalW,
      totalH: su.totalH,
      hasTop: preset.units[idx]?.hasTop ?? false,
      hasWheels: preset.units[idx]?.hasWheels ?? false,
    })),
    drawerSlideRows: preset.drawerSlideRows,
    drawerSlideColumns: preset.drawerSlideColumns,
  };
}

/** Units in the order, counting quantities. */
export function studioUnitCount(items: UnitConfig[]): number {
  return items.reduce((s, it) => s + (it.quantity || 1), 0);
}

/**
 * Overall size of the tote racks in the order, side by side (as the 3D shows
 * them): width in inches, tallest height, and tote slots. Null when the order
 * has no racks.
 */
export function studioSystemSize(items: UnitConfig[]): { widthIn: number; heightIn: number; slots: number } | null {
  const racks = items.filter((it) => {
    const k = studioItemKind(it);
    return k === "tote" || k === "bestseller";
  });
  if (racks.length === 0) return null;
  let widthIn = 0;
  let heightIn = 0;
  let slots = 0;
  for (const it of racks) {
    const qty = it.quantity || 1;
    widthIn += (it.totalW || 0) * qty;
    heightIn = Math.max(heightIn, it.totalH || 0);
    slots += (it.presetUnits ? it.presetUnits.reduce((s, su) => s + su.cols * su.rows, 0) : it.cols * it.rows) * qty;
  }
  return { widthIn, heightIn, slots };
}

/** Installer's paint prices: frame, and each of doors / side panels. */
export interface StudioPaintPrices {
  frame: number;
  doorsPanels: number;
}

/**
 * Paint on one unit (per unit — quantities multiply the line). The pricing
 * engine doesn't price paint, so the studio adds it to the line; the quote
 * card already lists these exact amounts under the unit.
 */
export function studioPaintCost(
  item: Pick<UnitConfig, "paintFrameColor" | "paintDoorColor" | "paintSidePanelColor">,
  prices: StudioPaintPrices,
): number {
  return (item.paintFrameColor ? prices.frame : 0) + (item.paintDoorColor ? prices.doorsPanels : 0) + (item.paintSidePanelColor ? prices.doorsPanels : 0);
}

/** Section add-ons that still exist after a resize (bays / tiers beyond the unit are dropped). */
export function pruneAddons(addons: SectionAddon[] | undefined, cols: number, rows: number): SectionAddon[] {
  return (addons ?? []).filter(
    (a) => (typeof a.target !== "number" || a.target < cols) && (a.row === undefined || a.row < rows),
  );
}
