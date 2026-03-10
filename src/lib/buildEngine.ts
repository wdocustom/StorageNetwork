// ═══════════════════════════════════════════════════════════════════════════
// BUILD ENGINE — Server-side-only logic engine
// Ported from the proprietary HTML calculator reference.
// This file should ONLY be imported by server actions / server components.
// ═══════════════════════════════════════════════════════════════════════════

import "server-only";

// ── Types (re-exported from shared types file) ──────────────────────────
// Types are in buildEngine.types.ts so client components can import them
// without pulling in server-only logic.

export type {
  UnitType,
  Orientation,
  ToteColor,
  QuoteUnit,
  CutPart,
  Board,
  CutPlanModule,
  ShelvingCutPlanModule,
  ShoppingItem,
  Financials,
  BuildManifest,
} from "@/lib/buildEngine.types";

import type { SectionAddon } from "@/types/viewModels";
import type {
  UnitType,
  Orientation,
  ToteColor,
  QuoteUnit,
  CutPart,
  Board,
  CutPlanModule,
  ShelvingCutPlanModule,
  ShoppingItem,
  Financials,
  BuildManifest,
} from "@/lib/buildEngine.types";

import { getShelvingConfig } from "@/lib/shelving";

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

/**
 * Generate a build manifest with shopping list, cut plans, and financials.
 * @param quoteData - Array of configured units
 * @param customDepositRate - Optional custom deposit rate (e.g. 0.25 for 25%). Defaults to 15%.
 */
