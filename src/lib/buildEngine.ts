// ═══════════════════════════════════════════════════════════════════════════
// BUILD ENGINE — Server-side-only logic engine
// Ported from the proprietary HTML calculator reference.
// This file should ONLY be imported by server actions / server components.
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────

export type UnitType = "standard" | "mini";
export type Orientation = "standard" | "sideways";
export type ToteColor = "black" | "clear";

export interface QuoteUnit {
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  toteColor?: ToteColor; // Optional for backward compatibility, defaults to "black"
  unitType: UnitType;
  orientation: Orientation;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price: number;
  totalW: number;
  totalH: number;
  depth: number;
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
  priorUsed?: number; // inches used by prior modules' cuts (offcut carry-forward)
  laterUsed?: number; // inches that later modules will claim from this board's offcut
  laterLabel?: string; // e.g., "→ Mod 2" showing which module uses the offcut
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
  heightTier?: number; // 1-based tier index when unit is vertically split (omitted for single-tier)
  heightTierTotal?: number; // total number of height tiers for this width module
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
const DEPOSIT_RATE = 0.15; // 15%

// ── Standard Unit Constants ─────────────────────────────────────────────
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const STANDARD_GAP = 1.5; // post width (2x4)
const STANDARD_TIER_HEIGHT = 16;
const STANDARD_DEPTH = 30;

// ── Sideways Orientation Constants (27-gal totes rotated 90°) ───────────
const SIDEWAYS_OPENING = 30.25; // Tote depth becomes slot width
const SIDEWAYS_DEPTH = 20; // Tote width becomes unit depth

// ── Mini Unit Constants ─────────────────────────────────────────────────
const MINI_OPENING = 8.25; // 8" wide tote + clearance
const MINI_GAP = 1.5; // same post width
const MINI_TIER_HEIGHT = 7; // shorter vertical spacing
const MINI_DEPTH = 12.75;
const MINI_FIRST_RAIL_HEIGHT = 5.25;

// ── Pricing Constants ───────────────────────────────────────────────────
const STANDARD_PRICE_PER_SLOT = 30;
const MINI_PRICE_PER_SLOT = 15;
const STANDARD_TOTE_PRICE = 12;
const STANDARD_TOTE_CLEAR_PRICE = 20;  // HDX Clear/Yellow totes (+$8)
const MINI_TOTE_PRICE = 4;
const STANDARD_WHEELS_PRICE = 65;
const MINI_WHEELS_PRICE = 40;
const PLYWOOD_TOP_PRICE = 95;

// ── Helper to get opening based on unit type and orientation ────────────
function getOpening(toteType: "HDX" | "GM", unitType: UnitType, orientation: Orientation): number {
  if (unitType === "mini") return MINI_OPENING;
  if (orientation === "sideways") return SIDEWAYS_OPENING;
  return toteType === "HDX" ? OPENING_HDX : OPENING_GM;
}

function getGap(unitType: UnitType): number {
  return unitType === "mini" ? MINI_GAP : STANDARD_GAP;
}

function getTierHeight(unitType: UnitType): number {
  return unitType === "mini" ? MINI_TIER_HEIGHT : STANDARD_TIER_HEIGHT;
}

function getDepth(unitType: UnitType, orientation: Orientation): number {
  if (unitType === "mini") return MINI_DEPTH;
  if (orientation === "sideways") return SIDEWAYS_DEPTH;
  return STANDARD_DEPTH;
}

// ── Height tier splitting ───────────────────────────────────────────────
// Determines max rows per vertical tier so uprights fit in STOCK_LENGTH.
function getMaxRowsPerTier(unitType: UnitType): number {
  if (unitType === "mini") {
    // Mini: uprightH = MINI_FIRST_RAIL_HEIGHT + (rows-1)*MINI_TIER_HEIGHT + 2
    // Solve: 5.25 + (rows-1)*7 + 2 <= 96  =>  rows <= 13.67  =>  13
    // But mini is capped at 4 rows already, so this never triggers.
    return 13;
  }
  // Standard: uprightH = rows * STANDARD_TIER_HEIGHT
  // Solve: rows * 16 <= 96  =>  rows <= 6
  return Math.floor(STOCK_LENGTH / STANDARD_TIER_HEIGHT);
}

// Splits total rows into height tiers that fit within 8ft stock.
function splitHeightTiers(totalRows: number, unitType: UnitType): number[] {
  const maxRows = getMaxRowsPerTier(unitType);
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

// Calculate upright height for a given number of rows
function calcUprightHeight(rows: number, unitType: UnitType): number {
  if (unitType === "mini") {
    return MINI_FIRST_RAIL_HEIGHT + (rows - 1) * MINI_TIER_HEIGHT + 2;
  }
  return rows * getTierHeight(unitType);
}

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

  // modKey encodes: unitIdx, widthModIndex, heightTierIndex
  // This allows the bin packer to attribute boards correctly.
  const allParts: (CutPart & { unitIdx: number; modKey: string })[] = [];
  const moduleMetadata: {
    unitIdx: number;
    modKey: string;
    widthModIndex: number;
    heightTierIndex: number;
    heightTierTotal: number;
    cols: number;
    rows: number;
    stripCount: number;
    railStrips: number;
    backSupports: number;
    moduleWidth: number;
    unitType: UnitType;
    orientation: Orientation;
  }[] = [];

  quoteData.forEach((unit, unitIdx) => {
    const {
      cols: totalCols,
      rows: totalRows,
      toteType,
      toteColor = "black",
      unitType = "standard",
      orientation = "standard",
      hasTotes,
      hasWheels,
      hasTop
    } = unit;

    if (totalCols < 1 || totalRows < 1) return;

    // Get config based on unit type and orientation
    const opening = getOpening(toteType, unitType, orientation);
    const gap = getGap(unitType);
    const pricePerSlot = unitType === "mini" ? MINI_PRICE_PER_SLOT : STANDARD_PRICE_PER_SLOT;
    const totePrice = unitType === "mini"
      ? MINI_TOTE_PRICE
      : (toteType === "HDX" && toteColor === "clear" ? STANDARD_TOTE_CLEAR_PRICE : STANDARD_TOTE_PRICE);
    const wheelsPrice = unitType === "mini" ? MINI_WHEELS_PRICE : STANDARD_WHEELS_PRICE;

    // ── Auto-Split Logic: WIDTH (max 4 cols per module) ─────────────
    const widthModules: number[] = [];
    let remainingCols = totalCols;
    while (remainingCols > 4) {
      widthModules.push(4);
      remainingCols -= 4;
    }
    if (remainingCols > 0) widthModules.push(remainingCols);

    // ── Auto-Split Logic: HEIGHT (max rows per tier to fit 8ft stock) ─
    const heightTiers = splitHeightTiers(totalRows, unitType);

    // ── Unit-level add-ons ───────────────────────────────────────────
    if (hasWheels) {
      gWheels++;
      gScrew1 += 16;
      gRetail += wheelsPrice;
    }

    let unitTotalWidth = 0;

    widthModules.forEach((cols, widthModIndex) => {
      const modWidth = cols * opening + (cols + 1) * gap;
      unitTotalWidth += modWidth;

      // Process each height tier for this width module
      heightTiers.forEach((tierRows, heightTierIndex) => {
        const modKey = `${unitIdx}-${widthModIndex}-${heightTierIndex}`;
        const slots = cols * tierRows;
        const uprightHeight = calcUprightHeight(tierRows, unitType);

        // Collect upright parts for global bin packing
        // Every module is a self-contained frame with its own posts on both ends.
        // Where modules join, the abutting posts double up for structural strength.
        const postCount = (cols + 1) * 2;
        const tierSuffix = heightTiers.length > 1 ? ` T${heightTierIndex + 1}` : "";
        for (let i = 0; i < postCount; i++) {
          allParts.push({
            len: uprightHeight,
            name: `Post${tierSuffix}`,
            type: "upright",
            unitIdx,
            modKey,
          });
        }

        // Top & bottom plates for each tier
        // Each height tier is a self-contained structural frame
        const numRailSets = unitType === "mini" ? 2 : 4;
        for (let k = 0; k < numRailSets; k++) {
          allParts.push({
            len: modWidth,
            name: `Plate${tierSuffix}`,
            type: "rail",
            unitIdx,
            modKey,
          });
        }

        // ── Plywood Strips ────────────────────────────────────────────
        const numRails = slots * 2;
        const backSupports = cols <= 4 ? 4 : 6;
        const modStrips = numRails + backSupports;
        globalStripCount += modStrips;

        // ── Screws ────────────────────────────────────────────────────
        gScrew16 += numRails * 4;
        gScrew3 += (cols + 1) * 20;

        // ── Retail (only count once for the full row set across height tiers) ──
        // We'll add retail at tier level to properly track total slots
        let modRetail = slots * pricePerSlot;
        if (hasTotes) modRetail += slots * totePrice;
        gRetail += modRetail;

        if (hasTotes) gTotes += slots;

        moduleMetadata.push({
          unitIdx,
          modKey,
          widthModIndex,
          heightTierIndex,
          heightTierTotal: heightTiers.length,
          cols,
          rows: tierRows,
          stripCount: modStrips,
          railStrips: numRails,
          backSupports,
          moduleWidth: modWidth,
          unitType,
          orientation,
        });
      });
    });

    // ── Top Sheets (per unit width) ─────────────────────────────────
    const effectiveHasTop = unitType === "mini" || hasTop;
    if (effectiveHasTop) {
      let sheetsForUnit = 0;
      if (unitTotalWidth > 192) sheetsForUnit = 3;
      else if (unitTotalWidth > 96) sheetsForUnit = 2;
      else sheetsForUnit = 1;

      globalTopSheets += sheetsForUnit;
      gRetail += sheetsForUnit * PLYWOOD_TOP_PRICE;
    }
  });

  // ── PHASE 2: Global Bin Packing — sort ALL parts longest-first ────────
  allParts.sort((a, b) => b.len - a.len);
  const globalBoards: Board[] = [];

  for (const p of allParts) {
    let placed = false;
    for (const b of globalBoards) {
      if (b.rem >= p.len + KERF) {
        b.cuts.push(p);
        b.rem -= p.len + KERF;
        placed = true;
        break;
      }
    }
    if (!placed) {
      globalBoards.push({ cuts: [p], rem: STOCK_LENGTH - p.len });
    }
  }

  gBoards = globalBoards.length;

  // ── PHASE 3: Build per-module cut plans with offcut carry-forward ─────
  // Process modules in BUILD ORDER (bottom tiers first L→R) so offcuts
  // from earlier modules are available to later ones — just like the real
  // build sequence.  Each module tries to place cuts on carry-forward
  // boards before opening fresh stock.

  interface VisualCut extends CutPart { modKey: string }

  // Sort modules by build order: unit → bottom tier first → left first
  const buildOrderMeta = [...moduleMetadata].sort((a, b) => {
    if (a.unitIdx !== b.unitIdx) return a.unitIdx - b.unitIdx;
    if (a.heightTierIndex !== b.heightTierIndex) return a.heightTierIndex - b.heightTierIndex;
    return a.widthModIndex - b.widthModIndex;
  });

  // Single FFD pass, processing one module at a time in build order
  const visualBoards: { cuts: VisualCut[]; rem: number }[] = [];

  for (const meta of buildOrderMeta) {
    const moduleParts: VisualCut[] = allParts
      .filter((p) => p.unitIdx === meta.unitIdx && p.modKey === meta.modKey)
      .map((p) => ({ len: p.len, name: p.name, type: p.type, modKey: meta.modKey }));

    moduleParts.sort((a, b) => b.len - a.len);

    for (const p of moduleParts) {
      let placed = false;
      for (const b of visualBoards) {
        if (b.rem >= p.len + KERF) {
          b.cuts.push(p);
          b.rem -= p.len + KERF;
          placed = true;
          break;
        }
      }
      if (!placed) {
        visualBoards.push({ cuts: [p], rem: STOCK_LENGTH - p.len });
      }
    }
  }

  // Build-order index map so we can distinguish prior vs later modules
  const buildOrderMap = new Map<string, number>();
  buildOrderMeta.forEach((meta, idx) => {
    buildOrderMap.set(meta.modKey, idx);
  });

  // Helper: human-readable module label
  function modLabel(mk: string): string {
    const m = moduleMetadata.find((mm) => mm.modKey === mk);
    if (!m) return "?";
    return `Mod ${m.widthModIndex + 1}`;
  }

  // Extract per-module boards (in engine order for cutPlans array)
  for (const meta of moduleMetadata) {
    const modKey = meta.modKey;
    const myOrder = buildOrderMap.get(modKey)!;
    const moduleBoards: Board[] = [];

    for (const vb of visualBoards) {
      const myCuts = vb.cuts.filter((c) => c.modKey === modKey);
      if (myCuts.length === 0) continue;

      // Space used by modules built BEFORE this one
      const priorLen = vb.cuts
        .filter((c) => c.modKey !== modKey && (buildOrderMap.get(c.modKey) ?? 0) < myOrder)
        .reduce((sum, c) => sum + c.len + KERF, 0);

      // Space used by modules built AFTER this one (offcut destination)
      const laterCuts = vb.cuts.filter(
        (c) => c.modKey !== modKey && (buildOrderMap.get(c.modKey) ?? 0) > myOrder,
      );
      const laterLen = laterCuts.reduce((sum, c) => sum + c.len + KERF, 0);

      let laterLbl: string | undefined;
      if (laterCuts.length > 0) {
        const names = Array.from(new Set(laterCuts.map((c) => modLabel(c.modKey))));
        laterLbl = `→ ${names.join(", ")}`;
      }

      moduleBoards.push({
        cuts: myCuts.map((c) => ({ len: c.len, name: c.name, type: c.type })),
        rem: vb.rem,
        ...(priorLen > 0 ? { priorUsed: priorLen } : {}),
        ...(laterLen > 0 ? { laterUsed: laterLen, laterLabel: laterLbl } : {}),
      });
    }

    cutPlans.push({
      unitIndex: meta.unitIdx + 1,
      moduleIndex: meta.widthModIndex + 1,
      cols: meta.cols,
      rows: meta.rows,
      boards: moduleBoards,
      stripCount: meta.stripCount,
      railStrips: meta.railStrips,
      backSupports: meta.backSupports,
      moduleWidth: meta.moduleWidth,
      ...(meta.heightTierTotal > 1
        ? { heightTier: meta.heightTierIndex + 1, heightTierTotal: meta.heightTierTotal }
        : {}),
    });
  }

  // ── Final Plywood Calculation ──────────────────────────────────────────
  const stripCredit = globalTopSheets * 27;
  let netStrips = globalStripCount - stripCredit;
  if (netStrips < 0) netStrips = 0;

  const structSheets = Math.ceil(netStrips / 72);
  const gSheets = structSheets + globalTopSheets;

  // ── Screw Box Math ────────────────────────────────────────────────────
  const boxes16 = Math.ceil(gScrew16 / 158);
  const boxes3 = Math.ceil(gScrew3 / 137);
  const boxes1 = Math.ceil(gScrew1 / 90);

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
    name: '1 5/8" #8 Screws',
    detail: "Rails (158ct box)",
    qty: `${boxes16} Box`,
  });
  shopping_list.push({
    name: '3" Screws',
    detail: "Frame (137ct box)",
    qty: `${boxes3} Box`,
  });
  if (boxes1 > 0) {
    shopping_list.push({
      name: '1" Screws',
      detail: "Wheels (90ct box)",
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
