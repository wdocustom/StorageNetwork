"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Material Cost Calculator — Server Action (IP Protected)
//
// Moved from client-side utils to server action to protect:
//   - Bin-packing algorithm (FFD)
//   - Dimensional constants (openings, gaps, tier heights)
//   - Strip credit / structural sheet formulas
//
// The client receives only the final breakdown (quantities + costs),
// never the formulas that produce them.
// ═══════════════════════════════════════════════════════════════════════════

import type { MaterialConfig, MaterialBreakdown, MaterialPrices } from "@/utils/calculateMaterials";
import { DEFAULT_MATERIAL_PRICES } from "@/utils/calculateMaterials";
import { getShelvingConfig } from "@/lib/shelving";

// ── Constants (protected — never sent to browser) ────────────────────────

const STOCK_LENGTH = 96; // 8ft board
const KERF = 0.125;
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const GAP = 1.5; // post width (2x4)
const TIER_HEIGHT = 16;
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

// ── Server Action ────────────────────────────────────────────────────────

export async function calculateMaterialCostServer(
  configs: MaterialConfig | MaterialConfig[],
  customPrices?: MaterialPrices
): Promise<MaterialBreakdown> {
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

  const allParts: number[] = [];
  let totalScrew16 = 0;
  let totalScrew3 = 0;
  let totalScrew1 = 0;

  let shelvingPlywoodSheets = 0;

  for (const unit of units) {
    // ── Shelving unit path ────────────────────────────────────────────────
    if (unit.shelvingConfigId) {
      const cfg = getShelvingConfig(unit.shelvingConfigId);
      if (!cfg) continue;

      const m = cfg.materials;

      // Lumber parts for bin packing
      for (let i = 0; i < m.uprights; i++) allParts.push(m.uprightLen);
      for (let i = 0; i < m.rails; i++) allParts.push(m.railLen);
      for (let i = 0; i < m.depthBraces; i++) allParts.push(m.depthBraceLen);

      // Plywood sheets
      const totalSqFt = m.plywoodSurfaces * m.plywoodSqFtPerSurface;
      shelvingPlywoodSheets += Math.ceil(totalSqFt / 32);

      // Screws
      totalScrew3 += m.screws3;
      totalScrew16 += m.screws16;

      continue;
    }

    const { cols: totalCols, rows: totalRows, toteType = "HDX", hasTotes = false, hasWheels = false, hasTop = false } = unit;
    if (totalCols < 1 || totalRows < 1) continue;

    const widthModules: number[] = [];
    let remainingCols = totalCols;
    while (remainingCols > 4) {
      widthModules.push(4);
      remainingCols -= 4;
    }
    if (remainingCols > 0) widthModules.push(remainingCols);

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

      for (let tierIdx = 0; tierIdx < heightTiers.length; tierIdx++) {
        const tierRows = heightTiers[tierIdx];
        const slots = cols * tierRows;
        const uprightHeight = tierRows * TIER_HEIGHT;

        const postCount = modIdx === 0 ? (cols + 1) * 2 : cols * 2;
        for (let i = 0; i < postCount; i++) {
          allParts.push(uprightHeight);
        }

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

  // Global Bin Packing (FFD)
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

  totalScrewBoxes16 = Math.ceil(totalScrew16 / 158);
  totalScrewBoxes3 = Math.ceil(totalScrew3 / 137);
  totalScrewBoxes1 = Math.ceil(totalScrew1 / 90);

  const stripCredit = globalTopSheets * 27;
  let netStrips = globalStripCount - stripCredit;
  if (netStrips < 0) netStrips = 0;
  const structSheets = Math.ceil(netStrips / 72);
  totalSheets = structSheets + globalTopSheets + shelvingPlywoodSheets;

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
  addItem('1⅝" Screws (158ct)', totalScrewBoxes16, prices.screw_1_5_8in_158ct);
  addItem('3" Screws (137ct)', totalScrewBoxes3, prices.screw_3in_137ct);
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
      plywood_shelving_sheets: shelvingPlywoodSheets,
      lumber_boards: totalBoards,
      totes: totalTotes,
      wheel_kits: totalWheelKits,
    },
  };
}
