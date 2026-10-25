// ═══════════════════════════════════════════════════════════════════════════
// PLAN PRODUCT LINKS — where DIY plan buyers can buy the hardware
//
// Affiliate links for the hardware in a plan's shopping list, shown as
// "Buy" links on the build page and as clickable links in the PDF. These
// are the same products installers buy from their job ticket purchase list
// (JobTicket.tsx), so DIY builds use identical hardware.
//
// Lumber, plywood and totes are bought locally and have no link.
// ═══════════════════════════════════════════════════════════════════════════

export type ProductStore = "Amazon" | "Menards";

export interface ProductLink {
  url: string;
  store: ProductStore;
}

/** Keyed by the shopping-list item name generate-plan.ts emits. */
const LINKS: Record<string, ProductLink> = {
  "Caster Kits": { url: "https://amzn.to/4rPMxf6", store: "Amazon" },
  '#9 × 3" Star-Drive Screws': { url: "https://amzn.to/3OEWiho", store: "Amazon" },
  '#9 × 1-5/8" Star-Drive Screws': { url: "https://amzn.to/46xZ664", store: "Amazon" },
  // Menards on purpose: Amazon has no equivalent to this structural screw
  '1/4" × 1" Structural Screws': {
    url: "https://www.menards.com/main/hardware/fasteners-connectors/bolts/lag-screws/grip-fast-reg-premium-1-4-x-1-star-drive-tan-washer-head-structural-screw-95-count/30783-12/p-1553840877420-c-8742.htm",
    store: "Menards",
  },
};

export function productLinkFor(itemName: string): ProductLink | undefined {
  return LINKS[itemName];
}

/** Required wherever Amazon affiliate links appear. */
export const AFFILIATE_DISCLOSURE =
  "Product links may be affiliate links — as an Amazon Associate, Storage Network earns from qualifying purchases at no extra cost to you.";
