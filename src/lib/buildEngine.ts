// ═══════════════════════════════════════════════════════════════════════════
// BUILD ENGINE — Server-side-only logic engine
// Ported from the proprietary HTML calculator reference.
// This file should ONLY be imported by server actions / server components.
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────

export interface QuoteUnit {
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price: number;
  totalW: number;
  totalH: number;
  desc: string;
}

export interface CutPart {
  len: number;
  name: string;
  type: "upright" | "rail";
}

export interface Board {
  cuts: CutPart[];
  rem: number;
}

export interface CutPlanModule {
  unitIndex: number;
  moduleIndex: number;
  cols: number;
  rows: number;
  boards: Board[];
  stripCount: number;
  railStrips: number;
  backSupports: number;
  moduleWidth: number;
}

export interface ShoppingItem {
  name: string;
  detail: string;
  qty: number | string;
}

export interface Financials {
  retailTotal: number;
  depositRate: number;
  depositAmount: number;
  balanceDue: number;
}

export interface BuildManifest {
  shopping_list: ShoppingItem[];
  cut_plan_visuals: CutPlanModule[];
  financials: Financials;
  totals: {
    boards: number;
    sheets: number;
    totes: number;
    wheelKits: number;
    screwBoxes_1_5_8: number;
    screwBoxes_3: number;
    screwBoxes_1: number;
  };
}

// ── Constants (PROPRIETARY — never exposed to client) ────────────────────

const STOCK_LENGTH = 96; // 8ft board in inches
const KERF = 0.125; // blade width
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const GAP = 1.5; // post width (2x4)
const TIER_HEIGHT = 16;
const DEPOSIT_RATE = 0.15; // 15%

// ── Main Export ──────────────────────────────────────────────────────────

