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
import {
  OVERHEAD_GRID_PRESETS,
  calculateOverheadStorage,
  type OverheadStorageConfig,
} from "@/lib/overhead-storage";
import {
  type MaterialInventory,
  fillPartsFromOffcuts,
} from "@/utils/inventoryManager";

// ── Constants (protected — never sent to browser) ────────────────────────

const STOCK_LENGTH = 96; // 8ft board
const KERF = 0.125;
const FASTENER_ERROR_FACTOR = 0.05; // 5% overage for dropped/miscount/damaged screws
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
  customPrices?: MaterialPrices,
  inventory?: MaterialInventory | null,
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

  // Overhead accumulators
  let overheadLagBolts = 0;
  let overheadStructuralScrews = 0;
  let overheadPlywoodSheets = 0;
  let overheadNailers = 0;  // 2×4 lumber count for nailers + padding beams
  let overheadTotes = 0;

  // Addon accumulators
  let addonDoors = 0;
  let addonPanels = 0;
  let addonShelves = 0;

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

    // ── Overhead ceiling storage unit path ─────────────────────────────────
    if (unit.overheadGridPresetId) {
      const preset = OVERHEAD_GRID_PRESETS.find((p) => p.id === unit.overheadGridPresetId);
      if (!preset) continue;

      const config: OverheadStorageConfig = {
        gridPresetId: unit.overheadGridPresetId,
        toteType: unit.toteType || "HDX",
        hasTotes: unit.hasTotes ?? false,
      };
      const result = calculateOverheadStorage(config);

      // Overhead uses its own hardware — separate from tote organizer screws.
      // We track overhead materials independently so the profit calculator
      // shows accurate line items.
      for (const mat of result.materials) {
        if (mat.name.includes("Nailer") || mat.name.includes("Padding")) {
          overheadNailers += mat.qty;
        } else if (mat.name.includes("Plywood Sheets")) {
          overheadPlywoodSheets += mat.qty;
        } else if (mat.name.includes("Lag Bolt")) {
          overheadLagBolts += mat.qty;
        } else if (mat.name.includes("Structural Screw")) {
          overheadStructuralScrews += mat.qty;
        } else if (mat.name.includes("Tote")) {
          overheadTotes += mat.qty;
        }
      }

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

      // ── Single-sheet optimization for ≤5×2 HDX units with top ─────
      // When the unit is small enough (≤5 cols, ≤2 rows, HDX totes), both
      // top pieces, all rails, and back supports fit on ONE 4×8 sheet:
      //   - 30"×96" rip → Top #1 (full width top)
      //   - 18"×96" rip → Top #2 (11-3/4"×30") + 21 rails (1-7/8"×30")
      //   - Offcuts yield enough back supports (≥12" pieces from waste strips
      //     and the extra rail split): no dedicated strips needed for back supports.
      // HDX only: Greenmade's wider opening (20.75") makes Top #2 = 18.25",
      // which exceeds the 18" remainder strip after the 30" rip.
      if (sheetsForUnit === 2 && totalCols <= 5 && totalRows <= 2 && toteType === "HDX") {
        sheetsForUnit = 1;
        // Back supports come from offcuts — remove them from the strip count
        // so they don't inflate the structural sheet requirement.
        const unitBackSupports = widthModules.reduce((sum, c) => sum + (c <= 4 ? 4 : 6), 0) * heightTiers.length;
        globalStripCount -= unitBackSupports;
      }

      globalTopSheets += sheetsForUnit;
    }

    // ── Section Addons (material impact) ──────────────────────────────
    const unitAddons = unit.addons ?? [];
    for (const addon of unitAddons) {
      switch (addon.type) {
        case "rail_removed":
          // Saves 2 plywood strips and 8 screws (1⅝")
          globalStripCount -= 2;
          totalScrew16 -= 8;
          break;
        case "shelf":
          addonShelves++;
          // Adds 4 screws (1⅝") to mount the shelf insert
          totalScrew16 += 4;
          break;
        case "plywood_door":
          if (addon.target === "doors_on") {
            addonDoors += totalCols;
          } else {
            addonDoors++;
          }
          break;
        case "side_panel":
          addonPanels++;
          break;
      }
    }
  }

  // Clamp after addon adjustments
  if (globalStripCount < 0) globalStripCount = 0;
  if (totalScrew16 < 0) totalScrew16 = 0;

  // Addon plywood sheets: doors (~4/sheet), panels (~2/sheet), shelves (~4/sheet)
  const addonDoorSheets = addonDoors > 0 ? Math.ceil(addonDoors / 4) : 0;
  const addonPanelSheets = addonPanels > 0 ? Math.ceil(addonPanels / 2) : 0;
  const addonShelfSheets = addonShelves > 0 ? Math.ceil(addonShelves / 4) : 0;
  const totalAddonSheets = addonDoorSheets + addonPanelSheets + addonShelfSheets;

  // ── Inventory-aware bin packing ──────────────────────────────────────────
  // If the installer has lumber offcuts in inventory, try to fill parts from
  // those first (vertical posts and plates for mini units often fit in offcuts
  // from previous standard builds). Only buy fresh 2x4s for what remains.
  let partsForFreshStock = allParts;
  let offcutsUsedCount = 0;

  if (inventory?.lumber_offcuts && inventory.lumber_offcuts.length > 0) {
    const result = fillPartsFromOffcuts(allParts, inventory.lumber_offcuts);
    offcutsUsedCount = result.placedCount;
    partsForFreshStock = result.remainingParts;
  }

  // Global Bin Packing (FFD) — only for parts not covered by offcuts
  partsForFreshStock.sort((a, b) => b - a);
  const bins: number[] = [];
  for (const len of partsForFreshStock) {
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

  // Apply human error factor to fastener counts (dropped, miscounted, damaged)
  totalScrew16 = Math.ceil(totalScrew16 * (1 + FASTENER_ERROR_FACTOR));
  totalScrew3 = Math.ceil(totalScrew3 * (1 + FASTENER_ERROR_FACTOR));
  totalScrew1 = Math.ceil(totalScrew1 * (1 + FASTENER_ERROR_FACTOR));

  totalScrewBoxes16 = Math.ceil(totalScrew16 / 158);
  totalScrewBoxes3 = Math.ceil(totalScrew3 / 137);
  totalScrewBoxes1 = Math.ceil(totalScrew1 / 90);

  const stripCredit = globalTopSheets * 27;
  let netStrips = globalStripCount - stripCredit;
  if (netStrips < 0) netStrips = 0;
  const structSheets = Math.ceil(netStrips / 72);
  totalSheets = structSheets + globalTopSheets + shelvingPlywoodSheets + totalAddonSheets;

  const items: MaterialBreakdown["items"] = [];

  function addItem(name: string, qty: number, unitCost: number) {
    if (qty > 0) {
      items.push({ name, qty, unitCost, subtotal: Math.round(qty * unitCost * 100) / 100 });
    }
  }

  if (offcutsUsedCount > 0 && totalBoards > 0) {
    addItem(`2×4 Lumber (8ft)`, totalBoards, prices.lumber_2x4_8ft);
    // Show offcut savings as a zero-cost info line
    items.push({
      name: `2×4 from offcuts`,
      qty: offcutsUsedCount,
      unitCost: 0,
      subtotal: 0,
    });
  } else if (offcutsUsedCount > 0 && totalBoards === 0) {
    // All lumber covered by offcuts
    items.push({
      name: `2×4 from offcuts`,
      qty: offcutsUsedCount,
      unitCost: 0,
      subtotal: 0,
    });
  } else {
    addItem("2×4 Lumber (8ft)", totalBoards, prices.lumber_2x4_8ft);
  }
  addItem("Plywood Sheet", totalSheets, prices.plywood_sheet);
  addItem("Totes", totalTotes, prices.tote);
  addItem("Wheels (4pk)", totalWheelKits, prices.wheels_4pk);
  addItem('1⅝" Screws (158ct)', totalScrewBoxes16, prices.screw_1_5_8in_158ct);
  addItem('3" Screws (137ct)', totalScrewBoxes3, prices.screw_3in_137ct);
  addItem('1" Screws (90ct)', totalScrewBoxes1, prices.screw_1in_90ct);

  // ── Overhead ceiling storage materials ────────────────────────────────
  // Overhead uses 2×4s (nailers + padding beams), plywood, lag bolts, and
  // structural screws — all separate from the tote organizer system.
  addItem("Overhead: 2×4 Lumber (8ft)", overheadNailers, prices.lumber_2x4_8ft);
  addItem("Overhead: Plywood Sheet (4×8)", overheadPlywoodSheets, prices.plywood_sheet);
  addItem("Overhead: Totes", overheadTotes, prices.tote);
  // Lag bolts & structural screws — estimate $0.30/bolt, $0.10/screw
  addItem("Overhead: 5/16\" Lag Bolts + Washers", overheadLagBolts, 0.30);
  addItem("Overhead: 3\" Structural Screws", overheadStructuralScrews, 0.10);

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
      plywood_addon_sheets: totalAddonSheets,
      lumber_boards: totalBoards,
      totes: totalTotes,
      wheel_kits: totalWheelKits,
      lumber_part_lengths: allParts,
      overhead_lag_bolts: overheadLagBolts,
      overhead_structural_screws: overheadStructuralScrews,
      overhead_plywood_sheets: overheadPlywoodSheets,
    },
  };
}
