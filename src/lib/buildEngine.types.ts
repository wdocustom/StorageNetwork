// ═══════════════════════════════════════════════════════════════════════════
// BUILD ENGINE TYPES — Shared type definitions
// Safe to import from both client and server components.
// ═══════════════════════════════════════════════════════════════════════════

import type { SectionAddon, PaintColorId } from "@/types/viewModels";
import { roundMoney } from "@/utils/mathHelpers";

export type UnitType = "standard" | "mini";
export type Orientation = "standard" | "sideways";
export type ToteColor = "black" | "clear";

export interface QuoteUnit {
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  toteColor?: ToteColor; // Optional for backward compatibility, defaults to "black"
  unitType: UnitType;
  orientation: Orientation;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price: number;
  totalW: number;
  totalH: number;
  depth: number;
  desc: string;
  addons?: SectionAddon[]; // Per-section addons (Organizer Customization)
  /** Paint color selections */
  paintFrameColor?: PaintColorId | null;
  paintDoorColor?: PaintColorId | null;
  paintSidePanelColor?: PaintColorId | null;
  /** When true, customer wants this item delivered inside the home (extra per-item fee) */
  indoorDelivery?: boolean;
  /** The indoor delivery fee charged for this item (in dollars) */
  indoorDeliveryFee?: number;
  /** When true, this unit uses 2x4 ripped rail construction instead of plywood strips */
  use2x4Rails?: boolean;
  /** When set, this unit is an open shelving unit — routed to shelving cut plan handler */
  shelvingConfigId?: string;
  /** When set, this unit is an overhead ceiling storage unit — routed to overhead handler */
  overheadGridPresetId?: string;
  /** When set, this unit is an Adirondack Chair — skips cut plan, shows Build Plans link */
  chairId?: string;
  /** Compound preset sub-units (e.g. "The Gass Station" = 1x4 + 4x2 + 1x4).
   *  Present on old DB records where the preset was stored as one aggregate item.
   *  New leads expand these client-side before saving, so this field is absent. */
  presetUnits?: PresetSubUnitConfig[];
}

export interface PresetSubUnitConfig {
  cols: number;
  rows: number;
  totalW: number;
  totalH: number;
  hasTop: boolean;
  hasWheels: boolean;
}

export interface CutPart {
  len: number;
  name: string;
  type: "upright" | "rail";
}

export interface Board {
  cuts: CutPart[];
  rem: number;
  priorUsed?: number; // inches used by prior modules' cuts (offcut carry-forward)
  laterUsed?: number; // inches that later modules will claim from this board's offcut
  laterLabel?: string; // e.g., "→ Mod 2" showing which module uses the offcut
}

export interface CutPlanModule {
  unitIndex: number;
  moduleIndex: number;
  cols: number;
  rows: number;
  boards: Board[];
  stripCount: number;
  railStrips: number;
  backSupports: number;
  moduleWidth: number;
  heightTier?: number; // 1-based tier index when unit is vertically split (omitted for single-tier)
  heightTierTotal?: number; // total number of height tiers for this width module
}

export interface ShelvingCutPlanModule {
  unitIndex: number;
  shelvingLabel: string;
  widthIn: number;
  frameH: number;
  depth: number;
  shelves: number;
  boards: Board[];
  plywoodSurfaces: number;
  plywoodSqFtPerSurface: number;
}

export interface OverheadCutPlanModule {
  unitIndex: number;
  overheadLabel: string;
  slotsWide: number;
  slotsDeep: number;
  toteCount: number;
  toteType: "HDX" | "GM";
  systemWidthIn: number;
  systemDepthIn: number;
  materials: { name: string; qty: number; unit: string }[];
}

export interface ShoppingItem {
  name: string;
  detail: string;
  qty: number | string;
}

export interface Financials {
  retailTotal: number;
  depositRate: number;
  depositAmount: number;
  balanceDue: number;
}

// ── Preset Expansion ──────────────────────────────────────────────────────
// Single source of truth for expanding compound presets into individual units.
// Old DB records store bestseller presets as one aggregate item with a
// presetUnits array. This function splits them into separate QuoteUnit
// entries so the build engine processes each sub-unit independently.

export function expandPresetUnits<T extends { presetUnits?: PresetSubUnitConfig[]; cols: number; rows: number }>(
  units: T[],
): T[] {
  const expanded: T[] = [];
  for (const unit of units) {
    if (unit.presetUnits && unit.presetUnits.length > 1) {
      const price = (unit as T & { price?: number }).price ?? 0;
      const desc = (unit as T & { desc?: string }).desc ?? "";
      const totalSlots = unit.presetUnits.reduce((s, u) => s + u.cols * u.rows, 0);
      for (const sub of unit.presetUnits) {
        const subSlots = sub.cols * sub.rows;
        expanded.push({
          ...unit,
          cols: sub.cols,
          rows: sub.rows,
          totalW: sub.totalW,
          totalH: sub.totalH,
          hasTop: sub.hasTop,
          hasWheels: sub.hasWheels,
          ...(price > 0 ? { price: roundMoney(price * subSlots / totalSlots) } : {}),
          ...(desc ? { desc: `${desc} — ${sub.cols}x${sub.rows}` } : {}),
          presetUnits: undefined, // consumed — don't re-expand
        });
      }
    } else {
      expanded.push(unit);
    }
  }
  return expanded;
}

export interface BuildManifest {
  shopping_list: ShoppingItem[];
  cut_plan_visuals: CutPlanModule[];
  shelving_cut_plans?: ShelvingCutPlanModule[];
  overhead_cut_plans?: OverheadCutPlanModule[];
  financials: Financials;
  totals: {
    boards: number;
    sheets: number;
    totes: number;
    wheelKits: number;
    screwBoxes_1_5_8: number;
    screwBoxes_3: number;
    screwBoxes_1: number;
  };
}
