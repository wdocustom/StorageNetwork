// ═══════════════════════════════════════════════════════════════════════════
// Platform Default Pricing Constants — Server-Only Module
//
// NO "use server" directive — this is a plain module that can export constants.
// It stays server-only because it's ONLY imported by:
//   - src/app/actions/platform-defaults.ts ("use server" async functions)
//   - src/app/actions/calculator.ts ("use server" server action)
//   - src/app/design/page.tsx (server component)
//
// DO NOT import this file from any client component or lib file.
// If Next.js tree-shaking ever includes it in the client bundle,
// move the import to a server action instead.
// ═══════════════════════════════════════════════════════════════════════════

/** Base pricing per component — used when installer has no custom override */
export const PLATFORM_DEFAULTS = {
  standard_slot: 30,
  mini_slot: 15,
  standard_tote: 12,
  standard_tote_clear: 20,
  mini_tote: 4,
  standard_wheels: 65,
  mini_wheels: 40,
  plywood_top: 95,
} as const;

/** Bestseller preset total prices (totes included) */
export const PLATFORM_BESTSELLER_DEFAULTS: Record<string, number> = {
  bestseller_indiana_joe: 950,
  bestseller_cornhusker: 660,
  bestseller_long_ranger: 715,
  bestseller_gas_station: 840,
  bestseller_track_norris: 630,
};

/** Open shelving unit total prices */
export const PLATFORM_SHELVING_DEFAULTS: Record<string, number> = {
  shelving_shelf_4ft_short: 175,
  shelving_shelf_5ft_short: 200,
  shelving_shelf_6ft_short: 225,
  shelving_shelf_4ft_tall: 325,
  shelving_shelf_5ft_tall: 375,
  shelving_shelf_6ft_tall: 425,
};

/** Overhead ceiling storage grid prices */
export const PLATFORM_OVERHEAD_DEFAULTS: Record<string, number> = {
  overhead_2x2: 112,
  overhead_2x3: 168,
  overhead_3x2: 168,
  overhead_3x3: 252,
  overhead_3x4: 336,
  overhead_4x4: 448,
};

/** Per-slot base price for overhead (used when no preset match) */
export const OVERHEAD_BASE_PRICE_PER_SLOT = 28;

/** Organizer add-on defaults (doors, panels, hinges, paint) */
export const ADDON_PLATFORM_DEFAULTS = {
  plywood_door: 55,
  side_panel: 40,
  concealed_hinge_pair: 12,
  rail_removal: -20,
  shelf: 35,
  paint_frame_price: 75,
  paint_doors_panels_price: 30,
} as const;

/** Raised bed base prices by size ID */
export const RAISED_BED_PRICES: Record<string, {
  basePrice: number;
  stainPrice: number;
  linerPrice: number;
  paintedWhitePrice: number;
  depthIncreasePrice: number;
  bottomShelfPrice: number;
}> = {
  legs_12x48x16: { basePrice: 165, stainPrice: 30, linerPrice: 20, paintedWhitePrice: 80, depthIncreasePrice: 20, bottomShelfPrice: 0 },
  legs_24x48x16: { basePrice: 185, stainPrice: 35, linerPrice: 25, paintedWhitePrice: 90, depthIncreasePrice: 30, bottomShelfPrice: 0 },
  legs_24x48x30: { basePrice: 195, stainPrice: 40, linerPrice: 30, paintedWhitePrice: 95, depthIncreasePrice: 30, bottomShelfPrice: 50 },
  legs_24x72x16: { basePrice: 205, stainPrice: 40, linerPrice: 35, paintedWhitePrice: 105, depthIncreasePrice: 40, bottomShelfPrice: 0 },
  legs_24x24x16_post: { basePrice: 195, stainPrice: 35, linerPrice: 25, paintedWhitePrice: 90, depthIncreasePrice: 0, bottomShelfPrice: 0 },
  ground_24x72x11: { basePrice: 185, stainPrice: 35, linerPrice: 30, paintedWhitePrice: 105, depthIncreasePrice: 0, bottomShelfPrice: 0 },
  ground_24x72x22: { basePrice: 235, stainPrice: 45, linerPrice: 35, paintedWhitePrice: 135, depthIncreasePrice: 0, bottomShelfPrice: 0 },
  ground_36x72x22: { basePrice: 255, stainPrice: 50, linerPrice: 40, paintedWhitePrice: 150, depthIncreasePrice: 0, bottomShelfPrice: 0 },
  ground_48x48x22: { basePrice: 275, stainPrice: 50, linerPrice: 40, paintedWhitePrice: 135, depthIncreasePrice: 0, bottomShelfPrice: 0 },
};

/** Pest cover prices by type and bed category */
export const PEST_COVER_PRICES = {
  hoop: { price_2x4: 150, price_2x6: 175, stainAddon_2x4: 10, stainAddon_2x6: 15 },
  rigid_cage: { price_2x4: 195, price_2x6: 215, stainAddon_2x4: 25, stainAddon_2x6: 35 },
  cabinet_24: { price_2x4: 275, price_2x6: 295, stainAddon_2x4: 25, stainAddon_2x6: 35 },
  cabinet_48: { price_2x4: 375, price_2x6: 395, stainAddon_2x4: 25, stainAddon_2x6: 35 },
} as const;
