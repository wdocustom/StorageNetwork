// ═══════════════════════════════════════════════════════════════════════════
// Material Cost Types & Default Prices — Client-safe
//
// Types and public retail prices only. The actual calculation algorithm
// lives in src/app/actions/calculate-materials.ts (server-side, IP protected).
//
// For server-side usage (e.g. inventory sync), import calculateMaterialCostServer
// from "@/app/actions/calculate-materials" instead.
// ═══════════════════════════════════════════════════════════════════════════

// ── V1 Default Costs (actual wholesale/material costs) ───────────────────

export const DEFAULT_MATERIAL_PRICES = {
  lumber_2x4_8ft: 3.75,
  plywood_sheet: 33.98,
  tote: 8.99,
  screw_1in_90ct: 10.99,
  screw_1_5_8in_158ct: 8.97,
  screw_3in_137ct: 8.97,
  wheels_4pk: 30.0,
} as const;

/** Custom material pricing — all fields optional, falls back to defaults */
export type MaterialPrices = {
  [K in keyof typeof DEFAULT_MATERIAL_PRICES]?: number;
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface MaterialConfig {
  cols: number;
  rows: number;
  toteType?: "HDX" | "GM";
  unitType?: "standard" | "mini";
  hasTotes?: boolean;
  hasWheels?: boolean;
  hasTop?: boolean;
  /** When set, unit is open shelving — uses shelving material calculation */
  shelvingConfigId?: string;
  /** When set, unit is overhead ceiling storage — uses overhead material calculation */
  overheadGridPresetId?: string;
  /** Per-section addons (doors, panels, rail removal, shelves) */
  addons?: import("@/types/viewModels").SectionAddon[];
  /** Compound preset sub-units (old DB records only — new leads expand client-side) */
  presetUnits?: import("@/lib/buildEngine.types").PresetSubUnitConfig[];
  /** When true, uses ripped 2x4 rails instead of plywood strips */
  use2x4Rails?: boolean;
}

export interface MaterialBreakdown {
  totalCost: number;
  items: {
    name: string;
    qty: number;
    unitCost: number;
    subtotal: number;
  }[];
  /** Individual raw counts (pre-box-ceiling) for inventory tracking. */
  rawCounts: {
    screws_1_5_8: number;
    screws_3: number;
    screws_1: number;
    plywood_strips: number;
    plywood_strips_mini: number;
    plywood_top_sheets: number;
    plywood_shelving_sheets: number;
    plywood_addon_sheets: number;
    lumber_boards: number;
    totes: number;
    wheel_kits: number;
    /** 2x4 rail construction: individual rail pieces needed */
    rails_2x4_pieces?: number;
    /** 2x4 rail construction: total 2x4x8' boards for rails (6 rails per board) */
    rails_2x4_boards?: number;
    overhead_lag_bolts?: number;
    overhead_structural_screws?: number;
    overhead_plywood_sheets?: number;
    /** Individual 2x4 part lengths for offcut-aware inventory. */
    lumber_part_lengths?: number[];
  };
}