export function generateBuildManifest(quoteData: QuoteUnit[]): BuildManifest {
  let gBoards = 0;
  let gScrew16 = 0;
  let gScrew3 = 0;
  let gScrew1 = 0;
  let gTotes = 0;
  let gWheels = 0;
  let gRetail = 0;

  let globalStripCount = 0;
  let globalTopSheets = 0;

  const cutPlans: CutPlanModule[] = [];

  quoteData.forEach((unit, unitIdx) => {
    const { cols: totalCols, rows, toteType, hasTotes, hasWheels, hasTop } = unit;

    if (totalCols < 1 || rows < 1) return;

    // ── Auto-Split Logic (max 4 cols per module) ─────────────────────
    const modules: number[] = [];
    let remaining = totalCols;
    while (remaining > 4) {
      modules.push(4);
      remaining -= 4;
    }
    if (remaining > 0) modules.push(remaining);

    // ── Unit-level add-ons ───────────────────────────────────────────
    if (hasWheels) {
      gWheels++;
      gScrew1 += 16;
      gRetail += 45;
    }

    let unitTotalWidth = 0;

    modules.forEach((cols, modIndex) => {
      const opening = toteType === "HDX" ? OPENING_HDX : OPENING_GM;
      const modWidth = cols * opening + (cols + 1) * GAP;
      const slots = cols * rows;
      unitTotalWidth += modWidth;

      // ── Lumber Parts ──────────────────────────────────────────────
      const parts: CutPart[] = [];

      // Uprights: (cols+1) posts × 2 sides
      for (let i = 0; i < (cols + 1) * 2; i++) {
        parts.push({
          len: rows * TIER_HEIGHT,
          name: "Upright",
          type: "upright",
        });
      }

      // Rails: 4 rails per module (top plate, bottom plate, 2 horizontals)
      for (let k = 0; k < 4; k++) {
        parts.push({ len: modWidth, name: "Rail", type: "rail" });
      }

      // ── Bin Packing (First Fit Decreasing onto 8ft boards) ────────
      parts.sort((a, b) => b.len - a.len);
      const boards: Board[] = [];

      parts.forEach((p) => {
        let placed = false;
        for (const b of boards) {
          if (b.rem >= p.len + KERF) {
            b.cuts.push(p);
            b.rem -= p.len + KERF;
            placed = true;
            break;
          }
        }
        if (!placed) {
          boards.push({ cuts: [p], rem: STOCK_LENGTH - p.len });
        }
      });

      gBoards += boards.length;

      // ── Plywood Strips ────────────────────────────────────────────
      const numRails = slots * 2;
      const backSupports = cols <= 4 ? 4 : 6;
      const modStrips = numRails + backSupports;
      globalStripCount += modStrips;

      // ── Screws ────────────────────────────────────────────────────
      gScrew16 += numRails * 4;
      gScrew3 += (cols + 1) * 20;

      // ── Retail ────────────────────────────────────────────────────
      let modRetail = slots * 40;
      if (hasTotes) modRetail += slots * 12;
      gRetail += modRetail;

      if (hasTotes) gTotes += slots;

      cutPlans.push({
        unitIndex: unitIdx + 1,
        moduleIndex: modIndex + 1,
        cols,
        rows,
        boards,
        stripCount: modStrips,
        railStrips: numRails,
        backSupports,
        moduleWidth: modWidth,
      });
    });

    // ── Top Sheets (per unit width) ─────────────────────────────────
    if (hasTop) {
      let sheetsForUnit = 0;
      if (unitTotalWidth > 192) sheetsForUnit = 3;
      else if (unitTotalWidth > 96) sheetsForUnit = 2;
      else sheetsForUnit = 1;

      globalTopSheets += sheetsForUnit;
      gRetail += sheetsForUnit * 75;
    }
  });

  // ── Final Plywood Calculation ──────────────────────────────────────────
  // Top sheets generate offcut strips (27 usable strips per top sheet)
  const stripCredit = globalTopSheets * 27;
  let netStrips = globalStripCount - stripCredit;
  if (netStrips < 0) netStrips = 0;

  const structSheets = Math.ceil(netStrips / 72);
  const gSheets = structSheets + globalTopSheets;

  // ── Screw Box Math ────────────────────────────────────────────────────
  const boxes16 = Math.ceil(gScrew16 / 725);
  const boxes3 = Math.ceil(gScrew3 / 350);
  const boxes1 = Math.ceil(gScrew1 / 95);

  // ── Shopping List ─────────────────────────────────────────────────────
  const shopping_list: ShoppingItem[] = [
    { name: "2x4 Lumber", detail: "8 ft Standard", qty: gBoards },
  ];

  let plyDetail = "Total Sheets";
  if (globalTopSheets > 0) {
    plyDetail = `${globalTopSheets} Top + ${structSheets} Struct (Offcuts Used)`;
  }
  shopping_list.push({ name: "Plywood", detail: plyDetail, qty: gSheets });

  if (gTotes > 0) {
    shopping_list.push({ name: "Totes", detail: "Total Units", qty: gTotes });
  }
  if (gWheels > 0) {
    shopping_list.push({
      name: "Caster Kits",
      detail: "4pk Sets",
      qty: gWheels,
    });
  }

  shopping_list.push({
    name: '1 5/8" Screws',
    detail: "Rails (725ct box)",
    qty: `${boxes16} Box`,
  });
  shopping_list.push({
    name: '3" Screws',
    detail: "Frame (350ct box)",
    qty: `${boxes3} Box`,
  });
  if (boxes1 > 0) {
    shopping_list.push({
      name: '1" Struct Screws',
      detail: "Wheels (95ct box)",
      qty: `${boxes1} Box`,
    });
  }

  // ── Financials ────────────────────────────────────────────────────────
  const depositAmount = Math.round(gRetail * DEPOSIT_RATE * 100) / 100;
  const balanceDue = Math.round((gRetail - depositAmount) * 100) / 100;

  return {
    shopping_list,
    cut_plan_visuals: cutPlans,
    financials: {
      retailTotal: gRetail,
      depositRate: DEPOSIT_RATE,
      depositAmount,
      balanceDue,
    },
    totals: {
      boards: gBoards,
      sheets: gSheets,
      totes: gTotes,
      wheelKits: gWheels,
      screwBoxes_1_5_8: boxes16,
      screwBoxes_3: boxes3,
      screwBoxes_1: boxes1,
    },
  };
}
