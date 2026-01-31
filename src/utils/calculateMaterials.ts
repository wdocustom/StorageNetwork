// ═══════════════════════════════════════════════════════════════════════════
// Material Cost Calculator — Client-safe estimation
// Takes a job config (from the 3D configurator) and returns estimated
// material cost using V1 hardcoded unit prices.
//
// This runs on the CLIENT so installers see the breakdown immediately.
// It does NOT replace the server-side build engine — it's a cost overlay.
// ═══════════════════════════════════════════════════════════════════════════

// ── V1 Unit Costs ──────────────────────────────────────────────────────────

const PRICES = {
  lumber_2x4_8ft: 3.75,
  plywood_sheet: 35.0,
  tote: 8.99,
  screw_1in_95ct: 10.99,
  screw_1_5_8in_725ct: 29.97,
  screw_3in_350ct: 29.97,
  wheels_4pk: 30.0,
} as const;

// ── Constants (match buildEngine.ts) ───────────────────────────────────────

const STOCK_LENGTH = 96; // 8ft board
const KERF = 0.125;
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const GAP = 1.5; // post width (2x4)
const TIER_HEIGHT = 16;

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
}

// ── Calculator ─────────────────────────────────────────────────────────────

export function calculateMaterialCost(
  configs: MaterialConfig | MaterialConfig[]
): MaterialBreakdown {
  const units = Array.isArray(configs) ? configs : [configs];

  let totalBoards = 0;
  let totalSheets = 0;
  let totalTotes = 0;
  let totalWheelKits = 0;
  let totalScrewBoxes1 = 0;
  let totalScrewBoxes16 = 0;
  let totalScrewBoxes3 = 0;

  let globalStripCount = 0;
  let globalTopSheets = 0;

  for (const unit of units) {
    const { cols: totalCols, rows, toteType = "HDX", hasTotes = false, hasWheels = false, hasTop = false } = unit;
    if (totalCols < 1 || rows < 1) continue;

    // Auto-split logic (max 4 cols per module) — matches buildEngine
    const modules: number[] = [];
    let remaining = totalCols;
    while (remaining > 4) {
      modules.push(4);
      remaining -= 4;
    }
    if (remaining > 0) modules.push(remaining);

    // Wheels — per unit
    let screw1Count = 0;
    if (hasWheels) {
      totalWheelKits++;
      screw1Count += 16;
    }

    let unitTotalWidth = 0;
    let screw16Count = 0;
    let screw3Count = 0;

    for (const cols of modules) {
      const opening = toteType === "HDX" ? OPENING_HDX : OPENING_GM;
      const modWidth = cols * opening + (cols + 1) * GAP;
      const slots = cols * rows;
      unitTotalWidth += modWidth;

      // Lumber parts for bin-packing
      const parts: number[] = [];
      for (let i = 0; i < (cols + 1) * 2; i++) {
        parts.push(rows * TIER_HEIGHT);
      }
      for (let k = 0; k < 4; k++) {
        parts.push(modWidth);
      }

      // First Fit Decreasing bin-packing
      parts.sort((a, b) => b - a);
      const bins: number[] = [];
      for (const len of parts) {
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
      totalBoards += bins.length;

      // Plywood strips
      const numRails = slots * 2;
      const backSupports = cols <= 4 ? 4 : 6;
      globalStripCount += numRails + backSupports;

      // Screws
      screw16Count += numRails * 4;
      screw3Count += (cols + 1) * 20;

      // Totes
      if (hasTotes) totalTotes += slots;
    }

    // Top sheets
    if (hasTop) {
      let sheetsForUnit = 0;
      if (unitTotalWidth > 192) sheetsForUnit = 3;
      else if (unitTotalWidth > 96) sheetsForUnit = 2;
      else sheetsForUnit = 1;
      globalTopSheets += sheetsForUnit;
    }

    totalScrewBoxes16 += Math.ceil(screw16Count / 725);
    totalScrewBoxes3 += Math.ceil(screw3Count / 350);
    totalScrewBoxes1 += Math.ceil(screw1Count / 95);
  }

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

  addItem("2×4 Lumber (8ft)", totalBoards, PRICES.lumber_2x4_8ft);
  addItem("Plywood Sheet", totalSheets, PRICES.plywood_sheet);
  addItem("Totes", totalTotes, PRICES.tote);
  addItem("Wheels (4pk)", totalWheelKits, PRICES.wheels_4pk);
  addItem('1⅝" Screws (725ct)', totalScrewBoxes16, PRICES.screw_1_5_8in_725ct);
  addItem('3" Screws (350ct)', totalScrewBoxes3, PRICES.screw_3in_350ct);
  addItem('1" Screws (95ct)', totalScrewBoxes1, PRICES.screw_1in_95ct);

  const totalCost = items.reduce((sum, i) => sum + i.subtotal, 0);

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    items,
  };
}
