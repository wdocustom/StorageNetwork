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
//   3/4" 4×8 plywood        $70.55  Home Depot sanded plywood sheet
//   5" swivel casters 4pk   $34.99  Home Depot plate caster set
//   1/4"×1" structural 95ct $10.99  Menards Grip-Fast (the plan's caster screw)
//   #9 star-drive boxes      $8.97   platform screw-box prices (137ct 3", 158ct 1-5/8")
//   HDX 27-gal tote          $8.98   Home Depot
//   Greenmade 27-gal tote    $11.49  Costco (regular price)
// ═══════════════════════════════════════════════════════════════════════════

import type { TotePlanDesign } from "@/lib/tote-plans";

export const RETAIL_PRICES = {
  stud2x4: 4.15,
  plywoodSheet: 70.55,
  casterKit4: 34.99,
  structuralScrewBox: 10.99,
  screwBox3in: 8.97,
  screwBox158: 8.97,
  toteHDX: 8.98,
  toteGM: 11.49,
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
  totes: { count: number; total: number };
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
  }

  // Totes by brand, straight from the design
  const toteTotal = design.units.reduce(
    (s, u) => s + u.cols * u.rows * (u.toteType === "GM" ? RETAIL_PRICES.toteGM : RETAIL_PRICES.toteHDX),
    0,
  );
  return {
    lines,
    materialsTotal: round2(lines.reduce((s, l) => s + l.total, 0)),
    totes: { count: design.units.reduce((s, u) => s + u.cols * u.rows, 0), total: round2(toteTotal) },
  };
}
