// ═══════════════════════════════════════════════════════════════════════════
// Bestseller Presets — Structural Config Only (Client-Safe)
//
// Contains unit configurations (cols, rows, options) needed by the 3D
// configurator. Pricing is NOT included here — it lives server-side in:
//   - PLATFORM_BESTSELLER_DEFAULTS (src/lib/server/pricing-constants.ts)
//   - Installer overrides (pricing_config in profiles table)
//   - calculateCompoundBuild() (src/app/actions/calculator.ts)
//
// This prevents competitors from scraping exact preset price points
// from the client bundle.
// ═══════════════════════════════════════════════════════════════════════════

export interface PresetSubUnit {
  cols: number;
  rows: number;
  hasTop: boolean;
  hasWheels: boolean;
}

export interface BestsellerPreset {
  id: string;
  name: string;
  label: string;
  units: PresetSubUnit[];
  toteModel: "HDX" | "GM";
  toteColor: "black" | "clear";
  unitType: "standard" | "mini";
  orientation: "standard" | "sideways";
  /** When true, tote add-on price is calculated dynamically from the normal pricing engine */
  dynamicTotePricing?: boolean;
  /** When true, totes cannot be removed — they are part of the system (e.g. drawer slides) */
  totesAreMandatory?: boolean;
  /** Number of bottom rows that have drawer slides (renders slide hardware in 3D) */
  drawerSlideRows?: number;
  /** Column indices that have drawer slides (e.g. [0, 3] = first and last columns) */
  drawerSlideColumns?: number[];
  /** Amazon purchase link for drawer slide hardware */
  drawerSlideLink?: string;
}

export const BESTSELLER_PRESETS: BestsellerPreset[] = [
  {
    id: "indiana-joe",
    name: "Indiana Joe",
    label: "Bestseller",
    toteModel: "HDX",
    toteColor: "black",
    unitType: "standard",
    orientation: "standard",
    units: [
      { cols: 2, rows: 4, hasTop: true, hasWheels: false },
      { cols: 2, rows: 2, hasTop: true, hasWheels: false },
      { cols: 2, rows: 4, hasTop: true, hasWheels: false },
    ],
  },
  {
    id: "cornhusker",
    name: "Cornhusker",
    label: "Bestseller",
    toteModel: "HDX",
    toteColor: "black",
    unitType: "standard",
    orientation: "standard",
    dynamicTotePricing: true,
    units: [
      { cols: 4, rows: 4, hasTop: true, hasWheels: true },
    ],
  },
  {
    id: "long-ranger",
    name: "The Long Ranger",
    label: "Bestseller",
    toteModel: "HDX",
    toteColor: "black",
    unitType: "standard",
    orientation: "standard",
    units: [
      { cols: 2, rows: 4, hasTop: true, hasWheels: false },
      { cols: 4, rows: 2, hasTop: true, hasWheels: false },
    ],
  },
  {
    id: "gas-station",
    name: "The Gass Station",
    label: "Bestseller",
    toteModel: "HDX",
    toteColor: "black",
    unitType: "standard",
    orientation: "standard",
    units: [
      { cols: 1, rows: 4, hasTop: true, hasWheels: false },
      { cols: 4, rows: 2, hasTop: true, hasWheels: false },
      { cols: 1, rows: 4, hasTop: true, hasWheels: false },
    ],
  },
  {
    id: "track-norris",
    name: "Track Norris",
    label: "New",
    toteModel: "HDX",
    toteColor: "black",
    unitType: "standard",
    orientation: "standard",
    totesAreMandatory: true,
    drawerSlideColumns: [0, 3],
    drawerSlideLink: "https://amzn.to/4bW48Ln",
    units: [
      { cols: 4, rows: 2, hasTop: true, hasWheels: false },
    ],
  },
];
