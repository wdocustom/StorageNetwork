// ═══════════════════════════════════════════════════════════════════════════
// BUILD ENGINE TYPES — Shared type definitions
// Safe to import from both client and server components.
// ═══════════════════════════════════════════════════════════════════════════

import type { SectionAddon, PaintColorId } from "@/types/viewModels";

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
  /** When set, this unit is an open shelving unit — routed to shelving cut plan handler */
  shelvingConfigId?: string;
  /** When set, this unit is an overhead ceiling storage unit — routed to overhead handler */
  overheadGridPresetId?: string;
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
