"use server";

// ═══════════════════════════════════════════════════════════════════════════
// BLACK BOX — Server-side calculator (proprietary math never leaves server)
// ═══════════════════════════════════════════════════════════════════════════

type ToteModel = "HDX" | "GM";

interface CalculateBuildInput {
  wallWidth?: number;
  wallHeight?: number;
  cols?: number;
  rows?: number;
  toteModel: ToteModel;
  addOns: {
    totes: boolean;
    wheels: boolean;
    top: boolean;
  };
  mode: "wallFit" | "manual";
}

interface BuildResult {
  success: true;
  cols: number;
  rows: number;
  price: number;
  dimensions: { totalW: number; totalH: number };
  config: {
    toteModel: ToteModel;
    hasTotes: boolean;
    hasWheels: boolean;
    hasTop: boolean;
    slots: number;
    topSheets: number;
  };
}

interface BuildError {
  success: false;
  error: string;
}

// ── Proprietary constants (NEVER exposed to client) ──────────────────────
const GAP = 1.5;
const VERTICAL_INC = 16;
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const PLATE_HEIGHT = 1.5;
const TOP_GAP = 2.5;

const PRICE_PER_SLOT = 40;
const PRICE_PER_TOTE = 12;
const PRICE_WHEELS = 45;
const PRICE_PLYWOOD_SHEET = 75;

function getOpening(model: ToteModel): number {
  return model === "HDX" ? OPENING_HDX : OPENING_GM;
}

export async function calculateBuild(
  input: CalculateBuildInput
): Promise<BuildResult | BuildError> {
  const { toteModel, addOns, mode } = input;
  const opening = getOpening(toteModel);

  let cols: number;
  let rows: number;

  if (mode === "wallFit") {
    const { wallWidth, wallHeight } = input;
    if (!wallWidth || !wallHeight || wallWidth <= 0 || wallHeight <= 0) {
      return { success: false, error: "Valid wall dimensions are required." };
    }
    cols = Math.floor((wallWidth - GAP) / (opening + GAP));
    rows = Math.floor((wallHeight - 5.5) / VERTICAL_INC);
    if (cols < 1) cols = 1;
    if (rows < 1) rows = 1;
  } else {
    cols = input.cols ?? 1;
    rows = input.rows ?? 1;
    if (cols < 1) cols = 1;
    if (cols > 20) cols = 20;
    if (rows < 1) rows = 1;
    if (rows > 20) rows = 20;
  }

  // ── Dimensions ─────────────────────────────────────────────────────────
  const totalW = cols * opening + (cols + 1) * GAP;
  const totalH = rows * VERTICAL_INC + PLATE_HEIGHT * 2 + TOP_GAP;

  // ── Pricing ────────────────────────────────────────────────────────────
  const slots = cols * rows;
  let price = slots * PRICE_PER_SLOT;
  if (addOns.totes) price += slots * PRICE_PER_TOTE;
  if (addOns.wheels) price += PRICE_WHEELS;

  let topSheets = 0;
  if (totalW > 192) topSheets = 3;
  else if (totalW > 96) topSheets = 2;
  else topSheets = 1;
  if (addOns.top) price += topSheets * PRICE_PLYWOOD_SHEET;

  return {
    success: true,
    cols,
    rows,
    price,
    dimensions: { totalW, totalH },
    config: {
      toteModel,
      hasTotes: addOns.totes,
      hasWheels: addOns.wheels,
      hasTop: addOns.top,
      slots,
      topSheets,
    },
  };
}
