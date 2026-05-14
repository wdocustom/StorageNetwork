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
import { expandPresetUnits } from "@/lib/buildEngine.types";
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
import { roundMoney } from "@/utils/mathHelpers";

// ── Constants (protected — never sent to browser) ────────────────────────

const STOCK_LENGTH = 96; // 8ft board
const KERF = 0.125;
const FASTENER_ERROR_FACTOR = 0.05; // 5% overage for dropped/miscount/damaged screws

// ── Standard Unit Constants ─────────────────────────────────────────────
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const GAP = 1.5; // post width (2x4)
const TIER_HEIGHT = 16;
const MAX_ROWS_PER_TIER = Math.floor(STOCK_LENGTH / TIER_HEIGHT); // 6

// ── Mini Unit Constants ─────────────────────────────────────────────────
const MINI_OPENING = 8.25;
const MINI_GAP = 1.5;
const MINI_TIER_HEIGHT = 7;
const MINI_FIRST_RAIL_HEIGHT = 5.25;
const MINI_MAX_ROWS_PER_TIER = 13; // but mini is capped at 4 anyway

// ── Sideways Orientation Constants ─────────────────────────────────────
const SIDEWAYS_OPENING = 30.25;          // Tote depth becomes slot width

// ── 2x4 Rail Construction Constants ────────────────────────────────────
const RAILS_2X4_OPENING = 21;           // 21" universal opening
const RAILS_2X4_GAP = 1.5;              // 2x4 post width
const RAILS_2X4_DEPTH_STANDARD = 30;    // 30" rail depth (standard orientation)
const RAILS_2X4_DEPTH_SIDEWAYS = 20;    // 20" rail depth (sideways orientation)
const RAILS_2X4_TOP_GAP = 2.75;         // 2.75" above top rail
// Fixed rail positions (top of each rail from bottom of vertical posts).
// Rails 1-5 sit on a uniform 15.75" pitch with the upright reaching
// topRailPos + RAILS_2X4_TOP_GAP. Rail 6 sits at 92.5" (same pitch) but
// the upright is sized to STOCK_LENGTH (96") instead so the cut list
// emits a full 2x4x8 with no cut — top gap above rail 6 is 3.5".
// Must mirror the constants in src/lib/buildEngine.ts.
const RAILS_2X4_POSITIONS = [13.75, 29.5, 45.25, 61, 76.75, 92.5];
const RAILS_2X4_MAX_ROWS = 6;

/** Calculate how many rail pieces one 2x4x8' board yields at a given depth.
 *  Rip the 2x4 in half lengthwise → 2 strips, then crosscut each strip. */
function rails2x4PerBoard(depth: number): number {
  const cutsPerStrip = Math.floor(STOCK_LENGTH / (depth + KERF));
  return 2 * cutsPerStrip; // 2 strips from ripping
}

// ���─ Plywood Strip Yields ��─────────────��──────────────────────────────────
// Standard: 1-7/8" wide × 30" long strips
const STANDARD_STRIPS_PER_STRUCT_SHEET = 72;  // 24 rips × 3 pieces
const STANDARD_STRIPS_PER_TOP_OFFCUT = 27;

// Mini: 1" wide × 12.75" long strips (from NEW plywood only)
//   48" / (1" + 0.125" kerf) = 42 rips × floor(96" / 12.875") = 7 pieces = 294
const MINI_STRIPS_PER_STRUCT_SHEET = 294;
// Mini top offcut: top is small (~40.5"×12.75"), leaves most of 4×8 for 1" strips
//   Conservative: 42 rips × 4 pieces from remainder ≈ 200+
const MINI_STRIPS_PER_TOP_OFFCUT = 200;

