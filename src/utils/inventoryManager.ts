// ═══════════════════════════════════════════════════════════════════════════
// Inventory Manager — Cross-job material tracking
//
// Tracks individual screw counts and plywood strip offcuts across jobs.
// Calculates NET purchase lists (what to actually buy) and updates running
// inventory after each completed job.
//
// The system is "quiet": installers only see what they NEED to buy.
// Items with adequate stock are omitted from the purchase list entirely.
// ═══════════════════════════════════════════════════════════════════════════

// ── Box / Sheet Sizes ────────────────────────────────────────────────────

export const BOX_SIZES = {
  screws_1_5_8: 158,
  screws_3: 137,
  screws_1: 90,
  plywood_strips_per_struct_sheet: 72,     // standard 1-7/8" × 30" strips
  plywood_strips_per_top_offcut: 27,       // from standard top sheet offcuts
  plywood_mini_strips_per_struct_sheet: 294, // mini 1" × 12.75" strips: 42 rips × 7 pieces
} as const;

// ── Lumber offcut constants ──────────────────────────────────────────────
export const KERF = 0.125; // blade width
export const STOCK_LENGTH = 96; // 8ft 2x4

// ── Inventory Shape ──────────────────────────────────────────────────────

/** A leftover 2x4 piece with a usable length in inches. */
export interface LumberOffcut {
  length: number; // usable length in inches
}

export interface MaterialInventory {
  // ── Screws ──────────────────────────────────────────────────────────
  screws_1_5_8: number; // individual count
  screws_3: number; // individual count
  screws_1: number; // individual count

  // ── Plywood ─────────────────────────────────────────────────────────
  plywood_sheets_full: number; // full 4x8 sheets on hand (uncut)
  plywood_strips: number; // standard-width rail strips (1-7/8") from offcuts
  plywood_strips_mini: number; // mini-width rail strips (1") from offcuts

  // ── 2×4 Lumber ──────────────────────────────────────────────────────
  lumber_2x4_full: number; // full 8ft 2x4 boards on hand (uncut)
  lumber_offcuts: LumberOffcut[]; // 2x4 offcuts from previous builds

  // ── 2×4 Rail Construction ───────────────────────────────────────────
  rails_2x4_pieces: number; // pre-ripped 2x4 rail pieces on hand

  // ── Casters ─────────────────────────────────────────────────────────
  caster_kits: number; // 4-pack caster kits on hand
}

export const EMPTY_INVENTORY: MaterialInventory = {
  screws_1_5_8: 0,
  screws_3: 0,
  screws_1: 0,
  plywood_sheets_full: 0,
  plywood_strips: 0,
  plywood_strips_mini: 0,
  lumber_2x4_full: 0,
  lumber_offcuts: [],
  rails_2x4_pieces: 0,
  caster_kits: 0,
};

/** Ensure we always have a valid inventory object. */
export function normalizeInventory(raw: unknown): MaterialInventory {
  if (!raw || typeof raw !== "object") return { ...EMPTY_INVENTORY };
  const inv = raw as Record<string, unknown>;

  // Normalize lumber_offcuts: accept array of {length} objects, filter invalid
  let offcuts: LumberOffcut[] = [];
  if (Array.isArray(inv.lumber_offcuts)) {
    offcuts = (inv.lumber_offcuts as unknown[])
      .filter((o): o is { length: number } =>
        typeof o === "object" && o !== null && typeof (o as Record<string, unknown>).length === "number"
      )
      .map((o) => ({ length: Math.max(0, o.length) }))
      .filter((o) => o.length > 0);
  }

  return {
    screws_1_5_8: Math.max(0, Number(inv.screws_1_5_8) || 0),
    screws_3: Math.max(0, Number(inv.screws_3) || 0),
    screws_1: Math.max(0, Number(inv.screws_1) || 0),
    plywood_sheets_full: Math.max(0, Math.floor(Number(inv.plywood_sheets_full) || 0)),
    plywood_strips: Math.max(0, Number(inv.plywood_strips) || 0),
    plywood_strips_mini: Math.max(0, Number(inv.plywood_strips_mini) || 0),
    lumber_2x4_full: Math.max(0, Math.floor(Number(inv.lumber_2x4_full) || 0)),
    lumber_offcuts: offcuts,
    rails_2x4_pieces: Math.max(0, Math.floor(Number(inv.rails_2x4_pieces) || 0)),
    caster_kits: Math.max(0, Math.floor(Number(inv.caster_kits) || 0)),
  };
}

