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
  plywood_strips_per_struct_sheet: 72,
  plywood_strips_per_top_offcut: 27,
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
  screws_1_5_8: number; // individual count
  screws_3: number; // individual count
  screws_1: number; // individual count
  plywood_strips: number; // rail strips from offcuts
  lumber_offcuts: LumberOffcut[]; // 2x4 offcuts from previous builds
}

export const EMPTY_INVENTORY: MaterialInventory = {
  screws_1_5_8: 0,
  screws_3: 0,
  screws_1: 0,
  plywood_strips: 0,
  lumber_offcuts: [],
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
    plywood_strips: Math.max(0, Number(inv.plywood_strips) || 0),
    lumber_offcuts: offcuts,
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
  plywood_top_sheets: number;
  plywood_shelving_sheets: number;
  plywood_addon_sheets: number;
  lumber_boards: number;
  totes: number;
  wheel_kits: number;
  /** Individual 2x4 part lengths (inches) for offcut-aware bin packing. */
  lumber_part_lengths?: number[];
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

  // ── Lumber ─────────────────────────────────────────────────────────────
  // If we have offcuts in inventory AND the job provides part lengths,
  // fill from offcuts first and only buy fresh stock for the rest.
  const partLengths = raw.lumber_part_lengths ?? [];
  let boardsToBuy = raw.lumber_boards;
  let offcutsUsed = 0;
  let offcutsAfterLumber = inventory.lumber_offcuts;
  let newOffcuts: LumberOffcut[] = [];

  if (partLengths.length > 0 && inventory.lumber_offcuts.length > 0) {
    const result = fillPartsFromOffcuts(partLengths, inventory.lumber_offcuts);
    offcutsUsed = result.placedCount;
    offcutsAfterLumber = result.offcutsAfter;

    // Bin-pack remaining parts into fresh 2x4s
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
      boardsToBuy = bins.length;
      // Collect new offcuts from fresh boards
      newOffcuts = bins.filter((rem) => rem >= 6).map((rem) => ({ length: rem }));
    } else {
      boardsToBuy = 0;
      newOffcuts = [];
    }
  } else if (partLengths.length > 0) {
    // No offcuts in inventory — calculate new offcuts from all parts
    newOffcuts = calculateNewOffcuts(partLengths);
  }

  if (boardsToBuy > 0) {
    const detail = offcutsUsed > 0
      ? `Cut to length per plan — ${offcutsUsed} part${offcutsUsed > 1 ? "s" : ""} from offcuts`
      : "Cut to length per plan";
    items.push({
      name: "2×4 Lumber (8ft)",
      detail,
      qty: boardsToBuy,
      covered: false,
    });
  } else if (raw.lumber_boards > 0 && offcutsUsed > 0) {
    // All parts covered by offcuts
    coveredCount++;
    items.push({
      name: "2×4 Lumber (8ft)",
      detail: `In stock — all ${offcutsUsed} parts from offcuts`,
      qty: 0,
      covered: true,
    });
  }

  // ── Plywood ──────────────────────────────────────────────────────────
  // Top sheets are always purchased fresh (cut to unit width)
  // Shelving sheets are always purchased fresh (cut to shelf dimensions)
  // Strips: use inventory offcuts + this job's top offcuts first
  const stripsFromTops = raw.plywood_top_sheets * BOX_SIZES.plywood_strips_per_top_offcut;
  const availableStrips = inventory.plywood_strips + stripsFromTops;
  const netStripNeed = Math.max(0, raw.plywood_strips - availableStrips);
  const structSheetsToBuy = Math.ceil(netStripNeed / BOX_SIZES.plywood_strips_per_struct_sheet);
  const shelvingSheets = raw.plywood_shelving_sheets || 0;
  const addonSheets = raw.plywood_addon_sheets || 0;
  const totalPlywoodSheets = raw.plywood_top_sheets + structSheetsToBuy + shelvingSheets + addonSheets;

  // Remaining strips after this job
  const stripsAfter =
    availableStrips +
    structSheetsToBuy * BOX_SIZES.plywood_strips_per_struct_sheet -
    raw.plywood_strips;

  if (totalPlywoodSheets > 0) {
    const parts: string[] = [];
    if (raw.plywood_top_sheets > 0) parts.push(`${raw.plywood_top_sheets} Top`);
    if (structSheetsToBuy > 0) parts.push(`${structSheetsToBuy} Structural`);
    if (shelvingSheets > 0) parts.push(`${shelvingSheets} Shelving`);
    if (addonSheets > 0) parts.push(`${addonSheets} Addon`);

    let detail = parts.length > 1 ? parts.join(" + ") : "Total Sheets";

    // If no structural sheets needed but we have strips, note savings
    if (raw.plywood_strips > 0 && structSheetsToBuy === 0 && parts.length > 0) {
      detail += " (strips from offcuts)";
    }

    // Plywood is partially covered if we saved on structural sheets
    const fullStructSheets = Math.ceil(
      Math.max(0, raw.plywood_strips - stripsFromTops) /
        BOX_SIZES.plywood_strips_per_struct_sheet
    );
    const saved = fullStructSheets - structSheetsToBuy;

    items.push({
      name: "Plywood Sheet",
      detail: saved > 0 ? `${detail} (${saved} saved from stock)` : detail,
      qty: totalPlywoodSheets,
      covered: false,
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

  // ── Wheels (per-job, no inventory tracking) ───────────────────────────
  if (raw.wheel_kits > 0) {
    items.push({
      name: "Caster Kit (4pk)",
      detail: "Mounted to base",
      qty: raw.wheel_kits,
      covered: false,
    });
  }

  // ── Screws (inventory-tracked) ────────────────────────────────────────
  // NOTE: raw screw counts already include a 5% human error factor
  // (applied in calculate-materials.ts) for dropped/miscounted/damaged screws.
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
      // Fully covered by inventory — omit from purchase list
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
      plywood_strips: Math.max(0, stripsAfter),
      lumber_offcuts: combinedOffcuts,
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
