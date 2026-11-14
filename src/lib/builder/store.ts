// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — what is sold, and the marketplace's rules
//
// Two things are sold here:
//   • THE BUILDER: a subscription (BUILDER_SUBSCRIPTION). A subscriber can
//     save designs, generate plans for them (cut list, 3D guide, PDF),
//     share them and list them for sale. Without a subscription anyone can
//     still design; the design stays on their device.
//   • A PLAN from another builder's listing: a one-time purchase, open to
//     anyone, subscriber or not. The platform keeps PLATFORM_SHARE of each
//     sale and the rest is owed to the creator (recorded per sale in
//     builder_plan_purchases; paid out by the platform).
//
// Client-safe: no server imports.
// ═══════════════════════════════════════════════════════════════════════════

import { getStock } from "@/lib/builder/catalog";
import { boundsOf, type Scene } from "@/lib/builder/scene";

export const BUILDER_SUBSCRIPTION = {
  name: "Custom Storage Builder",
  /** In cents, per month */
  price: 4900,
  interval: "month",
  tagline: "Design any storage piece and get its full build plan.",
  includes: [
    "Unlimited saved designs, on any of your devices",
    "A build plan for every design: cut list, shopping list, 3D guide, PDF",
    "Share a design as a link, or list its plan for sale",
    "Cancel any time; your designs stay saved",
  ],
} as const;

/** The platform's share of a marketplace sale. */
export const PLATFORM_SHARE = 0.2;

/** What a creator may charge for a plan, in cents. */
export const LISTING_PRICE = { min: 100, max: 50000, suggested: 900 } as const;

export const DESIGN_LIMITS = {
  /** Saved designs per subscriber. High enough to be "unlimited" in practice. */
  maxDesigns: 500,
  maxDescription: 1200,
  /** Characters in a thumbnail data URL (about 220 KB of JPEG) */
  maxThumbnail: 300000,
} as const;

/** Split a sale between the platform and the creator. The creator gets every leftover cent. */
export function splitSale(amountCents: number): { platformFeeCents: number; creatorEarningsCents: number } {
  const platformFeeCents = Math.round(amountCents * PLATFORM_SHARE);
  return { platformFeeCents, creatorEarningsCents: amountCents - platformFeeCents };
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** A price typed by a creator ("9", "$12.50") as cents, or null if it isn't a valid listing price. */
export function parseListingPrice(text: string): number | null {
  const t = text.trim().replace(/^\$/, "");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return cents >= LISTING_PRICE.min && cents <= LISTING_PRICE.max ? cents : null;
}

/**
 * What a listing says about a design without handing over the design:
 * overall size and how much material is in it. Stored with the design so a
 * listing never needs the scene.
 */
export interface DesignStats {
  /** Overall size, inches */
  width: number;
  height: number;
  depth: number;
  pieceCount: number;
  /** Total length of 2×4 in the build, feet (rounded up) */
  lumberFeet: number;
  /** Plywood in the build, square feet (one decimal) */
  sheetSqFt: number;
  casters: number;
}

export function designStats(scene: Scene): DesignStats {
  const b = boundsOf(scene.pieces);
  let lumber = 0;
  let sheet = 0;
  let casters = 0;
  for (const piece of scene.pieces) {
    const stock = getStock(piece.stock);
    if (stock?.kind === "lumber") lumber += piece.length;
    else if (stock?.kind === "sheet") sheet += piece.length * piece.width;
    else if (stock?.look === "caster") casters += 1;
  }
  const round = (n: number) => Math.round(n * 16) / 16;
  return {
    width: b ? round(b.max[0] - b.min[0]) : 0,
    height: b ? round(b.max[1] - b.min[1]) : 0,
    depth: b ? round(b.max[2] - b.min[2]) : 0,
    pieceCount: scene.pieces.length,
    lumberFeet: Math.ceil(lumber / 12),
    sheetSqFt: Math.round((sheet / 144) * 10) / 10,
    casters,
  };
}

/** Read stats back from the database, tolerating anything missing. */
export function readDesignStats(raw: unknown): DesignStats {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = (key: string) => (Number.isFinite(Number(r[key])) ? Number(r[key]) : 0);
  return {
    width: n("width"),
    height: n("height"),
    depth: n("depth"),
    pieceCount: n("pieceCount"),
    lumberFeet: n("lumberFeet"),
    sheetSqFt: n("sheetSqFt"),
    casters: n("casters"),
  };
}

/** Where a subscriber's link lives on their device, so the builder knows them next visit. */
export const MEMBER_TOKEN_KEY = "sn_builder_member";

/** Where the builder keeps the work in progress on a device (see useBuilder) */
export const DRAFT_KEY = "sn_builder_draft_v1";
/** Which saved design the draft belongs to */
export const DESIGN_ID_KEY = "sn_builder_design_id";
/** Share slug of the design the draft was copied from, kept until its first save for attribution */
export const FORK_KEY = "sn_builder_fork";

export const builderHref = (token?: string | null) => (token ? `/plans/builder?token=${encodeURIComponent(token)}` : "/plans/builder");
export const sharedDesignHref = (slug: string) => `/plans/builder/d/${encodeURIComponent(slug)}`;
export const purchasedPlanHref = (token: string) => `/plans/builder/plan?token=${encodeURIComponent(token)}`;
export const MARKET_HREF = "/plans/builder/market";
