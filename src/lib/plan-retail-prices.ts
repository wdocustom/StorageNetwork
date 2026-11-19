// ═══════════════════════════════════════════════════════════════════════════
// DIY MATERIAL COST — what a plan buyer pays at the store
//
// Retail shelf prices (not installer cost), applied to the plan's own
// shopping list: whole 2×4s, full plywood sheets for worktops, full caster
// 4-packs and full screw boxes. Totes are priced separately because many
// buyers already own them.
//
// Prices checked Oct 2026 — update as they move:
//   2×4×8' stud            $4.15   Home Depot #2 premium KD stud
//   3/4" 4×8 plywood        $40.00  a basic 3/4" sheet a DIY buyer picks up themselves
//   5" swivel casters 4pk   $34.99  Home Depot plate caster set
//   1/4"×1" structural 95ct $10.99  Menards Grip-Fast (the plan's caster screw)
//   #9 star-drive boxes      $8.97   platform screw-box prices (137ct 3", 158ct 1-5/8")
//   HDX 27-gal tote          $8.98   Home Depot
//   Greenmade 27-gal tote    $11.49  Costco (regular price)
// Mini Tote Rack (Nov 2026 estimates — verify at the store):
//   2×3×8' stud             $3.48   Home Depot
//   3/4" 2'×4' plywood panel $24.98  Home Depot project panel
//   3/4" 4'×4' plywood       $32.00
//   4'×8' sheet              $40.00  (same as above)
//   (the plan buys ONE of these: the smallest that holds the rails + top)
//   #8 × 1-1/4" / #9 × 2-1/2" boxes $8.97
//   HDX 6.5 qt tote          $3.97   Home Depot regular — on sale 5 for $10 ($2 each)
// ═══════════════════════════════════════════════════════════════════════════

import type { TotePlanDesign } from "@/lib/tote-plans";
import { MINI_TOTE_URL } from "@/lib/plan-product-links";

export const RETAIL_PRICES = {
  stud2x4: 4.15,
  plywoodSheet: 40,
  casterKit4: 34.99,
  structuralScrewBox: 10.99,
  screwBox3in: 8.97,
  screwBox158: 8.97,
  toteHDX: 8.98,
  toteGM: 11.49,
  stud2x3: 3.48,
  plywoodPanel2x4: 24.98,
  plywoodHalf4x4: 32,
  screwBox125: 8.97,
  screwBox25: 8.97,
  /** Sale: 5 for $10 at Home Depot (Nov 2026) — set back to toteMiniRegular when it ends */
  toteMini: 2,
  toteMiniRegular: 3.97,
} as const;

export const RETAIL_PRICES_CHECKED = "October 2026";

/** The slice of a plan shopping-list item this needs. */
export interface ShoppingItemLike {
  name: string;
  qty: number | string;
  detail?: string;
}

export interface MaterialLine {
  label: string;
  qty: number;
  /** Singular: "board", "sheet", "pack", "box" */
  unit: string;
  unitPrice: number;
  total: number;
}

export interface MaterialEstimate {
  lines: MaterialLine[];
  /** Everything except totes, dollars */
  materialsTotal: number;
  totes: {
    count: number;
    total: number;
    /** On sale: what they'd cost at the regular price (shown struck through) */
    regularTotal?: number;
    /** Where to buy them, e.g. the Home Depot page */
    url?: string;
    deal?: string;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const count = (qty: number | string) => Number.parseInt(String(qty), 10) || 0;

/** Price a plan's shopping list at retail. Unknown items are skipped. */
export function priceShoppingList(items: ShoppingItemLike[], design: TotePlanDesign): MaterialEstimate {
  const lines: MaterialLine[] = [];
  const add = (label: string, qty: number, unit: string, unitPrice: number) => {
    if (qty <= 0) return;
    const existing = lines.find((l) => l.label === label);
    if (existing) {
      existing.qty += qty;
      existing.total = round2(existing.qty * unitPrice);
    } else {
      lines.push({ label, qty, unit, unitPrice, total: round2(qty * unitPrice) });
    }
  };

  for (const item of items) {
    const qty = count(item.qty);
    if (item.name === "2x4 Lumber") add("2×4×8' studs", qty, "board", RETAIL_PRICES.stud2x4);
    else if (item.name === "Plywood") add('3/4" plywood (worktop)', qty, "sheet", RETAIL_PRICES.plywoodSheet);
    else if (item.name === "Caster Kits") add('5" swivel casters (4-pack)', qty, "pack", RETAIL_PRICES.casterKit4);
    else if (item.name === '1/4" × 1" Structural Screws') add("Caster screws", qty, "box", RETAIL_PRICES.structuralScrewBox);
    else if (item.name === '#9 × 3" Star-Drive Screws') add('#9 × 3" screws', qty, "box", RETAIL_PRICES.screwBox3in);
    else if (item.name === '#9 × 1-5/8" Star-Drive Screws') add('#9 × 1-5/8" screws', qty, "box", RETAIL_PRICES.screwBox158);
    // Mini Tote Rack
    else if (item.name === "2×3 Lumber") add("2×3×8' studs", qty, "board", RETAIL_PRICES.stud2x3);
    else if (item.name === '3/4" Plywood Panel') add('3/4" plywood 2\'×4\' panel', qty, "panel", RETAIL_PRICES.plywoodPanel2x4);
    else if (item.name === '3/4" Plywood Half Sheet') add('3/4" plywood 4\'×4\' sheet', qty, "sheet", RETAIL_PRICES.plywoodHalf4x4);
    else if (item.name === '3/4" Plywood Sheet') add('3/4" plywood 4\'×8\' sheet', qty, "sheet", RETAIL_PRICES.plywoodSheet);
    else if (item.name === '#8 × 1-1/4" Star-Drive Screws') add('#8 × 1-1/4" screws', qty, "box", RETAIL_PRICES.screwBox125);
    else if (item.name === '#9 × 2-1/2" Star-Drive Screws') add('#9 × 2-1/2" screws', qty, "box", RETAIL_PRICES.screwBox25);
  }

  // Totes by brand, straight from the design
  const mini = design.units.every((u) => u.toteType === "MINI");
  const miniTotes = design.units.reduce((s, u) => s + (u.toteType === "MINI" ? u.cols * u.rows : 0), 0);
  const toteTotal = design.units.reduce(
    (s, u) =>
      s + u.cols * u.rows * (u.toteType === "MINI" ? RETAIL_PRICES.toteMini : u.toteType === "GM" ? RETAIL_PRICES.toteGM : RETAIL_PRICES.toteHDX),
    0,
  );
  return {
    lines,
    materialsTotal: round2(lines.reduce((s, l) => s + l.total, 0)),
    totes: {
      count: design.units.reduce((s, u) => s + u.cols * u.rows, 0),
      total: round2(toteTotal),
      ...(mini && RETAIL_PRICES.toteMini < RETAIL_PRICES.toteMiniRegular
        ? { regularTotal: round2(miniTotes * RETAIL_PRICES.toteMiniRegular), deal: "5 for $10 at Home Depot" }
        : {}),
      ...(mini ? { url: MINI_TOTE_URL } : {}),
    },
  };
}