function splitHeightTiers(totalRows: number, unitType: "standard" | "mini" = "standard", use2x4Rails = false): number[] {
  if (use2x4Rails) {
    // 2x4 rail mode: max 6 rows, no height tiering (posts fit within 8' —
    // 6-high uses the full 96" stock as the post, no cut).
    const capped = Math.min(totalRows, RAILS_2X4_MAX_ROWS);
    return [capped];
  }
  const maxRows = unitType === "mini" ? MINI_MAX_ROWS_PER_TIER : MAX_ROWS_PER_TIER;
  if (totalRows <= maxRows) return [totalRows];
  const tiers: number[] = [];
  let remaining = totalRows;
  while (remaining > maxRows) {
    tiers.push(maxRows);
    remaining -= maxRows;
  }
  if (remaining > 0) tiers.push(remaining);
  return tiers;
}

function calcUprightHeight(rows: number, unitType: "standard" | "mini", use2x4Rails = false): number {
  if (use2x4Rails) {
    // 2x4 rail mode: post height = top rail position + 2.75" top gap.
    // Rail positions measured from bottom of posts (not bottom of unit/plate).
    // Special case at the max (6 rows): post = full 8' stock, no cut.
    const cappedRows = Math.min(rows, RAILS_2X4_MAX_ROWS);
    if (cappedRows >= RAILS_2X4_MAX_ROWS) return STOCK_LENGTH;
    return RAILS_2X4_POSITIONS[cappedRows - 1] + RAILS_2X4_TOP_GAP;
  }
  if (unitType === "mini") {
    return MINI_FIRST_RAIL_HEIGHT + (rows - 1) * MINI_TIER_HEIGHT + 2;
  }
  return rows * TIER_HEIGHT;
}

// ── Server Action ────────────────────────────────────────────────────────

