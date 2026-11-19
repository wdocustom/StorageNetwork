// ═══════════════════════════════════════════════════════════════════════════
// MINI TOTE RACK — the ONE source for mini rack dimensions (DIY Mini plans,
// the installer mini unit, 3D models, diagrams, cut lists).
//
// Measured from a built 4×4 (Nov 2026) — these numbers are the truth:
//   • Totes: HDX 6.5 qt. Lid 8" × 12-3/4", 6-1/4" tall; the lip that rides
//     the rails is 4-3/4" up from the bottom; the body between the rails is
//     6-15/16" wide (the lid overhangs it 11/16" each side).
//   • Frame: 2×3s (1-1/2" × 2-1/2") for uprights AND top/bottom plates.
//   • Rails: 3/4" plywood ripped to 1-1/4", screwed to the upright faces with
//     1-1/4" screws, 2 per rail end (8 per tote slot).
//   • Bay: 8-1/4" between uprights; rack depth 12-3/4" (= rail length).
//   • Rails by their TOP edge, from the bottom of the upright (= the top of
//     the bottom plate): 5-3/4", then every 6-1/2". 2-1/2" from the top of
//     the top rail to the bottom of the top plate.
//     → upright = 1-3/4" + 6-1/2" × rows (4 high: 27-3/4")
//     → plate   = 8-1/4" × cols + 1-1/2" × (cols + 1) (4 wide: 40-1/2")
//   • Sideways: the tote turns 90° so its 12-3/4" length spans the bay:
//     13" opening (11-1/2" between rails, the same lip on each rail as
//     standard), 8" deep. Rail heights don't change.
//   • 8' stock: plates and uprights each come out of one 8' 2×3, so a module
//     is at most 9 bays wide (6 sideways) and 14 totes tall.
//
// Client-safe: no server imports.
// ═══════════════════════════════════════════════════════════════════════════

export const MINI = {
  /** What the designer and plans call it */
  name: "Mini Tote Rack",
  tote: {
    name: "HDX 6.5 qt",
    /** Lid, side to side */
    width: 8,
    /** Lid, front to back */
    length: 12.75,
    height: 6.25,
    /** Bottom of the tote up to the lip that rides the rails */
    lipFromBottom: 4.75,
    /** Body width between the rails */
    bodyWidth: 6.9375,
    /** Lid past the body, each side */
    lipOverhang: 0.6875,
  },
  /** 2×3 upright: 1-1/2" faces the front, 2-1/2" front to back */
  postW: 1.5,
  postD: 2.5,
  /** 2×3 plates, laid flat */
  plateH: 1.5,
  plateD: 2.5,
  /** 3/4" plywood ripped to 1-1/4" */
  railT: 0.75,
  railH: 1.25,
  opening: 8.25,
  openingSideways: 13,
  depth: 12.75,
  depthSideways: 8,
  /** Rail TOP edges from the bottom of the upright */
  firstRailTop: 5.75,
  railPitch: 6.5,
  /** Top of the top rail to the bottom of the top plate */
  aboveTopRail: 2.5,
  /** 2×3 × 8' */
  stock: 96,
  kerf: 0.125,
  /** Rail and back-brace screws: through 3/4" plywood into the 2×3 */
  railScrewLength: 1.25,
  railScrewsPerEnd: 2,
} as const;

export const MINI_TOTE_TYPE = "MINI" as const;

/** Clear bay between uprights. */
export function miniOpening(sideways = false): number {
  return sideways ? MINI.openingSideways : MINI.opening;
}

/** Rack depth front to back = rail length. */
export function miniDepth(sideways = false): number {
  return sideways ? MINI.depthSideways : MINI.depth;
}

/** Top edge of rail `row` (0 = bottom), from the bottom of the upright. */
export function miniRailTop(row: number): number {
  return MINI.firstRailTop + row * MINI.railPitch;
}

/** Rail top edges for a frame `rows` high. */
export function miniRailTops(rows: number): number[] {
  return Array.from({ length: Math.max(1, rows) }, (_, r) => miniRailTop(r));
}

/** Upright length for a frame `rows` high. */
export function miniUpright(rows: number): number {
  return miniRailTop(Math.max(1, rows) - 1) + MINI.aboveTopRail;
}

/** Plate length (= outside width) for a module `cols` wide. */
export function miniPlateLength(cols: number, sideways = false): number {
  return cols * miniOpening(sideways) + (cols + 1) * MINI.postW;
}

