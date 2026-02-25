// ═══════════════════════════════════════════════════════════════════════════
// Material Cost Calculator — Client-safe estimation
// Takes a job config (from the 3D configurator) and returns estimated
// material cost using V1 hardcoded unit prices or custom installer prices.
//
// This runs on the CLIENT so installers see the breakdown immediately.
// It does NOT replace the server-side build engine — it's a cost overlay.
// ═══════════════════════════════════════════════════════════════════════════

// ── V1 Default Costs ────────────────────────────────────────────────────

export const DEFAULT_MATERIAL_PRICES = {
  lumber_2x4_8ft: 3.75,
  plywood_sheet: 33.98,
  tote: 8.99,
  screw_1in_90ct: 10.99,
  screw_1_5_8in_145ct: 8.97,
  screw_3in_70ct: 8.97,
  wheels_4pk: 60.0,
} as const;

/** Custom material pricing — all fields optional, falls back to defaults */
export type MaterialPrices = {
  [K in keyof typeof DEFAULT_MATERIAL_PRICES]?: number;
};

// ── Constants (match buildEngine.ts) ───────────────────────────────────────

const STOCK_LENGTH = 96; // 8ft board
const KERF = 0.125;
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const GAP = 1.5; // post width (2x4)
const TIER_HEIGHT = 16;

// ── Height Tier Splitting ──────────────────────────────────────────────────
// Max rows per height tier so uprights fit in 8ft stock.
const MAX_ROWS_PER_TIER = Math.floor(STOCK_LENGTH / TIER_HEIGHT); // 6

function splitHeightTiers(totalRows: number): number[] {
  if (totalRows <= MAX_ROWS_PER_TIER) return [totalRows];
  const tiers: number[] = [];
  let remaining = totalRows;
  while (remaining > MAX_ROWS_PER_TIER) {
    tiers.push(MAX_ROWS_PER_TIER);
    remaining -= MAX_ROWS_PER_TIER;
  }
  if (remaining > 0) tiers.push(remaining);
  return tiers;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface MaterialConfig {
  cols: number;
  rows: number;
  toteType?: "HDX" | "GM";
  hasTotes?: boolean;
  hasWheels?: boolean;
  hasTop?: boolean;
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
    plywood_top_sheets: number;
    lumber_boards: number;
    totes: number;
    wheel_kits: number;
  };
}

// ── Calculator ─────────────────────────────────────────────────────────────