export async function calculateMaterialCostServer(
  configs: MaterialConfig | MaterialConfig[],
  customPrices?: MaterialPrices,
  inventory?: MaterialInventory | null,
): Promise<MaterialBreakdown> {
  const rawUnits = Array.isArray(configs) ? configs : [configs];
  const units = expandPresetUnits(rawUnits);
  const prices = { ...DEFAULT_MATERIAL_PRICES, ...customPrices };

  let totalBoards = 0;
  let totalSheets = 0;
  let totalTotes = 0;
  let totalWheelKits = 0;
  let totalScrewBoxes1 = 0;
  let totalScrewBoxes16 = 0;
  let totalScrewBoxes3 = 0;

  let globalStripCount = 0;      // standard-width strips (1-7/8")
  let globalMiniStripCount = 0;  // mini-width strips (1")
  let global2x4RailCount = 0;   // 2x4 rail pieces (ripped from 2x4x8')
  let globalTopSheets = 0;
  let globalMiniTopSheets = 0;

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
    const unitType = unit.unitType ?? "standard";
    const orientation = unit.orientation ?? "standard";
    const isMini = unitType === "mini";
    const is2x4Rails = unit.use2x4Rails === true;
    const rails2x4Depth = orientation === "sideways" ? RAILS_2X4_DEPTH_SIDEWAYS : RAILS_2X4_DEPTH_STANDARD;
    if (totalCols < 1 || totalRows < 1) continue;

    const effectiveHasTotes = hasTotes;

    const widthModules: number[] = [];
    let remainingCols = totalCols;
    while (remainingCols > 4) {
      widthModules.push(4);
      remainingCols -= 4;
    }
    if (remainingCols > 0) widthModules.push(remainingCols);

    const heightTiers = splitHeightTiers(totalRows, unitType, is2x4Rails);

    if (hasWheels) {
      totalWheelKits++;
      totalScrew1 += 16;
    }

    let unitTotalWidth = 0;

    for (let modIdx = 0; modIdx < widthModules.length; modIdx++) {
      const cols = widthModules[modIdx];
      const opening = is2x4Rails
        ? (orientation === "sideways" ? SIDEWAYS_OPENING : RAILS_2X4_OPENING)
        : (isMini ? MINI_OPENING : (orientation === "sideways" ? SIDEWAYS_OPENING : (toteType === "HDX" ? OPENING_HDX : OPENING_GM)));
      const gap = is2x4Rails ? RAILS_2X4_GAP : (isMini ? MINI_GAP : GAP);
      const modWidth = cols * opening + (cols + 1) * gap;
      unitTotalWidth += modWidth;

      for (let tierIdx = 0; tierIdx < heightTiers.length; tierIdx++) {
        const tierRows = heightTiers[tierIdx];
        const slots = cols * tierRows;
        const uprightHeight = calcUprightHeight(tierRows, unitType, is2x4Rails);

        // Posts: every module has posts on both ends
        const postCount = (cols + 1) * 2;
        for (let i = 0; i < postCount; i++) {
          allParts.push(uprightHeight);
        }

        // Plates: 2x4 rail mode has top + bottom plates (4), standard has 4, mini has 2
        const numPlates = is2x4Rails ? 4 : (isMini ? 2 : 4);
        for (let k = 0; k < numPlates; k++) {
          allParts.push(modWidth);
        }

        // Rails and back supports
        const numRails = slots * 2;
        const backSupports = cols <= 4 ? 4 : 6;

        if (is2x4Rails) {
          // 2x4 rail mode: rails + back supports are ripped 2x4 pieces
          global2x4RailCount += numRails + backSupports;
        } else if (isMini) {
          globalMiniStripCount += numRails + backSupports;
        } else {
          globalStripCount += numRails + backSupports;
        }

        if (is2x4Rails) {
          // 2x4 rails: 3" screws for rail-to-post (4 per rail piece)
          totalScrew3 += numRails * 4;
        } else {
          // Plywood strips: 1⅝" screws (4 per strip)
          totalScrew16 += numRails * 4;
        }
        // Structural: posts to plates (3" screws)
        totalScrew3 += (cols + 1) * 20;

        if (effectiveHasTotes) totalTotes += slots;
      }
    }

    // ── Top / Plywood Sheets ─────────────────────────────────────────
    // 2x4 rail mode: plywood top is optional (same as standard), no special handling
    const effectiveHasTop = isMini || hasTop;
    if (effectiveHasTop && !is2x4Rails) {
      let sheetsForUnit = 0;
      if (unitTotalWidth > 192) sheetsForUnit = 3;
      else if (unitTotalWidth > 96) sheetsForUnit = 2;
      else sheetsForUnit = 1;

      if (isMini) {
        // Mini top sheets — the top is small so one sheet covers the top
        // AND produces enough 1" strips for all rails (typically 200+ strips
        // from the offcut vs ~36 needed). Track separately from standard.
        globalMiniTopSheets += sheetsForUnit;
      } else {
        // ── Single-sheet optimization for ≤5×2 HDX units with top ─────
        // When the unit is small enough (≤5 cols, ≤2 rows, HDX totes), both
        // top pieces, all rails, and back supports fit on ONE 4×8 sheet.
        if (sheetsForUnit === 2 && totalCols <= 5 && totalRows <= 2 && toteType === "HDX") {
          sheetsForUnit = 1;
          const unitBackSupports = widthModules.reduce((sum, c) => sum + (c <= 4 ? 4 : 6), 0) * heightTiers.length;
          globalStripCount -= unitBackSupports;
        }

        globalTopSheets += sheetsForUnit;
      }
    } else if (effectiveHasTop && is2x4Rails) {
      // 2x4 rail mode with plywood top — no strip credit (rails are 2x4, not plywood)
      let sheetsForUnit = 0;
      if (unitTotalWidth > 192) sheetsForUnit = 3;
      else if (unitTotalWidth > 96) sheetsForUnit = 2;
      else sheetsForUnit = 1;
      globalTopSheets += sheetsForUnit;
    }

    // ── Section Addons (material impact) ──────────────────────────────
    const unitAddons = unit.addons ?? [];
    for (const addon of unitAddons) {
      switch (addon.type) {
        case "rail_removed":
          // Saves 2 rail pieces and 8 screws (1⅝")
          if (is2x4Rails) {
            global2x4RailCount -= 2;
          } else {
            globalStripCount -= 2;
          }
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
  if (global2x4RailCount < 0) global2x4RailCount = 0;
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

  // ── Standard strip calculation ────────────────────────────────────────
  const stripCredit = globalTopSheets * STANDARD_STRIPS_PER_TOP_OFFCUT;
  let netStrips = globalStripCount - stripCredit;
  if (netStrips < 0) netStrips = 0;
  const structSheets = Math.ceil(netStrips / STANDARD_STRIPS_PER_STRUCT_SHEET);

  // ── Mini strip calculation ──────────────────────────────────────────
  // Mini strips (1" wide) are separate from standard (1-7/8") strips.
  // When buying NEW plywood for mini: 294 strips per structural sheet.
  // But first, use any inventory plywood strips (standard 1-7/8" or mini 1"
  // — wider strips from standard builds work fine as mini rails).
  const inventoryStrips = inventory?.plywood_strips ?? 0;
  const inventoryMiniStrips = inventory?.plywood_strips_mini ?? 0;

  // Mini strips from this job's top sheet offcuts (cut at 1")
  const miniStripCredit = globalMiniTopSheets * MINI_STRIPS_PER_TOP_OFFCUT;
  // Available mini strips: inventory (mini + standard) + this job's top offcuts
  const availableMiniStrips = inventoryMiniStrips + inventoryStrips + miniStripCredit;
  let netMiniStrips = globalMiniStripCount - availableMiniStrips;
  if (netMiniStrips < 0) netMiniStrips = 0;
  const miniStructSheets = Math.ceil(netMiniStrips / MINI_STRIPS_PER_STRUCT_SHEET);

  // ── 2x4 Rail board calculation ─────────────────────────────────────────
  // 2x4 rails are ripped from 2x4x8' lumber. Yield depends on rail depth:
  //   Standard (30"): 2 strips × 3 cuts = 6 per board
  //   Sideways (20"): 2 strips × 4 cuts = 8 per board
  // When a job mixes orientations, we use the worst-case (lowest yield).
  // For now, detect the orientation from the first 2x4 unit in the job.
  const rails2x4YieldPerBoard = (() => {
    for (const u of units) {
      if (u.use2x4Rails) {
        const d = (u.orientation ?? "standard") === "sideways" ? RAILS_2X4_DEPTH_SIDEWAYS : RAILS_2X4_DEPTH_STANDARD;
        return rails2x4PerBoard(d);
      }
    }
    return rails2x4PerBoard(RAILS_2X4_DEPTH_STANDARD); // fallback
  })();
  const railBoards2x4 = global2x4RailCount > 0 ? Math.ceil(global2x4RailCount / rails2x4YieldPerBoard) : 0;
  totalBoards += railBoards2x4;

  totalSheets = structSheets + globalTopSheets + miniStructSheets + globalMiniTopSheets + shelvingPlywoodSheets + totalAddonSheets;

  const items: MaterialBreakdown["items"] = [];

  function addItem(name: string, qty: number, unitCost: number) {
    if (qty > 0) {
      items.push({ name, qty, unitCost, subtotal: roundMoney(qty * unitCost) });
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
    totalCost: roundMoney(totalCost),
    items,
    rawCounts: {
      screws_1_5_8: totalScrew16,
      screws_3: totalScrew3,
      screws_1: totalScrew1,
      plywood_strips: globalStripCount,
      plywood_strips_mini: globalMiniStripCount,
      plywood_top_sheets: globalTopSheets + globalMiniTopSheets,
      plywood_shelving_sheets: shelvingPlywoodSheets,
      plywood_addon_sheets: totalAddonSheets,
      lumber_boards: totalBoards,
      rails_2x4_pieces: global2x4RailCount,
      rails_2x4_boards: railBoards2x4,
      totes: totalTotes,
      wheel_kits: totalWheelKits,
      lumber_part_lengths: allParts,
      overhead_lag_bolts: overheadLagBolts,
      overhead_structural_screws: overheadStructuralScrews,
      overhead_plywood_sheets: overheadPlywoodSheets,
    },
  };
}
