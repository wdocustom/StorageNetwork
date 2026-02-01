"use server";

// ---------------------------------------------------------------------------
// The Storage-Network – Calculation Engine (v2)
// ---------------------------------------------------------------------------
// Server Action: computes shelf specs, cut lists, shopping lists, and pricing
// with add-on support (totes, wheels, plywood top).
// ---------------------------------------------------------------------------

const TOTE_WIDTHS = {
  hdx: 19.75,
  greenmade: 20.75,
} as const;

type ToteType = keyof typeof TOTE_WIDTHS;

const POST_WIDTH = 1.5; // 2×4 vertical post
const TIER_HEIGHT = 16; // inches per tier (vertical spacing)
const PRICE_PER_SLOT = 40; // dollars per opening

// Add-on pricing
const ADDON_TOTE_PRICE = 12; // per tote
const ADDON_WHEELS_PRICE = 45; // flat fee
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
  price: number; // base unit price (slots × $40)
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

  const toteWidth = TOTE_WIDTHS[check.tote];
  const opts: AddOns = addOns ?? {
    includeTotes: false,
    includeWheels: false,
    includePlywoodTop: false,
  };

  // -- Dimensions -----------------------------------------------------------
  const totalWidth = POST_WIDTH + cols * (toteWidth + POST_WIDTH);
  const totalHeight = rows * TIER_HEIGHT;

  // -- Slots ----------------------------------------------------------------
  const totalSlots = rows * cols;

  // -- Cut list -------------------------------------------------------------
  const verticalPostQty = cols + 1;
  const railLength = totalWidth - POST_WIDTH * 2;
  const horizontalRailSets = rows + 1;
  const horizontalRailQty = horizontalRailSets * 2;
  const shelfQty = rows;

  const cut_list: CutListItem[] = [
    {
      part_name: "Vertical Post (2×4)",
      length: parseFloat(totalHeight.toFixed(2)),
      qty: verticalPostQty,
    },
    {
      part_name: "Horizontal Rail (2×4)",
      length: parseFloat(railLength.toFixed(2)),
      qty: horizontalRailQty,
    },
    {
      part_name: "Shelf Platform (plywood/OSB)",
      length: parseFloat(railLength.toFixed(2)),
      qty: shelfQty,
    },
  ];

  // -- Shopping list --------------------------------------------------------
  const STUD_LENGTH = 96;
  const totalVerticalLinear = verticalPostQty * totalHeight;
  const totalHorizontalLinear = horizontalRailQty * railLength;
  const totalLinearInches = totalVerticalLinear + totalHorizontalLinear;
  const studsNeeded = Math.ceil(totalLinearInches / STUD_LENGTH);

  const SHEET_W = 48;
  const SHEET_L = 96;
  const shelfDepth = 20;
  const shelvesAcrossLength = Math.max(1, Math.floor(SHEET_L / railLength));
  const shelvesAcrossWidth = Math.max(1, Math.floor(SHEET_W / shelfDepth));
  const shelvesPerSheet = shelvesAcrossLength * shelvesAcrossWidth;
  const sheetsNeeded = Math.ceil(shelfQty / shelvesPerSheet);

  const screwJoints = horizontalRailQty * 2;
  const screwsNeeded = screwJoints * 8;
  const screwBoxes = Math.ceil(screwsNeeded / 100);

  const shopping_list: ShoppingListItem[] = [
    { sku_name: '2×4×96" Stud', qty: studsNeeded },
    { sku_name: '4×8 Plywood/OSB Sheet (3/4")', qty: sheetsNeeded },
    { sku_name: "Construction Screws (box of 100)", qty: screwBoxes },
  ];

  // -- Line items & pricing -------------------------------------------------
  const basePrice = totalSlots * PRICE_PER_SLOT;

  const line_items: LineItem[] = [
    {
      label: `Shelf Unit (${cols}×${rows})`,
      qty: totalSlots,
      unit_price: PRICE_PER_SLOT,
      total: basePrice,
    },
  ];

  let addonsTotal = 0;

  if (opts.includeTotes) {
    const toteTotal = totalSlots * ADDON_TOTE_PRICE;
    line_items.push({
      label: `${check.tote.toUpperCase()} Totes`,
      qty: totalSlots,
      unit_price: ADDON_TOTE_PRICE,
      total: toteTotal,
    });
    addonsTotal += toteTotal;
  }

  if (opts.includeWheels) {
    line_items.push({
      label: "Locking Caster Wheels",
      qty: null,
      unit_price: ADDON_WHEELS_PRICE,
      total: ADDON_WHEELS_PRICE,
    });
    addonsTotal += ADDON_WHEELS_PRICE;
  }

  if (opts.includePlywoodTop) {
    line_items.push({
      label: "Finished Plywood Top",
      qty: null,
      unit_price: ADDON_PLYWOOD_TOP_PRICE,
      total: ADDON_PLYWOOD_TOP_PRICE,
    });
    addonsTotal += ADDON_PLYWOOD_TOP_PRICE;
  }

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