export function calculateMaterialCost(
  configs: MaterialConfig | MaterialConfig[],
  customPrices?: MaterialPrices
): MaterialBreakdown {
  const units = Array.isArray(configs) ? configs : [configs];
  const prices = { ...DEFAULT_MATERIAL_PRICES, ...customPrices };

  let totalBoards = 0;
  let totalSheets = 0;
  let totalTotes = 0;
  let totalWheelKits = 0;
  let totalScrewBoxes1 = 0;
  let totalScrewBoxes16 = 0;
  let totalScrewBoxes3 = 0;

  let globalStripCount = 0;
  let globalTopSheets = 0;

  // ── PHASE 1: Collect ALL lumber parts globally for cross-module packing ──
  const allParts: number[] = [];
  let totalScrew16 = 0;
  let totalScrew3 = 0;
  let totalScrew1 = 0;

  for (const unit of units) {
    const { cols: totalCols, rows: totalRows, toteType = "HDX", hasTotes = false, hasWheels = false, hasTop = false } = unit;
    if (totalCols < 1 || totalRows < 1) continue;

    // Width split (max 4 cols per module)
    const widthModules: number[] = [];
    let remainingCols = totalCols;
    while (remainingCols > 4) {
      widthModules.push(4);
      remainingCols -= 4;
    }
    if (remainingCols > 0) widthModules.push(remainingCols);

    // Height split (max rows per tier to fit 8ft stock)
    const heightTiers = splitHeightTiers(totalRows);

    if (hasWheels) {
      totalWheelKits++;
      totalScrew1 += 16;
    }

    let unitTotalWidth = 0;

    for (let modIdx = 0; modIdx < widthModules.length; modIdx++) {
      const cols = widthModules[modIdx];
      const opening = toteType === "HDX" ? OPENING_HDX : OPENING_GM;
      const modWidth = cols * opening + (cols + 1) * GAP;
      unitTotalWidth += modWidth;

      // Process each height tier for this width module
      for (let tierIdx = 0; tierIdx < heightTiers.length; tierIdx++) {
        const tierRows = heightTiers[tierIdx];
        const slots = cols * tierRows;
        const uprightHeight = tierRows * TIER_HEIGHT;

        // Collect parts globally
        const postCount = modIdx === 0 ? (cols + 1) * 2 : cols * 2;
        for (let i = 0; i < postCount; i++) {
          allParts.push(uprightHeight);
        }

        // Each height tier needs its own set of rails (top/bottom plates)
        for (let k = 0; k < 4; k++) {
          allParts.push(modWidth);
        }

        const numRails = slots * 2;
        const backSupports = cols <= 4 ? 4 : 6;
        globalStripCount += numRails + backSupports;

        totalScrew16 += numRails * 4;
        const screwPostCount = modIdx === 0 ? cols + 1 : cols;
        totalScrew3 += screwPostCount * 20;

        if (hasTotes) totalTotes += slots;
      }
    }

    if (hasTop) {
      let sheetsForUnit = 0;
      if (unitTotalWidth > 192) sheetsForUnit = 3;
      else if (unitTotalWidth > 96) sheetsForUnit = 2;
      else sheetsForUnit = 1;
      globalTopSheets += sheetsForUnit;
    }
  }

  // ── PHASE 2: Global Bin Packing — sort ALL parts longest-first ──────────
  allParts.sort((a, b) => b - a);
  const bins: number[] = [];
  for (const len of allParts) {
    let placed = false;
    for (let b = 0; b < bins.length; b++) {
      if (bins[b] >= len + KERF) {
        bins[b] -= len + KERF;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bins.push(STOCK_LENGTH - len);
    }
  }
  totalBoards = bins.length;

  totalScrewBoxes16 = Math.ceil(totalScrew16 / 145);
  totalScrewBoxes3 = Math.ceil(totalScrew3 / 70);
  totalScrewBoxes1 = Math.ceil(totalScrew1 / 90);

  // Final plywood: top sheet offcuts reduce structural sheet needs
  const stripCredit = globalTopSheets * 27;
  let netStrips = globalStripCount - stripCredit;
  if (netStrips < 0) netStrips = 0;
  const structSheets = Math.ceil(netStrips / 72);
  totalSheets = structSheets + globalTopSheets;

  // Build itemized breakdown
  const items: MaterialBreakdown["items"] = [];

  function addItem(name: string, qty: number, unitCost: number) {
    if (qty > 0) {
      items.push({ name, qty, unitCost, subtotal: Math.round(qty * unitCost * 100) / 100 });
    }
  }

  addItem("2×4 Lumber (8ft)", totalBoards, prices.lumber_2x4_8ft);
  addItem("Plywood Sheet", totalSheets, prices.plywood_sheet);
  addItem("Totes", totalTotes, prices.tote);
  addItem("Wheels (4pk)", totalWheelKits, prices.wheels_4pk);
  addItem('1⅝" Screws (145ct)', totalScrewBoxes16, prices.screw_1_5_8in_145ct);
  addItem('3" Screws (70ct)', totalScrewBoxes3, prices.screw_3in_70ct);
  addItem('1" Screws (90ct)', totalScrewBoxes1, prices.screw_1in_90ct);

  const totalCost = items.reduce((sum, i) => sum + i.subtotal, 0);

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    items,
    rawCounts: {
      screws_1_5_8: totalScrew16,
      screws_3: totalScrew3,
      screws_1: totalScrew1,
      plywood_strips: globalStripCount,
      plywood_top_sheets: globalTopSheets,
      lumber_boards: totalBoards,
      totes: totalTotes,
      wheel_kits: totalWheelKits,
    },
  };
}