/**
 * Try to fill parts from available lumber offcuts (First Fit Decreasing).
 * Returns { placed, remaining, offcutsAfter } where:
 *  - placed: parts that fit into existing offcuts
 *  - remaining: parts that need fresh stock
 *  - offcutsAfter: updated offcut pool after placement
 */
export function fillPartsFromOffcuts(
  partLengths: number[],
  offcuts: LumberOffcut[],
): { placedCount: number; remainingParts: number[]; offcutsAfter: LumberOffcut[] } {
  // Sort parts longest-first (FFD)
  const sorted = [...partLengths].sort((a, b) => b - a);
  // Copy offcuts so we can mutate
  const pool = offcuts.map((o) => ({ ...o }));
  // Sort offcuts longest-first for best fit
  pool.sort((a, b) => b.length - a.length);

  const remaining: number[] = [];
  let placedCount = 0;

  for (const partLen of sorted) {
    let placed = false;
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].length >= partLen + KERF) {
        pool[i].length -= partLen + KERF;
        placed = true;
        placedCount++;
        break;
      } else if (pool[i].length >= partLen) {
        // Exact fit (no kerf remainder needed)
        pool[i].length = 0;
        placed = true;
        placedCount++;
        break;
      }
    }
    if (!placed) {
      remaining.push(partLen);
    }
  }

  // Filter out offcuts that are too small to be useful (< 6")
  const offcutsAfter = pool.filter((o) => o.length >= 6);
  return { placedCount, remainingParts: remaining, offcutsAfter };
}

/**
 * Calculate offcuts generated from bin-packing fresh 2x4 stock.
 * Returns an array of usable offcut lengths (>= 6").
 */
