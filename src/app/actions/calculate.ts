"use server";

// ---------------------------------------------------------------------------
// The Storage-Network – Calculation Engine (v2)
// ---------------------------------------------------------------------------
// Server Action: computes shelf specs, cut lists, shopping lists, and pricing
// with add-on support (totes, wheels, plywood top).
// Supports both Standard (27 Gallon) and Mini (6.5 Quart) units.
// ---------------------------------------------------------------------------

const TOTE_WIDTHS = {
  hdx: 19.75,
  greenmade: 20.75,
} as const;

type ToteType = keyof typeof TOTE_WIDTHS;
type UnitType = "standard" | "mini";

const POST_WIDTH = 1.5; // 2×4 vertical post
const TIER_HEIGHT = 16; // inches per tier (vertical spacing) - Standard
const PRICE_PER_SLOT = 30; // dollars per opening - Standard

// Mini unit constants
const MINI_SLOT_WIDTH = 8.25; // Mini slot width
const MINI_TIER_HEIGHT = 7; // Mini vertical spacing
const MINI_FIRST_RAIL_HEIGHT = 5.25; // Mini first rail from bottom plate
const MINI_DEPTH = 12.75; // Mini unit depth
const MINI_RAIL_WIDTH = 1.0; // 1" wide plywood rails
const MINI_PRICE_PER_SLOT = 25; // Mini pricing

// Add-on pricing
const ADDON_TOTE_PRICE = 10; // per tote - Standard
const ADDON_MINI_TOTE_PRICE = 4; // per tote - Mini (6.5qt)
const ADDON_WHEELS_PRICE = 50; // flat fee - Standard
const ADDON_MINI_WHEELS_PRICE = 40; // flat fee - Mini
const ADDON_PLYWOOD_TOP_PRICE = 75; // flat fee

// -- Result types -----------------------------------------------------------

interface Specs {
  rows: number;
  cols: number;
  total_width: number; // inches
  total_height: number; // inches
}

interface CutListItem {
  part_name: string;
  length: number; // inches
  qty: number;
}

interface ShoppingListItem {
  sku_name: string;
  qty: number;
}

export interface AddOns {
  includeTotes: boolean;
  includeWheels: boolean;
  includePlywoodTop: boolean;
  unitType?: UnitType;
}

export interface LineItem {
  label: string;
  qty: number | null; // null = flat fee
  unit_price: number;
  total: number;
}

export interface CalculationResult {
  specs: Specs;
  cut_list: CutListItem[];
  shopping_list: ShoppingListItem[];
  line_items: LineItem[];
  price: number; // base unit price (slots × pricePerSlot)
  addons_total: number;
  grand_total: number;
}

// -- Wall-fit helper --------------------------------------------------------
// Returns the max cols and rows that fit within a wall, without building.

export async function getMaxFit(
  wallWidth: number,
  wallHeight: number,
  toteType: string
): Promise<{ maxCols: number; maxRows: number }> {
  const key = toteType.toLowerCase() as ToteType;
  const toteWidth = TOTE_WIDTHS[key] ?? TOTE_WIDTHS.hdx;
  const maxCols = Math.max(
    1,
    Math.floor((wallWidth - POST_WIDTH) / (toteWidth + POST_WIDTH))
  );
  const maxRows = Math.max(1, Math.floor(wallHeight / TIER_HEIGHT));
  return { maxCols, maxRows };
}

// -- Validation -------------------------------------------------------------

function validateDesign(
  cols: number,
  rows: number,
  toteType: string
): { valid: true; tote: ToteType } | { valid: false; error: string } {
  if (!Number.isFinite(cols) || cols < 1 || cols > 20) {
    return { valid: false, error: "Columns must be between 1 and 20." };
  }
  if (!Number.isFinite(rows) || rows < 1 || rows > 12) {
    return { valid: false, error: "Tiers must be between 1 and 12." };
  }
  const key = toteType.toLowerCase();
  if (!(key in TOTE_WIDTHS)) {
    return {
      valid: false,
      error: `Invalid tote type "${toteType}". Use "hdx" or "greenmade".`,
    };
  }
  return { valid: true, tote: key as ToteType };
}

// -- Core calculation -------------------------------------------------------