export function generateBuildManifest(quoteData: QuoteUnit[], customDepositRate?: number): BuildManifest {
  let gBoards = 0;
  let gScrew16 = 0;
  let gScrew3 = 0;
  let gScrew1 = 0;
  let gTotes = 0;
  let gWheels = 0;
  let gRetail = 0;

  let globalStripCount = 0;
  let globalTopSheets = 0;

  // Section addon counters
  let gAddonDoors = 0;
  let gAddonSidePanels = 0;
  let gAddonHingePairs = 0;
  let gAddonRailsRemoved = 0;
  let gAddonShelves = 0;

  // Paint accumulators
  let gPaintFrameUnits = 0;
  let gPaintDoorUnits = 0;
  let gPaintPanelUnits = 0;

  // ── Shelving accumulators ──────────────────────────────────────────────
  const shelvingCutPlans: ShelvingCutPlanModule[] = [];
  let shelvingPlywoodSheets = 0;
  const shelvingModuleMeta: {
    unitIdx: number;
    modKey: string;
    label: string;
    config: NonNullable<ReturnType<typeof getShelvingConfig>>;
  }[] = [];

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

    // ── Shelving unit path ──────────────────────────────────────────────
    // Shelving parts go into the SAME allParts pool as tote organizer parts
    // so the FFD bin packer can share boards and carry offcuts across both.
    if (unit.shelvingConfigId) {
      const cfg = getShelvingConfig(unit.shelvingConfigId);
      if (!cfg) return;

      const m = cfg.materials;
      const modKey = `shelving-${unitIdx}`;

      // Collect lumber parts into the UNIFIED allParts array
      for (let i = 0; i < m.uprights; i++) {
        allParts.push({ len: m.uprightLen, name: "Post", type: "upright", unitIdx, modKey });
      }
      for (let i = 0; i < m.rails; i++) {
        allParts.push({ len: m.railLen, name: "Rail", type: "rail", unitIdx, modKey });
      }
      for (let i = 0; i < m.depthBraces; i++) {
        allParts.push({ len: m.depthBraceLen, name: "Brace", type: "rail", unitIdx, modKey });
      }

      // Plywood: each surface = widthIn × depth. A 4×8 sheet = 32 sq ft.
      const totalSqFt = m.plywoodSurfaces * m.plywoodSqFtPerSurface;
      const sheetsNeeded = Math.ceil(totalSqFt / 32);
      shelvingPlywoodSheets += sheetsNeeded;

      // Screws
      gScrew3 += m.screws3;
      gScrew16 += m.screws16;

      // Retail price
      gRetail += unit.price;

      shelvingModuleMeta.push({ unitIdx, modKey, label: cfg.label, config: cfg });
      return;
    }

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

    // ── Section Addons (Organizer Customization) ─────────────────
    const unitAddons = unit.addons ?? [];
    for (const addon of unitAddons) {
      switch (addon.type) {
        case "plywood_door":
          // "doors_on" target means all columns get a door
          if (addon.target === "doors_on") {
            gAddonDoors += totalCols;
            // Each door gets a pair of Blum concealed hinges
            gAddonHingePairs += totalCols;
          } else {
            gAddonDoors++;
          }
          break;
        case "side_panel":
          gAddonSidePanels++;
          break;
        case "hinge_concealed":
          gAddonHingePairs++;
          break;
        case "rail_removed":
          gAddonRailsRemoved++;
          // Rail removal saves 2 plywood strips (the pair of rails for that slot)
          // and saves 8 screws (4 per rail × 2 rails)
          globalStripCount -= 2;
          gScrew16 -= 8;
          break;
        case "shelf":
          gAddonShelves++;
          // A shelf insert adds 1 plywood surface (cut from sheet stock)
          // and 4 screws to mount it (1⅝" screws)
          gScrew16 += 4;
          break;
      }
    }

    // ── Paint ──────────────────────────────────────────────────────
    if (unit.paintFrameColor) gPaintFrameUnits++;
    if (unit.paintDoorColor) gPaintDoorUnits++;
    if (unit.paintSidePanelColor) gPaintPanelUnits++;
  });

  // ── PHASE 2: Unified Global Bin Packing — ALL parts (tote + shelving) ──
  // Both tote organizer and shelving lumber parts are in allParts.
  // FFD sorts longest-first so tall uprights fill boards first, then shorter
  // rails/braces/plates fill the remaining offcuts — across unit types.
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

  // ── PHASE 3: Unified per-module cut plans with offcut carry-forward ────
  // Process ALL modules (tote + shelving) in BUILD ORDER so offcuts from
  // earlier modules are available to later ones — just like the real build
  // sequence. A tote module's post waste can fill a shelving rail, and vice
  // versa. Each module tries to place cuts on carry-forward boards before
  // opening fresh stock.

  interface VisualCut extends CutPart { modKey: string }

  // Build a unified ordered list of all module keys (tote + shelving)
  // Tote modules: sorted by unit → bottom tier → left-to-right
  // Shelving modules: sorted by unitIdx, placed after tote modules of the same unit
  const allBuildOrderKeys: { modKey: string; unitIdx: number; sortOrder: number }[] = [];

  // Add tote modules
  const sortedToteMeta = [...moduleMetadata].sort((a, b) => {
    if (a.unitIdx !== b.unitIdx) return a.unitIdx - b.unitIdx;
    if (a.heightTierIndex !== b.heightTierIndex) return a.heightTierIndex - b.heightTierIndex;
    return a.widthModIndex - b.widthModIndex;
  });
  for (const meta of sortedToteMeta) {
    allBuildOrderKeys.push({ modKey: meta.modKey, unitIdx: meta.unitIdx, sortOrder: meta.unitIdx * 1000 + meta.heightTierIndex * 10 + meta.widthModIndex });
  }

  // Add shelving modules (after tote modules at same unitIdx)
  for (const sm of shelvingModuleMeta) {
    allBuildOrderKeys.push({ modKey: sm.modKey, unitIdx: sm.unitIdx, sortOrder: sm.unitIdx * 1000 + 999 });
  }

  // Final sort: by sortOrder so tote tiers come before shelving at the same unit index
  allBuildOrderKeys.sort((a, b) => a.sortOrder - b.sortOrder);

  // Build-order index map — UNIFIED across tote and shelving modules
  const buildOrderMap = new Map<string, number>();
  allBuildOrderKeys.forEach((entry, idx) => {
    buildOrderMap.set(entry.modKey, idx);
  });

  // Single FFD visual pass, processing one module at a time in build order
  const visualBoards: { cuts: VisualCut[]; rem: number }[] = [];

  for (const entry of allBuildOrderKeys) {
    const moduleParts: VisualCut[] = allParts
      .filter((p) => p.modKey === entry.modKey)
      .map((p) => ({ len: p.len, name: p.name, type: p.type, modKey: entry.modKey }));

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

  // Helper: human-readable module label (handles both tote and shelving)
  function modLabel(mk: string): string {
    if (mk.startsWith("shelving-")) {
      const sm = shelvingModuleMeta.find((m) => m.modKey === mk);
      return sm ? `Shelf` : "?";
    }
    const m = moduleMetadata.find((mm) => mm.modKey === mk);
    if (!m) return "?";
    return `Mod ${m.widthModIndex + 1}`;
  }

  // Shared board extraction logic — used for both tote modules and shelving
  function extractModuleBoards(modKey: string): Board[] {
    const myOrder = buildOrderMap.get(modKey)!;
    const boards: Board[] = [];

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

      boards.push({
        cuts: myCuts.map((c) => ({ len: c.len, name: c.name, type: c.type })),
        rem: vb.rem,
        ...(priorLen > 0 ? { priorUsed: priorLen } : {}),
        ...(laterLen > 0 ? { laterUsed: laterLen, laterLabel: laterLbl } : {}),
      });
    }

    return boards;
  }

  // Extract tote module cut plans
  for (const meta of moduleMetadata) {
    cutPlans.push({
      unitIndex: meta.unitIdx + 1,
      moduleIndex: meta.widthModIndex + 1,
      cols: meta.cols,
      rows: meta.rows,
      boards: extractModuleBoards(meta.modKey),
      stripCount: meta.stripCount,
      railStrips: meta.railStrips,
      backSupports: meta.backSupports,
      moduleWidth: meta.moduleWidth,
      ...(meta.heightTierTotal > 1
        ? { heightTier: meta.heightTierIndex + 1, heightTierTotal: meta.heightTierTotal }
        : {}),
    });
  }

  // Extract shelving cut plans (same board pool, same offcut tracking)
  for (const sm of shelvingModuleMeta) {
    shelvingCutPlans.push({
      unitIndex: sm.unitIdx + 1,
      shelvingLabel: sm.config.label,
      widthIn: sm.config.widthIn,
      frameH: sm.config.frameH,
      depth: sm.config.depth,
      shelves: sm.config.shelves,
      boards: extractModuleBoards(sm.modKey),
      plywoodSurfaces: sm.config.materials.plywoodSurfaces,
      plywoodSqFtPerSurface: sm.config.materials.plywoodSqFtPerSurface,
    });
  }

  // ── Final Plywood Calculation ──────────────────────────────────────────
  // Ensure strip count doesn't go negative from rail removals
  if (globalStripCount < 0) globalStripCount = 0;
  // Ensure screw counts don't go negative from rail removals
  if (gScrew16 < 0) gScrew16 = 0;

  const stripCredit = globalTopSheets * 27;
  let netStrips = globalStripCount - stripCredit;
  if (netStrips < 0) netStrips = 0;

  const structSheets = Math.ceil(netStrips / 72);
  const gSheets = structSheets + globalTopSheets + shelvingPlywoodSheets;

  // ── Screw Box Math ────────────────────────────────────────────────────
  const boxes16 = Math.ceil(gScrew16 / 158);
  const boxes3 = Math.ceil(gScrew3 / 137);
  const boxes1 = Math.ceil(gScrew1 / 90);

  // ── Shopping List ─────────────────────────────────────────────────────
  const shopping_list: ShoppingItem[] = [
    { name: "2x4 Lumber", detail: "8 ft Standard", qty: gBoards },
  ];

  let plyDetail = "Total Sheets";
  if (shelvingPlywoodSheets > 0 && globalTopSheets > 0) {
    plyDetail = `${globalTopSheets} Top + ${structSheets} Struct + ${shelvingPlywoodSheets} Shelving`;
  } else if (shelvingPlywoodSheets > 0) {
    plyDetail = `${shelvingPlywoodSheets} Shelving${structSheets > 0 ? ` + ${structSheets} Struct` : ""}`;
  } else if (globalTopSheets > 0) {
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

  // ── Section Addon Materials ─────────────────────────────────────────
  // Addon plywood: doors (~4 per sheet), side panels (~2 per sheet), shelves (~4 per sheet)
  const addonDoorSheets = gAddonDoors > 0 ? Math.ceil(gAddonDoors / 4) : 0;
  const addonPanelSheets = gAddonSidePanels > 0 ? Math.ceil(gAddonSidePanels / 2) : 0;
  const addonShelfSheets = gAddonShelves > 0 ? Math.ceil(gAddonShelves / 4) : 0;

  if (gAddonDoors > 0) {
    shopping_list.push({ name: "Plywood (Doors)", detail: `${gAddonDoors} door panel${gAddonDoors > 1 ? "s" : ""}`, qty: addonDoorSheets });
  }
  if (gAddonSidePanels > 0) {
    shopping_list.push({ name: "Plywood (Side Panels)", detail: `${gAddonSidePanels} panel${gAddonSidePanels > 1 ? "s" : ""}`, qty: addonPanelSheets });
  }
  if (gAddonShelves > 0) {
    shopping_list.push({ name: "Plywood (Shelves)", detail: `${gAddonShelves} shelf insert${gAddonShelves > 1 ? "s" : ""}`, qty: addonShelfSheets });
  }
  if (gAddonHingePairs > 0) {
    shopping_list.push({ name: "Blum Concealed Hinges", detail: "Pair (2 hinges)", qty: gAddonHingePairs });
  }
  if (gAddonRailsRemoved > 0) {
    shopping_list.push({ name: "Rails Removed", detail: `${gAddonRailsRemoved} slot${gAddonRailsRemoved > 1 ? "s" : ""} opened up (−${gAddonRailsRemoved * 2} strips, −${gAddonRailsRemoved * 8} screws)`, qty: gAddonRailsRemoved });
  }

  // ── Paint Materials ─────────────────────────────────────────────────
  // Paint is a service addon — listed in the shopping list for installer awareness
  const paintItems: string[] = [];
  if (gPaintFrameUnits > 0) paintItems.push(`${gPaintFrameUnits} frame${gPaintFrameUnits > 1 ? "s" : ""}`);
  if (gPaintDoorUnits > 0) paintItems.push(`${gPaintDoorUnits} door set${gPaintDoorUnits > 1 ? "s" : ""}`);
  if (gPaintPanelUnits > 0) paintItems.push(`${gPaintPanelUnits} panel set${gPaintPanelUnits > 1 ? "s" : ""}`);
  if (paintItems.length > 0) {
    shopping_list.push({ name: "Paint", detail: paintItems.join(" + "), qty: paintItems.length > 1 ? `${paintItems.length} items` : "1 item" });
  }

  // ── Financials ────────────────────────────────────────────────────────
  const effectiveRate = customDepositRate ?? DEPOSIT_RATE;
  const depositAmount = Math.round(gRetail * effectiveRate * 100) / 100;
  const balanceDue = Math.round((gRetail - depositAmount) * 100) / 100;

  return {
    shopping_list,
    cut_plan_visuals: cutPlans,
    ...(shelvingCutPlans.length > 0 ? { shelving_cut_plans: shelvingCutPlans } : {}),
    financials: {
      retailTotal: gRetail,
      depositRate: effectiveRate,
      depositAmount,
      balanceDue,
    },
    totals: {
      boards: gBoards,
      sheets: gSheets + addonDoorSheets + addonPanelSheets + addonShelfSheets,
      totes: gTotes,
      wheelKits: gWheels,
      screwBoxes_1_5_8: boxes16,
      screwBoxes_3: boxes3,
      screwBoxes_1: boxes1,
    },
  };
}
