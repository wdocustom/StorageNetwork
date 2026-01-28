"use server";

// ---------------------------------------------------------------------------
// The Shelf Dude Partner Network – Calculation Engine
// ---------------------------------------------------------------------------
// Server Action that computes shelf specs, cut lists, and shopping lists
// based on available wall space and tote type.
// ---------------------------------------------------------------------------

const TOTE_WIDTHS = {
  hdx: 19.75,
  greenmade: 20.75,
} as const;

type ToteType = keyof typeof TOTE_WIDTHS;

const POST_WIDTH = 1.5; // 2×4 vertical post
const TIER_HEIGHT = 16; // inches per tier (vertical spacing)
const PRICE_PER_SLOT = 40; // dollars per opening

// -- Result types -----------------------------------------------------------

interface Specs {
  rows: number;
  cols: number;
  total_width: number;  // inches
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

export interface CalculationResult {
  specs: Specs;
  cut_list: CutListItem[];
  shopping_list: ShoppingListItem[];
  price: number;
}

// -- Validation -------------------------------------------------------------

function validateInputs(
  width: number,
  height: number,
  toteType: string
): { valid: true; tote: ToteType } | { valid: false; error: string } {
  if (!Number.isFinite(width) || width <= 0) {
    return { valid: false, error: "Width must be a positive number." };
  }
  if (!Number.isFinite(height) || height <= 0) {
    return { valid: false, error: "Height must be a positive number." };
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
  width: number,
  height: number,
  toteType: string
): Promise<CalculationResult> {
  const check = validateInputs(width, height, toteType);
  if (!check.valid) {
    throw new Error(check.error);
  }

  const toteWidth = TOTE_WIDTHS[check.tote];

  // -- Columns (horizontal) -------------------------------------------------
  // Layout: |post|tote|post|tote|post|...
  // First post is mandatory, then each column adds (toteWidth + POST_WIDTH).
  // cols = floor((availableWidth - first post) / (toteWidth + postWidth))
  const cols = Math.floor((width - POST_WIDTH) / (toteWidth + POST_WIDTH));
  if (cols < 1) {
    throw new Error(
      `Wall width (${width}") is too narrow for even one ${check.tote} tote (need at least ${toteWidth + POST_WIDTH * 2}").`
    );
  }

  // -- Rows (vertical) ------------------------------------------------------
  // Each tier uses TIER_HEIGHT of vertical space.
  const rows = Math.floor(height / TIER_HEIGHT);
  if (rows < 1) {
    throw new Error(
      `Wall height (${height}") is too short for even one tier (need at least ${TIER_HEIGHT}").`
    );
  }

  // -- Actual built dimensions ----------------------------------------------
  const totalWidth = POST_WIDTH + cols * (toteWidth + POST_WIDTH);
  const totalHeight = rows * TIER_HEIGHT;

  // -- Slots (openings) -----------------------------------------------------
  const totalSlots = rows * cols;

  // -- Cut list -------------------------------------------------------------
  // Vertical posts: one on each side of every column → cols + 1
  // They run the full built height.
  const verticalPostQty = cols + 1;

  // Horizontal rails: span between the outer posts per tier.
  // One rail at the bottom of each tier + one at the very top → rows + 1 sets.
  // Each set has a front rail and a back rail → multiply by 2.
  const railLength = totalWidth - POST_WIDTH * 2; // inside edge to inside edge
  const horizontalRailSets = rows + 1;
  const horizontalRailQty = horizontalRailSets * 2; // front + back

  // Shelf platforms: one per tier, spans full inside width.
  const shelfQty = rows;

  const cut_list: CutListItem[] = [
    {
      part_name: "Vertical Post (2×4)",
      length: totalHeight,
      qty: verticalPostQty,
    },
    {
      part_name: "Horizontal Rail (2×4)",
      length: railLength,
      qty: horizontalRailQty,
    },
    {
      part_name: "Shelf Platform (plywood/OSB)",
      length: railLength, // width of the shelf; depth determined by tote
      qty: shelfQty,
    },
  ];

  // -- Shopping list --------------------------------------------------------
  // 2×4 studs: each is 96" (8 ft). Figure out how many raw studs are needed.
  const STUD_LENGTH = 96;
  const totalVerticalLinear = verticalPostQty * totalHeight;
  const totalHorizontalLinear = horizontalRailQty * railLength;
  const totalLinearInches = totalVerticalLinear + totalHorizontalLinear;
  const studsNeeded = Math.ceil(totalLinearInches / STUD_LENGTH);

  // Plywood sheets: 48×96 (4×8 ft). Each shelf is railLength × ~20" deep.
  // Sheets can yield floor(96 / railLength) shelves across length,
  // and floor(48 / 20) = 2 shelves across width → shelves per sheet.
  const SHEET_W = 48;
  const SHEET_L = 96;
  const shelfDepth = 20; // approximate tote depth in inches
  const shelvesAcrossLength = Math.max(1, Math.floor(SHEET_L / railLength));
  const shelvesAcrossWidth = Math.max(1, Math.floor(SHEET_W / shelfDepth));
  const shelvesPerSheet = shelvesAcrossLength * shelvesAcrossWidth;
  const sheetsNeeded = Math.ceil(shelfQty / shelvesPerSheet);

  // Screws: ~8 per joint. Joints = 2 per rail end × horizontalRailQty
  const screwJoints = horizontalRailQty * 2;
  const screwsNeeded = screwJoints * 8;
  // Boxes of 100
  const screwBoxes = Math.ceil(screwsNeeded / 100);

  const shopping_list: ShoppingListItem[] = [
    { sku_name: '2×4×96" Stud', qty: studsNeeded },
    { sku_name: '4×8 Plywood/OSB Sheet (3/4")', qty: sheetsNeeded },
    { sku_name: "Construction Screws (box of 100)", qty: screwBoxes },
  ];

  // -- Price ----------------------------------------------------------------
  const price = totalSlots * PRICE_PER_SLOT;

  return {
    specs: {
      rows,
      cols,
      total_width: parseFloat(totalWidth.toFixed(2)),
      total_height: parseFloat(totalHeight.toFixed(2)),
    },
    cut_list,
    shopping_list,
    price,
  };
}
