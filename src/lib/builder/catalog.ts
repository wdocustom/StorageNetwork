// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — what you can build with
//
// Two layers, both plain data so new materials are one entry each:
//
//   STOCKS         what the store sells: a 2×4 (in 8/10/12 ft boards), a
//                  4×8 plywood sheet in a given thickness. A stock fixes a
//                  piece's thickness and caps its other two sizes; the plan
//                  engine packs pieces back onto these when it builds the cut
//                  and shopping lists.
//   LIBRARY_ITEMS  what the library panel offers: a stock plus starting
//                  sizes ("2×4 × 8 ft", "Ripped rail", "24 × 48 panel").
//
// A ripped 2×4 is not its own stock: it is a 2×4 piece narrower than 3-1/2",
// so the cut list knows which board it comes out of.
//
// Client-safe: no imports.
// ═══════════════════════════════════════════════════════════════════════════

export type StockKind = "lumber" | "sheet";

export interface StockDef {
  id: string;
  kind: StockKind;
  /** "2×4 Lumber", '3/4" Plywood' */
  label: string;
  /** What it's for, one line */
  description: string;
  /** Actual thickness, inches. Fixed for every piece cut from this stock. */
  thickness: number;
  /** Actual full width as sold, inches (3.5 for a 2×4, 48 for a sheet) */
  width: number;
  /** Lengths the store sells, inches, shortest first */
  stockLengths: number[];
  /** Narrowest piece worth cutting, inches */
  minWidth: number;
  /** How the 3D and 2D views draw it */
  look: "lumber" | "plywood";
}

export const STOCKS: Record<string, StockDef> = {
  "2x4": {
    id: "2x4",
    kind: "lumber",
    label: "2×4 Lumber",
    description: 'Framing stud, actual 1-1/2" × 3-1/2"',
    thickness: 1.5,
    width: 3.5,
    stockLengths: [96, 120, 144],
    minWidth: 0.5,
    look: "lumber",
  },
  "ply-3/4": {
    id: "ply-3/4",
    kind: "sheet",
    label: '3/4" Plywood',
    description: "Structural: worktops, shelves that carry weight, cabinet sides",
    thickness: 0.75,
    width: 48,
    stockLengths: [96],
    minWidth: 1,
    look: "plywood",
  },
  "ply-1/2": {
    id: "ply-1/2",
    kind: "sheet",
    label: '1/2" Plywood',
    description: "Shelving and dividers on a supported frame",
    thickness: 0.5,
    width: 48,
    stockLengths: [96],
    minWidth: 1,
    look: "plywood",
  },
  "ply-1/4": {
    id: "ply-1/4",
    kind: "sheet",
    label: '1/4" Plywood',
    description: "Backer panels and drawer bottoms",
    thickness: 0.25,
    width: 48,
    stockLengths: [96],
    minWidth: 1,
    look: "plywood",
  },
};

export function getStock(id: string): StockDef | undefined {
  return Object.prototype.hasOwnProperty.call(STOCKS, id) ? STOCKS[id] : undefined;
}

/** Stocks a piece can be switched between without changing what it is (plywood thicknesses). */
export function sameKindStocks(stockId: string): StockDef[] {
  const stock = getStock(stockId);
  if (!stock) return [];
  return Object.values(STOCKS).filter((s) => s.kind === stock.kind);
}

/** Longest board / sheet the store sells for a stock. */
export function longestStock(stock: StockDef): number {
  return stock.stockLengths[stock.stockLengths.length - 1];
}

/** Hard limits a size field clamps to. Past the store's sizes is allowed (and warned about). */
export const SIZE_LIMITS = {
  minLength: 1,
  maxLumberLength: 192,
  maxSheetLength: 192,
  maxSheetWidth: 96,
} as const;

// ── Library ─────────────────────────────────────────────────────────────

export type LibrarySection = "Lumber" | "Ripped 2×4" | "Plywood";

export interface LibraryItem {
  id: string;
  section: LibrarySection;
  stock: string;
  label: string;
  /** Sizes shown under the label */
  detail: string;
  length: number;
  width: number;
}

/** Half a 2×4 after the saw kerf: the plans' standard rail rip. */
export const HALF_RIP_WIDTH = 1.5625;

export const LIBRARY_ITEMS: LibraryItem[] = [
  { id: "2x4-8", section: "Lumber", stock: "2x4", label: "2×4 × 8 ft", detail: '1-1/2" × 3-1/2" × 96"', length: 96, width: 3.5 },
  { id: "2x4-10", section: "Lumber", stock: "2x4", label: "2×4 × 10 ft", detail: '1-1/2" × 3-1/2" × 120"', length: 120, width: 3.5 },
  { id: "2x4-12", section: "Lumber", stock: "2x4", label: "2×4 × 12 ft", detail: '1-1/2" × 3-1/2" × 144"', length: 144, width: 3.5 },
  { id: "2x4-leg", section: "Lumber", stock: "2x4", label: "2×4 leg", detail: '1-1/2" × 3-1/2" × 34-1/2"', length: 34.5, width: 3.5 },

  { id: "rip-half", section: "Ripped 2×4", stock: "2x4", label: "Half rip (rail)", detail: '1-1/2" × 1-9/16" × 30"', length: 30, width: HALF_RIP_WIDTH },
  { id: "rip-square", section: "Ripped 2×4", stock: "2x4", label: "Square cleat", detail: '1-1/2" × 1-1/2" × 24"', length: 24, width: 1.5 },
  { id: "rip-2", section: "Ripped 2×4", stock: "2x4", label: '2" rip', detail: '1-1/2" × 2" × 48"', length: 48, width: 2 },

  { id: "ply34-sheet", section: "Plywood", stock: "ply-3/4", label: '3/4" sheet, 4 × 8', detail: 'Structural · 48" × 96"', length: 96, width: 48 },
  { id: "ply34-top", section: "Plywood", stock: "ply-3/4", label: '3/4" worktop', detail: 'Structural · 24" × 72"', length: 72, width: 24 },
  { id: "ply12-sheet", section: "Plywood", stock: "ply-1/2", label: '1/2" sheet, 4 × 8', detail: 'Shelving · 48" × 96"', length: 96, width: 48 },
  { id: "ply12-shelf", section: "Plywood", stock: "ply-1/2", label: '1/2" shelf', detail: 'Shelving · 16" × 48"', length: 48, width: 16 },
  { id: "ply14-sheet", section: "Plywood", stock: "ply-1/4", label: '1/4" sheet, 4 × 8', detail: 'Backer · 48" × 96"', length: 96, width: 48 },
];

export const LIBRARY_SECTIONS: LibrarySection[] = ["Lumber", "Ripped 2×4", "Plywood"];
