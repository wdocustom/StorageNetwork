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
  screws_1_5_8: 145,
  screws_3: 70,
  screws_1: 90,
  plywood_strips_per_struct_sheet: 72,
  plywood_strips_per_top_offcut: 27,
} as const;

// ── Inventory Shape ──────────────────────────────────────────────────────

export interface MaterialInventory {
  screws_1_5_8: number; // individual count
  screws_3: number; // individual count
  screws_1: number; // individual count
  plywood_strips: number; // rail strips from offcuts
}

export const EMPTY_INVENTORY: MaterialInventory = {
  screws_1_5_8: 0,
  screws_3: 0,
  screws_1: 0,
  plywood_strips: 0,
};

/** Ensure we always have a valid inventory object. */
export function normalizeInventory(raw: unknown): MaterialInventory {
  if (!raw || typeof raw !== "object") return { ...EMPTY_INVENTORY };
  const inv = raw as Record<string, unknown>;
  return {
    screws_1_5_8: Math.max(0, Number(inv.screws_1_5_8) || 0),
    screws_3: Math.max(0, Number(inv.screws_3) || 0),
    screws_1: Math.max(0, Number(inv.screws_1) || 0),
    plywood_strips: Math.max(0, Number(inv.plywood_strips) || 0),
  };
}

// ── Raw Job Needs ────────────────────────────────────────────────────────
// These come from calculateMaterialCost().rawCounts

export interface RawJobNeeds {
  screws_1_5_8: number;
  screws_3: number;
  screws_1: number;
  plywood_strips: number;
  plywood_top_sheets: number;
  lumber_boards: number;
  totes: number;
  wheel_kits: number;
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

  // ── Lumber (always purchased per job — no cross-job tracking) ─────────
  if (raw.lumber_boards > 0) {
    items.push({
      name: "2×4 Lumber (8ft)",
      detail: "Cut to length per plan",
      qty: raw.lumber_boards,
      covered: false,
    });
  }

  // ── Plywood ──────────────────────────────────────────────────────────
  // Top sheets are always purchased fresh (cut to unit width)
  // Strips: use inventory offcuts + this job's top offcuts first
  const stripsFromTops = raw.plywood_top_sheets * BOX_SIZES.plywood_strips_per_top_offcut;
  const availableStrips = inventory.plywood_strips + stripsFromTops;
  const netStripNeed = Math.max(0, raw.plywood_strips - availableStrips);
  const structSheetsToBuy = Math.ceil(netStripNeed / BOX_SIZES.plywood_strips_per_struct_sheet);
  const totalPlywoodSheets = raw.plywood_top_sheets + structSheetsToBuy;

  // Remaining strips after this job
  const stripsAfter =
    availableStrips +
    structSheetsToBuy * BOX_SIZES.plywood_strips_per_struct_sheet -
    raw.plywood_strips;

  if (totalPlywoodSheets > 0) {
    let detail = "Total Sheets";
    if (raw.plywood_top_sheets > 0 && structSheetsToBuy > 0) {
      detail = `${raw.plywood_top_sheets} Top + ${structSheetsToBuy} Structural`;
    } else if (raw.plywood_top_sheets > 0) {
      detail = `${raw.plywood_top_sheets} Top (strips from offcuts)`;
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
  const screwTypes: {
    key: keyof Pick<MaterialInventory, "screws_1_5_8" | "screws_3" | "screws_1">;
    name: string;
    detail: string;
    boxSize: number;
  }[] = [
    {
      key: "screws_1_5_8",
      name: '1⅝" #8 Screws',
      detail: "Rails (145ct box)",
      boxSize: BOX_SIZES.screws_1_5_8,
    },
    {
      key: "screws_3",
      name: '3" Screws',
      detail: "Frame (70ct box)",
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

  return {
    items,
    coveredCount,
    inventoryAfter: {
      screws_1_5_8: screwsAfter.screws_1_5_8,
      screws_3: screwsAfter.screws_3,
      screws_1: screwsAfter.screws_1,
      plywood_strips: Math.max(0, stripsAfter),
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