export function calculateNewOffcuts(partLengths: number[]): LumberOffcut[] {
  const sorted = [...partLengths].sort((a, b) => b - a);
  const bins: number[] = [];
  for (const len of sorted) {
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
  // Return usable offcuts (>= 6")
  return bins.filter((rem) => rem >= 6).map((rem) => ({ length: rem }));
}

// ── Raw Job Needs ────────────────────────────────────────────────────────
// These come from calculateMaterialCost().rawCounts

export interface RawJobNeeds {
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
  /** Individual 2x4 part lengths (inches) for offcut-aware bin packing. */
  lumber_part_lengths?: number[];
  /** Total 2×4 rail pieces needed (when use2x4Rails is enabled). */
  rails_2x4_pieces?: number;
  /** 2×4 boards needed specifically for rail ripping. */
  rails_2x4_boards?: number;
}

// ── Net Purchase Item ────────────────────────────────────────────────────

export interface NetPurchaseItem {
  name: string;
  detail: string;
  qty: number | string;
  /** True if inventory fully covers this item (omit from purchase list). */
  covered: boolean;
}

// ── Net Purchase Result ──────────────────────────────────────────────────

export interface NetPurchaseResult {
  /** Items the installer needs to BUY. Items with covered=true are omitted. */
  items: NetPurchaseItem[];
  /** Number of items fully covered by inventory (shown as a summary note). */
  coveredCount: number;
  /** Projected inventory AFTER this job, assuming recommended purchases. */
  inventoryAfter: MaterialInventory;
}

// ═══════════════════════════════════════════════════════════════════════════
// calculateNetPurchaseList
//
// Given raw job needs + current inventory, determines:
//  1. What needs to be PURCHASED (net of inventory)
//  2. What inventory looks like AFTER the job
// ═══════════════════════════════════════════════════════════════════════════

export function calculateNetPurchaseList(
  raw: RawJobNeeds,
  inventory: MaterialInventory
): NetPurchaseResult {
  const items: NetPurchaseItem[] = [];
  let coveredCount = 0;

  // ── Lumber (full boards + offcuts) ────────────────────────────────────
  // Priority: 1) offcuts, 2) full boards from inventory, 3) buy new
  const partLengths = raw.lumber_part_lengths ?? [];
  let boardsToBuy = raw.lumber_boards;
  let offcutsUsed = 0;
  let fullBoardsUsed = 0;
  let offcutsAfterLumber = inventory.lumber_offcuts;
  let newOffcuts: LumberOffcut[] = [];
  let fullBoardsRemaining = inventory.lumber_2x4_full;

  if (partLengths.length > 0) {
    // Step 1: Fill from offcuts
    if (inventory.lumber_offcuts.length > 0) {
      const result = fillPartsFromOffcuts(partLengths, inventory.lumber_offcuts);
      offcutsUsed = result.placedCount;
      offcutsAfterLumber = result.offcutsAfter;

      // Step 2: Bin-pack remaining parts, using full boards from inventory first
      if (result.remainingParts.length > 0) {
        const sorted = [...result.remainingParts].sort((a, b) => b - a);
        const bins: number[] = [];
        for (const len of sorted) {
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
        const totalBoardsNeeded = bins.length;
        fullBoardsUsed = Math.min(fullBoardsRemaining, totalBoardsNeeded);
        fullBoardsRemaining -= fullBoardsUsed;
        boardsToBuy = totalBoardsNeeded - fullBoardsUsed;
        newOffcuts = bins.filter((rem) => rem >= 6).map((rem) => ({ length: rem }));
      } else {
        boardsToBuy = 0;
        newOffcuts = [];
      }
    } else {
      // No offcuts — bin-pack all parts, using full boards from inventory first
      const sorted = [...partLengths].sort((a, b) => b - a);
      const bins: number[] = [];
      for (const len of sorted) {
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
      const totalBoardsNeeded = bins.length;
      fullBoardsUsed = Math.min(fullBoardsRemaining, totalBoardsNeeded);
      fullBoardsRemaining -= fullBoardsUsed;
      boardsToBuy = totalBoardsNeeded - fullBoardsUsed;
      newOffcuts = bins.filter((rem) => rem >= 6).map((rem) => ({ length: rem }));
    }
  } else if (raw.lumber_boards > 0) {
    // No part lengths — simple board count (rare fallback)
    fullBoardsUsed = Math.min(fullBoardsRemaining, raw.lumber_boards);
    fullBoardsRemaining -= fullBoardsUsed;
    boardsToBuy = raw.lumber_boards - fullBoardsUsed;
  }

  const totalLumberSaved = offcutsUsed + fullBoardsUsed;

  if (boardsToBuy > 0) {
    const savingsNote = totalLumberSaved > 0
      ? ` — ${offcutsUsed > 0 ? `${offcutsUsed} from offcuts` : ""}${offcutsUsed > 0 && fullBoardsUsed > 0 ? ", " : ""}${fullBoardsUsed > 0 ? `${fullBoardsUsed} from stock` : ""}`
      : "";
    items.push({
      name: "2×4 Lumber (8ft)",
      detail: `Cut to length per plan${savingsNote}`,
      qty: boardsToBuy,
      covered: false,
    });
  } else if (raw.lumber_boards > 0 && totalLumberSaved > 0) {
    coveredCount++;
    items.push({
      name: "2×4 Lumber (8ft)",
      detail: `In stock — all parts covered`,
      qty: 0,
      covered: true,
    });
  }

  // ── 2×4 Rail Pieces (inventory-tracked) ───────────────────────────────
  const railPiecesNeeded = raw.rails_2x4_pieces ?? 0;
  let railPiecesFromStock = 0;
  let railBoardsToBuy = raw.rails_2x4_boards ?? 0;
  let railPiecesRemaining = inventory.rails_2x4_pieces;

  if (railPiecesNeeded > 0 && railPiecesRemaining > 0) {
    railPiecesFromStock = Math.min(railPiecesRemaining, railPiecesNeeded);
    railPiecesRemaining -= railPiecesFromStock;
    const piecesStillNeeded = railPiecesNeeded - railPiecesFromStock;
    if (piecesStillNeeded <= 0) {
      railBoardsToBuy = 0;
    } else {
      // Recalculate boards needed for remaining rail pieces
      // Use the yield from raw counts ratio
      const yieldPerBoard = railPiecesNeeded > 0 && (raw.rails_2x4_boards ?? 0) > 0
        ? Math.ceil(railPiecesNeeded / (raw.rails_2x4_boards ?? 1))
        : 6; // fallback: standard depth yields 6/board
      railBoardsToBuy = Math.ceil(piecesStillNeeded / yieldPerBoard);
    }
  }

  // New rail pieces from fresh boards (leftover after cutting what's needed)
  let newRailPieces = 0;
  if (railBoardsToBuy > 0 && railPiecesNeeded > 0) {
    const yieldPerBoard = railPiecesNeeded > 0 && (raw.rails_2x4_boards ?? 0) > 0
      ? Math.ceil(railPiecesNeeded / (raw.rails_2x4_boards ?? 1))
      : 6;
    const totalFromFresh = railBoardsToBuy * yieldPerBoard;
    const piecesStillNeeded = railPiecesNeeded - railPiecesFromStock;
    newRailPieces = Math.max(0, totalFromFresh - piecesStillNeeded);
  }

  // ── Plywood (full sheets + strips) ───────────────────────────────────
  // Full sheets from inventory can serve as structural sheets (72 strips each)
  // or top sheets. Priority: use full sheets for structural needs first.
  //
  // First build logic: when buying a full sheet for structural strips,
  // the ENTIRE sheet is ripped (72 strips) because partial-sheet offcuts
  // can't serve as tops (need 30" depth). So first structural sheet
  // purchase = 72 strips into inventory, then the build consumes what it needs.

  const stripsFromTops = raw.plywood_top_sheets * BOX_SIZES.plywood_strips_per_top_offcut;
  const availableStrips = inventory.plywood_strips + stripsFromTops;
  const netStripNeed = Math.max(0, raw.plywood_strips - availableStrips);
  let structSheetsToBuy = Math.ceil(netStripNeed / BOX_SIZES.plywood_strips_per_struct_sheet);

  // Use full plywood sheets from inventory for structural needs
  let fullSheetsUsedForStruct = 0;
  let fullSheetsRemaining = inventory.plywood_sheets_full;
  if (structSheetsToBuy > 0 && fullSheetsRemaining > 0) {
    fullSheetsUsedForStruct = Math.min(fullSheetsRemaining, structSheetsToBuy);
    fullSheetsRemaining -= fullSheetsUsedForStruct;
    structSheetsToBuy -= fullSheetsUsedForStruct;
  }

  // Mini strips
  const standardInventoryAfterStandard = Math.max(0,
    inventory.plywood_strips + stripsFromTops
    + (structSheetsToBuy + fullSheetsUsedForStruct) * BOX_SIZES.plywood_strips_per_struct_sheet
    - raw.plywood_strips
  );
  const availableMiniStrips = inventory.plywood_strips_mini + standardInventoryAfterStandard;
  const netMiniStripNeed = Math.max(0, (raw.plywood_strips_mini ?? 0) - availableMiniStrips);
  let miniStructSheetsToBuy = Math.ceil(netMiniStripNeed / BOX_SIZES.plywood_mini_strips_per_struct_sheet);

  // Use full sheets for mini structural if needed
  let fullSheetsUsedForMini = 0;
  if (miniStructSheetsToBuy > 0 && fullSheetsRemaining > 0) {
    fullSheetsUsedForMini = Math.min(fullSheetsRemaining, miniStructSheetsToBuy);
    fullSheetsRemaining -= fullSheetsUsedForMini;
    miniStructSheetsToBuy -= fullSheetsUsedForMini;
  }

  const shelvingSheets = raw.plywood_shelving_sheets || 0;
  const addonSheets = raw.plywood_addon_sheets || 0;
  const totalPlywoodSheets = raw.plywood_top_sheets + structSheetsToBuy + miniStructSheetsToBuy + shelvingSheets + addonSheets;

  // Remaining strips after this job
  const totalStructSheets = structSheetsToBuy + fullSheetsUsedForStruct;
  const stripsAfter =
    availableStrips +
    totalStructSheets * BOX_SIZES.plywood_strips_per_struct_sheet -
    raw.plywood_strips;

  const totalMiniStructSheets = miniStructSheetsToBuy + fullSheetsUsedForMini;
  const miniStripsAfter =
    availableMiniStrips +
    totalMiniStructSheets * BOX_SIZES.plywood_mini_strips_per_struct_sheet -
    (raw.plywood_strips_mini ?? 0);

  if (totalPlywoodSheets > 0) {
    const parts: string[] = [];
    if (raw.plywood_top_sheets > 0) parts.push(`${raw.plywood_top_sheets} Top`);
    if (structSheetsToBuy > 0) parts.push(`${structSheetsToBuy} Structural`);
    if (miniStructSheetsToBuy > 0) parts.push(`${miniStructSheetsToBuy} Mini Rail`);
    if (shelvingSheets > 0) parts.push(`${shelvingSheets} Shelving`);
    if (addonSheets > 0) parts.push(`${addonSheets} Addon`);

    let detail = parts.length > 1 ? parts.join(" + ") : "Total Sheets";

    const totalStripsNeeded = raw.plywood_strips + (raw.plywood_strips_mini ?? 0);
    if (totalStripsNeeded > 0 && structSheetsToBuy === 0 && miniStructSheetsToBuy === 0 && parts.length > 0) {
      detail += " (strips from offcuts)";
    }

    const totalFromStock = fullSheetsUsedForStruct + fullSheetsUsedForMini;
    if (totalFromStock > 0) {
      detail += ` (${totalFromStock} from stock)`;
    }

    const fullStructSheets = Math.ceil(
      Math.max(0, raw.plywood_strips - stripsFromTops) /
        BOX_SIZES.plywood_strips_per_struct_sheet
    );
    const saved = fullStructSheets - structSheetsToBuy;

    items.push({
      name: "Plywood Sheet",
      detail: saved > 0 && totalFromStock === 0 ? `${detail} (${saved} saved from strips)` : detail,
      qty: totalPlywoodSheets,
      covered: false,
    });
  } else if ((raw.plywood_strips > 0 || (raw.plywood_strips_mini ?? 0) > 0) && (fullSheetsUsedForStruct > 0 || fullSheetsUsedForMini > 0)) {
    coveredCount++;
    items.push({
      name: "Plywood Sheet",
      detail: "In stock — all sheets covered",
      qty: 0,
      covered: true,
    });
  }

  // ── Totes (per-job, no inventory tracking) ────────────────────────────
  if (raw.totes > 0) {
    items.push({
      name: "Totes",
      detail: "Per customer order",
      qty: raw.totes,
      covered: false,
    });
  }

  // ── Caster Kits (inventory-tracked) ──────────────────────────────────
  const casterKitsNeeded = raw.wheel_kits;
  let casterKitsFromStock = 0;
  let casterKitsToBuy = casterKitsNeeded;
  let casterKitsRemaining = inventory.caster_kits;

  if (casterKitsNeeded > 0) {
    casterKitsFromStock = Math.min(casterKitsRemaining, casterKitsNeeded);
    casterKitsRemaining -= casterKitsFromStock;
    casterKitsToBuy = casterKitsNeeded - casterKitsFromStock;

    if (casterKitsToBuy > 0) {
      items.push({
        name: "Caster Kit (4pk)",
        detail: `Mounted to base${casterKitsFromStock > 0 ? ` — ${casterKitsFromStock} from stock` : ""}`,
        qty: casterKitsToBuy,
        covered: false,
      });
    } else {
      coveredCount++;
      items.push({
        name: "Caster Kit (4pk)",
        detail: `In stock (${inventory.caster_kits} on hand, using ${casterKitsNeeded})`,
        qty: 0,
        covered: true,
      });
    }
  }

  // ── Screws (inventory-tracked) ────────────────────────────────────────
  const screwTypes: {
    key: keyof Pick<MaterialInventory, "screws_1_5_8" | "screws_3" | "screws_1">;
    name: string;
    detail: string;
    boxSize: number;
  }[] = [
    {
      key: "screws_1_5_8",
      name: '1⅝" #8 Screws',
      detail: "Rails (158ct box)",
      boxSize: BOX_SIZES.screws_1_5_8,
    },
    {
      key: "screws_3",
      name: '3" Screws',
      detail: "Frame (137ct box)",
      boxSize: BOX_SIZES.screws_3,
    },
    {
      key: "screws_1",
      name: '1" Screws',
      detail: "Wheels (90ct box)",
      boxSize: BOX_SIZES.screws_1,
    },
  ];

  const screwsAfter = { ...inventory };

  for (const st of screwTypes) {
    const needed = raw[st.key];
    if (needed <= 0) continue;

    const onHand = inventory[st.key];
    const deficit = Math.max(0, needed - onHand);
    const boxesToBuy = Math.ceil(deficit / st.boxSize);
    const remaining = onHand + boxesToBuy * st.boxSize - needed;
    screwsAfter[st.key] = remaining;

    if (boxesToBuy === 0) {
      coveredCount++;
      items.push({
        name: st.name,
        detail: `In stock (${onHand} on hand, using ${needed})`,
        qty: 0,
        covered: true,
      });
    } else {
      items.push({
        name: st.name,
        detail: `${st.detail}${onHand > 0 ? ` — ${onHand} on hand` : ""}`,
        qty: `${boxesToBuy} Box`,
        covered: false,
      });
    }
  }

  // Combine remaining offcuts from inventory with new offcuts from this job
  const combinedOffcuts = [...offcutsAfterLumber, ...newOffcuts]
    .filter((o) => o.length >= 6)
    .sort((a, b) => b.length - a.length);

  return {
    items,
    coveredCount,
    inventoryAfter: {
      screws_1_5_8: screwsAfter.screws_1_5_8,
      screws_3: screwsAfter.screws_3,
      screws_1: screwsAfter.screws_1,
      plywood_sheets_full: fullSheetsRemaining,
      plywood_strips: Math.max(0, stripsAfter),
      plywood_strips_mini: Math.max(0, miniStripsAfter),
      lumber_2x4_full: fullBoardsRemaining,
      lumber_offcuts: combinedOffcuts,
      rails_2x4_pieces: railPiecesRemaining + newRailPieces,
      caster_kits: casterKitsRemaining,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// calculateInventoryAfterJob
//
// Given raw job needs + current inventory, returns updated inventory
// assuming the installer purchased exactly what the net list prescribed.
// Called when a job is completed.
// ═══════════════════════════════════════════════════════════════════════════

export function calculateInventoryAfterJob(
  raw: RawJobNeeds,
  inventory: MaterialInventory
): MaterialInventory {
  const result = calculateNetPurchaseList(raw, inventory);
  return result.inventoryAfter;
}