export async function calculateShelfMaterials(
  cols: number,
  rows: number,
  toteType: string,
  addOns?: AddOns
): Promise<CalculationResult> {
  const check = validateDesign(cols, rows, toteType);
  if (!check.valid) {
    throw new Error(check.error);
  }

  const unitType: UnitType = addOns?.unitType ?? "standard";
  const isMini = unitType === "mini";

  const toteWidth = isMini ? MINI_SLOT_WIDTH : TOTE_WIDTHS[check.tote];
  const tierHeight = isMini ? MINI_TIER_HEIGHT : TIER_HEIGHT;
  const pricePerSlot = isMini ? MINI_PRICE_PER_SLOT : PRICE_PER_SLOT;
  const unitDepth = isMini ? MINI_DEPTH : 30;

  const opts: AddOns = addOns ?? {
    includeTotes: false,
    includeWheels: false,
    includePlywoodTop: false,
    unitType: "standard",
  };

  // For Mini units, plywood top is always included (mandatory)
  const effectiveIncludePlywoodTop = isMini ? true : opts.includePlywoodTop;

  // -- Dimensions -----------------------------------------------------------
  const totalWidth = POST_WIDTH + cols * (toteWidth + POST_WIDTH);

  let totalHeight: number;
  if (isMini) {
    // Mini: bottom plate + first rail + (rows-1) * spacing + clearance + plywood top
    const lastRailHeight = MINI_FIRST_RAIL_HEIGHT + (rows - 1) * MINI_TIER_HEIGHT;
    totalHeight = 1.5 + lastRailHeight + 2 + 0.75; // plate + rails + clearance + plywood
  } else {
    totalHeight = rows * tierHeight;
  }

  // -- Slots ----------------------------------------------------------------
  const totalSlots = rows * cols;

  // -- Cut list -------------------------------------------------------------
  const cut_list: CutListItem[] = [];

  if (isMini) {
    // Mini unit cut list
    const verticalPostQty = (cols + 1) * 2; // Front + back posts
    const postHeight = MINI_FIRST_RAIL_HEIGHT + (rows - 1) * MINI_TIER_HEIGHT + 2; // Up to clearance above top rail

    // 2x4 Vertical Posts
    cut_list.push({
      part_name: "Vertical Post (2×4)",
      length: parseFloat(postHeight.toFixed(2)),
      qty: verticalPostQty,
    });

    // 2x4 Bottom Plates (front + back, no top plates for mini)
    cut_list.push({
      part_name: "Bottom Plate (2×4)",
      length: parseFloat(totalWidth.toFixed(2)),
      qty: 2, // Front and back
    });

    // 3/4" Plywood Rails (1" wide x 12.75" long)
    const railQty = cols * rows * 2; // 2 rails per slot (left + right)
    cut_list.push({
      part_name: `3/4" Plywood Rail (${MINI_RAIL_WIDTH}" × ${MINI_DEPTH}")`,
      length: MINI_DEPTH,
      qty: railQty,
    });

    // 3/4" Plywood Top (mandatory for mini)
    cut_list.push({
      part_name: `3/4" Plywood Top (${totalWidth.toFixed(1)}" × ${MINI_DEPTH}")`,
      length: totalWidth,
      qty: 1,
    });

  } else {
    // Standard unit cut list (original logic)
    const verticalPostQty = cols + 1;
    const railLength = totalWidth - POST_WIDTH * 2;
    const horizontalRailSets = rows + 1; // Top + bottom + intermediate
    const horizontalRailQty = horizontalRailSets * 2;
    const shelfQty = rows;

    cut_list.push({
      part_name: "Vertical Post (2×4)",
      length: parseFloat(totalHeight.toFixed(2)),
      qty: verticalPostQty,
    });

    cut_list.push({
      part_name: "Horizontal Rail (2×4)",
      length: parseFloat(railLength.toFixed(2)),
      qty: horizontalRailQty,
    });

    cut_list.push({
      part_name: "Shelf Platform (plywood/OSB)",
      length: parseFloat(railLength.toFixed(2)),
      qty: shelfQty,
    });

    // Top plates (2x4) for standard units
    cut_list.push({
      part_name: "Top Plate (2×4)",
      length: parseFloat(totalWidth.toFixed(2)),
      qty: 2, // Front and back
    });

    // Bottom plates (2x4) for standard units
    cut_list.push({
      part_name: "Bottom Plate (2×4)",
      length: parseFloat(totalWidth.toFixed(2)),
      qty: 2, // Front and back
    });
  }

  // -- Shopping list --------------------------------------------------------
  const STUD_LENGTH = 96;
  const SHEET_W = 48;
  const SHEET_L = 96;

  let studsNeeded: number;
  let sheetsNeeded: number;
  let screwBoxes: number;

  if (isMini) {
    // Mini shopping list
    const postHeight = MINI_FIRST_RAIL_HEIGHT + (rows - 1) * MINI_TIER_HEIGHT + 2;
    const verticalPostQty = (cols + 1) * 2;
    const totalPostLinear = verticalPostQty * postHeight;
    const totalPlateLinear = totalWidth * 2; // Bottom plates only
    studsNeeded = Math.ceil((totalPostLinear + totalPlateLinear) / STUD_LENGTH);

    // Plywood for rails + top
    const railQty = cols * rows * 2;
    const railSqIn = railQty * MINI_RAIL_WIDTH * MINI_DEPTH;
    const topSqIn = totalWidth * MINI_DEPTH;
    const totalPlywoodSqIn = railSqIn + topSqIn;
    const sheetSqIn = SHEET_W * SHEET_L;
    sheetsNeeded = Math.ceil(totalPlywoodSqIn / sheetSqIn);

    // Screws: 3" for base/posts, 1.625" for top
    const baseScrews = verticalPostQty * 4 + 8; // Posts to plates + plate joints
    const topScrews = (cols + 1) * 2 * 2; // Plywood top to posts (1.625")
    const railScrews = railQty * 2; // Rails to posts
    screwBoxes = Math.ceil((baseScrews + topScrews + railScrews) / 100);

  } else {
    // Standard shopping list (original logic)
    const verticalPostQty = cols + 1;
    const railLength = totalWidth - POST_WIDTH * 2;
    const horizontalRailSets = rows + 1;
    const horizontalRailQty = horizontalRailSets * 2;

    const totalVerticalLinear = verticalPostQty * totalHeight;
    const totalHorizontalLinear = horizontalRailQty * railLength;
    const totalPlateLinear = totalWidth * 4; // Top + bottom plates (front + back each)
    const totalLinearInches = totalVerticalLinear + totalHorizontalLinear + totalPlateLinear;
    studsNeeded = Math.ceil(totalLinearInches / STUD_LENGTH);

    const shelfDepth = 20;
    const shelvesAcrossLength = Math.max(1, Math.floor(SHEET_L / railLength));
    const shelvesAcrossWidth = Math.max(1, Math.floor(SHEET_W / shelfDepth));
    const shelvesPerSheet = shelvesAcrossLength * shelvesAcrossWidth;
    sheetsNeeded = Math.ceil(rows / shelvesPerSheet);

    const screwJoints = horizontalRailQty * 2;
    const screwsNeeded = screwJoints * 8;
    screwBoxes = Math.ceil(screwsNeeded / 100);
  }

  const shopping_list: ShoppingListItem[] = [
    { sku_name: '2×4×96" Stud', qty: studsNeeded },
    { sku_name: '4×8 Plywood/OSB Sheet (3/4")', qty: sheetsNeeded },
    { sku_name: "Construction Screws (box of 100)", qty: screwBoxes },
  ];

  // -- Line items & pricing -------------------------------------------------
  const basePrice = totalSlots * pricePerSlot;
  const unitLabel = isMini ? "Mini" : "Standard";

  const line_items: LineItem[] = [
    {
      label: `${unitLabel} Shelf Unit (${cols}×${rows})`,
      qty: totalSlots,
      unit_price: pricePerSlot,
      total: basePrice,
    },
  ];

  let addonsTotal = 0;

  if (opts.includeTotes) {
    const totePrice = isMini ? ADDON_MINI_TOTE_PRICE : ADDON_TOTE_PRICE;
    const toteTotal = totalSlots * totePrice;
    const toteLabel = isMini ? "6.5qt Clear Totes (Yellow Lids)" : `${check.tote.toUpperCase()} Totes`;
    line_items.push({
      label: toteLabel,
      qty: totalSlots,
      unit_price: totePrice,
      total: toteTotal,
    });
    addonsTotal += toteTotal;
  }

  if (opts.includeWheels) {
    const wheelPrice = isMini ? ADDON_MINI_WHEELS_PRICE : ADDON_WHEELS_PRICE;
    line_items.push({
      label: "Locking Caster Wheels",
      qty: null,
      unit_price: wheelPrice,
      total: wheelPrice,
    });
    addonsTotal += wheelPrice;
  }

  if (effectiveIncludePlywoodTop && !isMini) {
    // Standard units: plywood top is optional add-on
    line_items.push({
      label: "Finished Plywood Top",
      qty: null,
      unit_price: ADDON_PLYWOOD_TOP_PRICE,
      total: ADDON_PLYWOOD_TOP_PRICE,
    });
    addonsTotal += ADDON_PLYWOOD_TOP_PRICE;
  }
  // Mini units: plywood top is included in base price (mandatory), no separate line item

  return {
    specs: {
      rows,
      cols,
      total_width: parseFloat(totalWidth.toFixed(2)),
      total_height: parseFloat(totalHeight.toFixed(2)),
    },
    cut_list,
    shopping_list,
    line_items,
    price: basePrice,
    addons_total: addonsTotal,
    grand_total: basePrice + addonsTotal,
  };
}
