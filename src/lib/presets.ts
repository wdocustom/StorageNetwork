// ═══════════════════════════════════════════════════════════════════════════
// Bestseller Presets — Shared between client (configurator UI) and server
//
// This file is NOT a server action ("use server") so constants can be
// imported directly by client components.
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
  /** Fixed base price (frame + tops, no totes) */
  basePrice: number;
  /** Fixed price with totes included (ignored when dynamicTotePricing is true) */
  withTotesPrice: number;
  /** When true, tote add-on price is calculated dynamically from the normal pricing engine */
  dynamicTotePricing?: boolean;
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
    basePrice: 710,
    withTotesPrice: 950,
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
    basePrice: 450,
    withTotesPrice: 0,
    dynamicTotePricing: true,
    units: [
      { cols: 4, rows: 4, hasTop: true, hasWheels: true },
    ],
  },
];