/** Most bays in one module: the plate must come out of one 8' 2×3. */
export function miniMaxModuleCols(sideways = false): number {
  let cols = 1;
  while (miniPlateLength(cols + 1, sideways) <= MINI.stock) cols++;
  return cols;
}

/** Most totes tall on one upright (an 8' 2×3). */
export function miniMaxRowsPerTier(): number {
  let rows = 1;
  while (miniUpright(rows + 1) <= MINI.stock) rows++;
  return rows;
}

/** Frame height of one module: 2×3 plates + upright. */
export function miniFrameHeight(rows: number): number {
  return MINI.plateH * 2 + miniUpright(rows);
}

// ── Rail stock: 3/4" plywood ripped to 1-1/4" ─────────────────────────────
// Strips are ripped along the panel's long side, then crosscut to length.

export interface MiniPlyStock {
  name: string;
  /** Short side × long side, inches */
  width: number;
  length: number;
}

export const MINI_PLY_PANEL: MiniPlyStock = { name: "2' × 4' panel", width: 24, length: 48 };
export const MINI_PLY_SHEET: MiniPlyStock = { name: "4' × 8' sheet", width: 48, length: 96 };

/** 1-1/4" strips one piece of plywood rips into. */
export function miniStripsPer(stock: MiniPlyStock): number {
  return Math.floor((stock.width + MINI.kerf) / (MINI.railH + MINI.kerf));
}

/** Rail-length pieces crosscut from one strip. */
export function miniPiecesPerStrip(stock: MiniPlyStock, pieceLength: number): number {
  return Math.floor((stock.length + MINI.kerf) / (pieceLength + MINI.kerf));
}

/** Rail-length pieces from one piece of plywood. */
export function miniPiecesPer(stock: MiniPlyStock, pieceLength: number): number {
  return miniStripsPer(stock) * miniPiecesPerStrip(stock, pieceLength);
}

export const MINI_PLY_HALF: MiniPlyStock = { name: "4' × 4' sheet", width: 48, length: 48 };

/** Smallest first: what a buyer can pick up at the store. */
export const MINI_PLY_STOCKS: readonly MiniPlyStock[] = [MINI_PLY_PANEL, MINI_PLY_HALF, MINI_PLY_SHEET];

export interface MiniPlywoodPlan {
  stock: MiniPlyStock;
  /** How many pieces of that stock to buy */
  count: number;
  /** 1-1/4" strips left for rails and braces after the top bands */
  railStrips: number;
}

/**
 * The plywood to buy for a mini rack: rails + back braces (1-1/4" strips
 * crosscut to `pieces[].length`) AND any tops (`tops`, width × depth), all
 * from ONE stock size — the smallest that holds everything (a 2' × 4'
 * panel, then a 4' × 4', then 4' × 8' sheets, as many as it takes). Each top
 * is cut first as a band across the piece's long side; the strips are
 * ripped from what's left.
 */
export function planMiniPlywood(pieces: { length: number; count: number }[], tops: { w: number; d: number }[]): MiniPlywoodPlan {
  const k = MINI.kerf;
  const stripW = MINI.railH + k;
  const stripsFor = (stock: MiniPlyStock) =>
    pieces.reduce((s, p) => s + (p.count > 0 ? Math.ceil(p.count / Math.max(1, miniPiecesPerStrip(stock, p.length))) : 0), 0);
  // A top band uses the width of this many strips
  const bandStrips = (d: number) => Math.ceil((d + k) / stripW);

  for (const stock of MINI_PLY_STOCKS) {
    if (tops.some((t) => t.w > stock.length || t.d > stock.width)) continue;
    const perPiece = miniStripsPer(stock);
    const topStrips = tops.reduce((s, t) => s + bandStrips(t.d), 0);
    const needed = stripsFor(stock) + topStrips;
    // One piece if it all fits; past the smallest sizes, as many 4' × 8' sheets as it takes
    if (needed <= perPiece) return { stock, count: 1, railStrips: perPiece - topStrips };
    if (stock === MINI_PLY_SHEET) {
      const count = Math.ceil(needed / perPiece);
      return { stock, count, railStrips: count * perPiece - topStrips };
    }
  }
  // Tops longer than 8' never happen (they're cut in 8' pieces); fall back to sheets
  return { stock: MINI_PLY_SHEET, count: Math.max(1, Math.ceil(stripsFor(MINI_PLY_SHEET) / miniStripsPer(MINI_PLY_SHEET))), railStrips: 0 };
}
