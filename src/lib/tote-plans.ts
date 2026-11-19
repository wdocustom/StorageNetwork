// ═══════════════════════════════════════════════════════════════════════════
// TOTE ORGANIZER PLANS — DIY plan products sold network-wide
//
// Since Nov 12, 2026 there is ONE product: All-Access Build Plans
// (TOTE_PLAN_ALL_ACCESS), $19 once, for life. The buyer designs any size,
// gets that plan, and can generate a plan for every other tote organizer
// they design afterwards at no charge ("Build another plan"). Every plan
// comes with the interactive 3D guide AND the printable PDF.
//
// Purchase rows still carry a tier: new purchases and included plans are
// recorded as "interactive", and every tote row opens with full access
// whatever its tier (past PDF-only buyers were upgraded to All-Access).
// TOTE_PLAN_TIERS below is kept for history: what the two old tiers were
// called and sold for, for analytics and referral payouts.
//
// A plan covers a DESIGN: one or more freestanding units (a bestseller such
// as Indiana Joe is three units). Each unit is split into self-contained
// MODULES exactly the way the build engine splits it for installers —
// ≤4 totes wide so plates fit an 8' board, ≤6 totes tall per stacked tier
// so uprights do. Identical modules are grouped into MODULE TYPES (A, B…)
// so the customer builds each type once and repeats it.
//
// Purchases are guest checkouts recorded in public_plan_purchases under
// plan_id = TOTE_PLAN_ID, so one email address can recover every plan it
// owns via /plans "Resend my link". Plans built free under All-Access are
// rows too, with included_from set to the paid purchase they came from.
//
// Client-safe: no server imports.
// ═══════════════════════════════════════════════════════════════════════════

import { BESTSELLER_PRESETS } from "@/lib/presets";
import { RAILS_2X4, RAILS_2X4_DEPTH, rails2x4Geometry, upright2x4 } from "@/components/visualizer/assemblySteps";
import { MAX_MODULE_COLS, MAX_MODULE_COLS_SIDEWAYS } from "@/lib/module-split";
import {
  MINI,
  MINI_TOTE_TYPE,
  miniDepth,
  miniFrameHeight,
  miniMaxModuleCols,
  miniMaxRowsPerTier,
  miniOpening,
  miniPlateLength,
} from "@/lib/mini-rack";

export const TOTE_PLAN_ID = "tote-organizer";

export type TotePlanTier = "pdf" | "interactive";

export interface TotePlanTierInfo {
  id: TotePlanTier;
  name: string;
  tagline: string;
  /** What the buyer pays, in cents — the list price minus any running sale. */
  price: number;
  /** Regular price in cents. Shown crossed out while a sale is on. */
  listPrice: number;
  includes: string[];
}

// ── All-Access (the product sold today) ─────────────────────────────────────

export const TOTE_PLAN_ALL_ACCESS = {
  name: "All-Access Build Plans",
  /** In cents. One payment, lifetime. */
  price: 1900,
  tagline: "Every tote organizer you design, for life.",
  includes: [
    "Unlimited plans: design any size, any time, and generate its plan free",
    "Interactive 3D build guide for every plan — rotate, zoom, step through",
    "Printable PDF for every plan: shopping list, cut diagrams, every step",
    "One payment, lifetime access. No subscription, no per-plan fees",
  ],
} as const;

/**
 * The retention ("exit") offer: "Wait — $3 off", shown once to designer
 * visitors who are leaving (closed the payment form, hesitated at the price,
 * came back from another app), and carried in "email me my design" links as
 * ?offer=save3. The server prices the checkout from the code, never from the
 * client. Never combined with a promo code (TOTE_PLAN_FRIDAY): a checkout
 * carries one offer.
 */
export const TOTE_PLAN_EXIT_OFFER = {
  code: "save3",
  /** In cents */
  price: 1600,
  /** How long the browser keeps the offer once shown */
  hours: 24,
} as const;

/**
 * Retired retention offers, still honored for links already sent (and
 * browsers that already hold one): code → price in cents. Until Nov 2026 the
 * offer was $5 off (save5).
 */
export const TOTE_PLAN_LEGACY_OFFERS: Readonly<Record<string, number>> = {
  save5: 1400,
};

/**
 * The last-chance offer: shown once, right after a visitor taps "No thanks"
 * on the $3-off offer. Same $16 price, plus Smart Inventory (normally $5)
 * included free: granted to the buyer's email when the purchase is
 * recorded. Like every retention offer it is never combined with a promo code.
 */
export const TOTE_PLAN_LAST_CHANCE = {
  code: "save3inv",
  /** In cents */
  price: 1600,
  /** Smart Inventory comes with the purchase */
  includesInventory: true,
} as const;

/**
 * Come-back offers, sent by email to people who emailed themselves a design
 * but never bought (design-lead-comeback): the price they were offered when
 * they saved it, plus the Ladder Building Jig plans free (granted to the
 * buyer's email when the purchase is recorded). code → price in cents.
 * Like every retention offer, never combined with a promo code.
 */
export const TOTE_PLAN_COMEBACK_OFFERS: Readonly<Record<string, number>> = {
  save5jig: 1400,
  save3jig: 1600,
};

/** The come-back offer for a design lead, from the offer they saved it with. */
export function comebackOfferFor(savedOffer: string | null | undefined): string {
  return totePlanOfferPrice(savedOffer) <= TOTE_PLAN_COMEBACK_OFFERS.save5jig ? "save5jig" : "save3jig";
}

/** Does this offer code include the Ladder Building Jig plans free? */
export function offerIncludesLadderJig(code: unknown): boolean {
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(TOTE_PLAN_COMEBACK_OFFERS, code);
}

/** A retention offer code we still honor (current, last-chance, come-back or legacy). */
export function isRetentionOffer(code: unknown): code is string {
  return (
    typeof code === "string" &&
    (code === TOTE_PLAN_EXIT_OFFER.code ||
      code === TOTE_PLAN_LAST_CHANCE.code ||
      offerIncludesLadderJig(code) ||
      Object.prototype.hasOwnProperty.call(TOTE_PLAN_LEGACY_OFFERS, code))
  );
}

/** Does this offer code include Smart Inventory free? */
export function offerIncludesInventory(code: unknown): boolean {
  return code === TOTE_PLAN_LAST_CHANCE.code;
}

/**
 * Black Friday promo code: $5 off All-Access, once per customer email, no
 * end date. Typed in by the buyer (any case); the server checks the email
 * hasn't used it and locks that email at Stripe checkout. Not combinable
 * with the retention offer, and not valid on gifts (they have volume pricing).
 */
export const TOTE_PLAN_FRIDAY = {
  /** As stored and sent (lowercase); buyers may type "Friday", "FRIDAY"… */
  code: "friday",
  /** As shown */
  display: "FRIDAY",
  label: "Black Friday",
  /** In cents */
  price: 1400,
  /** Uses per customer email */
  perEmail: 1,
} as const;

/** "Friday " → "friday"; anything unusable → "". */
export function normalizePromoCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 40) : "";
}

/**
 * Price in cents for a retention offer code (unknown codes pay the regular
 * price). Promo codes like FRIDAY are priced only after the server checks the
 * buyer's email: see diy-plan-checkout.
 */
export function totePlanOfferPrice(code: unknown): number {
  if (code === TOTE_PLAN_EXIT_OFFER.code) return TOTE_PLAN_EXIT_OFFER.price;
  if (code === TOTE_PLAN_LAST_CHANCE.code) return TOTE_PLAN_LAST_CHANCE.price;
  if (offerIncludesLadderJig(code)) return TOTE_PLAN_COMEBACK_OFFERS[code as string];
  if (typeof code === "string" && Object.prototype.hasOwnProperty.call(TOTE_PLAN_LEGACY_OFFERS, code)) return TOTE_PLAN_LEGACY_OFFERS[code];
  return TOTE_PLAN_ALL_ACCESS.price;
}

/** "$3 off" for an offer price. */
export function offerOffLabel(priceCents: number): string {
  return `${formatPlanPrice(TOTE_PLAN_ALL_ACCESS.price - priceCents)} off`;
}

/** Tier recorded on All-Access purchases and included plans: full access. */
export const TOTE_PLAN_ALL_ACCESS_TIER: TotePlanTier = "interactive";

/** When All-Access replaced the two tiers (ISO date). Analytics prices purchases from here at $19. */
export const TOTE_PLAN_ALL_ACCESS_SINCE = "2026-11-12";

// ── Old tiers (history) ─────────────────────────────────────────────────────
// Sold until TOTE_PLAN_ALL_ACCESS_SINCE. Kept so analytics and referral
// payouts can name and price past purchases; nothing is sold at these
// prices any more.

// ── Sale ────────────────────────────────────────────────────────────────────
// Storewide discount on both tote-plan tiers, applied automatically: every
// checkout, upgrade quote, price label, email and structured-data offer reads
// `price`, which already has it taken off. While it's on, prices render as
// "~~$19~~ $14" with a "$5 off" tag. Set TOTE_PLAN_SALE_CENTS to 0 to end
// the sale — everything reverts to list price with no other change.
// The PDF→interactive upgrade stays the same ($10) because both tiers drop
// by the same amount.
export const TOTE_PLAN_SALE_CENTS = 500;

/**
 * When the current sale started (ISO date). Purchase rows don't store the
 * amount paid, so plans analytics prices anything bought before this at
 * list price and anything after at the sale price. Update it whenever the
 * sale amount changes.
 */
export const TOTE_PLAN_SALE_SINCE = "2026-11-07";

/** What a tote-plan tier sold for at `purchasedAt` (ISO timestamp). */
export function totePlanPricePaid(tier: TotePlanTier, purchasedAt: string): number {
  if (purchasedAt >= TOTE_PLAN_ALL_ACCESS_SINCE) return TOTE_PLAN_ALL_ACCESS.price;
  const info = TOTE_PLAN_TIERS[tier];
  return TOTE_PLAN_SALE_ON && purchasedAt >= TOTE_PLAN_SALE_SINCE ? info.price : info.listPrice;
}

/** True while a tote-plan sale is running. */
export const TOTE_PLAN_SALE_ON = TOTE_PLAN_SALE_CENTS > 0;

/** Short tag shown next to sale prices, e.g. "$5 OFF". */
export const TOTE_PLAN_SALE_TAG = `$${TOTE_PLAN_SALE_CENTS / 100} OFF`;

const salePrice = (listPrice: number) => Math.max(0, listPrice - TOTE_PLAN_SALE_CENTS);

export const TOTE_PLAN_TIERS: Record<TotePlanTier, TotePlanTierInfo> = {
  pdf: {
    id: "pdf",
    name: "PDF Build Plan",
    tagline: "Print it, take it to the garage.",
    listPrice: 1900,
    price: salePrice(1900),
    includes: [
      "Every assembly step rendered in 3D for your exact build",
      "Shopping list with exact quantities",
      "Board-by-board cut diagrams, including the 2×4 rail rips",
      "Tools checklist, fastener callouts, and pro tips",
    ],
  },
  interactive: {
    id: "interactive",
    name: "Interactive Build Guide",
    tagline: "The same 3D guide our pro installers build from.",
    listPrice: 2900,
    price: salePrice(2900),
    includes: [
      "Everything in the PDF Build Plan",
      "Interactive 3D assembly guide — rotate, zoom, step through",
      "Builds one module at a time with a live map of your system",
      "Works on your phone in the garage, lifetime access",
    ],
  },
};

/** What the old PDF → interactive upgrade cost (history; no longer sold). */
export const TOTE_PLAN_UPGRADE_PRICE =
  TOTE_PLAN_TIERS.interactive.price - TOTE_PLAN_TIERS.pdf.price;

// ── Mini Tote Rack Plans (separate product, since Nov 2026) ─────────────────
// Same lifetime model as All-Access, for MINI designs only: this mini plan
// and every mini size the buyer designs after it. Owners of the 27-gal
// All-Access plans pay the owner price (checked server-side from their plan
// link, like the ladder jig). Purchases: plan_id = TOTE_PLAN_MINI.id.

export const TOTE_PLAN_MINI = {
  id: "mini-tote-rack",
  name: "Mini Tote Rack Plans",
  /** In cents. One payment, lifetime. */
  price: 1200,
  /** In cents, for 27-gal All-Access owners */
  ownerPrice: 900,
  tagline: "Every mini tote rack you design, for life.",
  includes: [
    "Unlimited mini plans: any size, any time, generated free",
    "Interactive 3D build guide for every plan",
    "Printable PDF: shopping list, cut diagrams, every step",
    "Sized for HDX 6.5 qt totes · 2×3 frame · plywood rails",
  ],
} as const;

/** The product a design belongs to: mini designs are TOTE_PLAN_MINI, the rest All-Access. */
export function planIdForDesign(design: Pick<TotePlanDesign, "units">): string {
  return isMiniDesign(design) ? TOTE_PLAN_MINI.id : TOTE_PLAN_ID;
}

/** A tote plan purchase row of either product. */
export function isTotePlanProduct(planId: unknown): boolean {
  return planId === TOTE_PLAN_ID || planId === TOTE_PLAN_MINI.id;
}

export function formatPlanPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function isTotePlanTier(value: unknown): value is TotePlanTier {
  return value === "pdf" || value === "interactive";
}

// ═══════════════════════════════════════════════════════════════════════════
// Design model
// ═══════════════════════════════════════════════════════════════════════════

/** "MINI" = the Mini Tote Rack (HDX 6.5 qt totes, 2×3 frame) — a separate product, see TOTE_PLAN_MINI. */
export type TotePlanToteType = "HDX" | "GM" | typeof MINI_TOTE_TYPE;

/** Mini Tote Rack unit (6.5 qt totes)? */
export function isMiniUnit(unit: Pick<TotePlanUnit, "toteType">): boolean {
  return unit.toteType === MINI_TOTE_TYPE;
}

/** A design is all mini or all 27-gal (parseTotePlanDesign enforces it). */
export function isMiniDesign(design: Pick<TotePlanDesign, "units">): boolean {
  return design.units.length > 0 && design.units.every(isMiniUnit);
}

/** One freestanding tote organizer, any size the designer allows. */
export interface TotePlanUnit {
  cols: number;
  rows: number;
  toteType: TotePlanToteType;
  hasWheels: boolean;
  hasTop: boolean;
  /**
   * Totes turned 90°, long side facing out: 30-1/4" bays, 20" deep. For
   * shallow walls. Omitted (not false) on standard units, so old designs
   * and their encodings are unchanged.
   */
  sideways?: boolean;
  /** Bestseller preset id when this unit is part of one (see normalizeBestsellers) */
  bestseller?: string;
}

export interface TotePlanDesign {
  units: TotePlanUnit[];
  /** Optional display name, e.g. a bestseller ("Indiana Joe") */
  name?: string;
}

export const TOTE_PLAN_LIMITS = {
  minCols: 1,
  maxCols: 24,
  minRows: 1,
  maxRows: 10, // the designer's own standard-unit maximum
  /** Mini racks: 14 totes tall is one 8' upright */
  maxRowsMini: miniMaxRowsPerTier(),
  maxUnits: 8,
};

/** Build-engine split points (must match buildEngine.ts): plates fit an
 *  8' board up to 4 wide; a 2×4-rail upright is a full 8' stud at 6 high. */
export const MODULE_MAX_COLS = MAX_MODULE_COLS;
/** Sideways bays are 30-1/4": 2 wide is a 65" plate, 3 wide (96-3/4")
 *  would no longer come out of an 8' board. */
export const MODULE_MAX_COLS_SIDEWAYS = MAX_MODULE_COLS_SIDEWAYS;
export const MODULE_MAX_ROWS = RAILS_2X4.maxRows;

const MAX_NAME_LENGTH = 40;

function cleanName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const name = raw.replace(/[^\p{L}\p{N} '&.\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  return name || undefined;
}

/** Validate one untrusted unit. Mini and 2×4-rail installer units aren't modeled. */
export function parseTotePlanUnit(raw: unknown): TotePlanUnit | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;

  if (c.unitType !== undefined && c.unitType !== "standard") return null;
  if (c.orientation !== undefined && c.orientation !== "standard" && c.orientation !== "sideways") return null;
  if (c.use2x4Rails === true) return null;

  const cols = Number(c.cols);
  const rows = Number(c.rows);
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) return null;
  if (cols < TOTE_PLAN_LIMITS.minCols || cols > TOTE_PLAN_LIMITS.maxCols) return null;
  if (c.toteType !== "HDX" && c.toteType !== "GM" && c.toteType !== MINI_TOTE_TYPE) return null;
  const mini = c.toteType === MINI_TOTE_TYPE;
  if (rows < TOTE_PLAN_LIMITS.minRows || rows > (mini ? TOTE_PLAN_LIMITS.maxRowsMini : TOTE_PLAN_LIMITS.maxRows)) return null;

  const unit: TotePlanUnit = {
    cols,
    rows,
    toteType: c.toteType,
    // Mini racks don't roll: a 2×3 plate is narrower than a caster plate.
    hasWheels: !mini && c.hasWheels === true,
    hasTop: c.hasTop === true,
  };
  if (c.sideways === true || c.orientation === "sideways") unit.sideways = true;
  if (!mini && typeof c.bestseller === "string" && c.bestseller in BESTSELLER_CODES) unit.bestseller = c.bestseller;
  return unit;
}

// ── Bestseller membership ────────────────────────────────────────────────
// A unit remembers which bestseller it came from so a plan built from, say,
// Indiana Joe + Rack City Roller knows both are in it. A bestseller counts
// only while its units are consecutive and still the preset's sizes (cols ×
// rows, in order); tote brand, casters and worktop may change. Anything else
// loses the tag — that's how "change its size and it's yours" works.

/** Preset id → short code for the compact design string. */
export const BESTSELLER_CODES: Record<string, string> = {
  "indiana-joe": "ij",
  "long-ranger": "lr",
  "gas-station": "gs",
  "track-norris": "tn",
  "rack-city-roller": "rcr",
  "mayor-of-rack-city": "mrc",
};
const BESTSELLER_BY_CODE = Object.fromEntries(Object.entries(BESTSELLER_CODES).map(([id, code]) => [code, id]));

export interface BestsellerInstance {
  presetId: string;
  /** Index of its first unit */
  start: number;
  count: number;
}

/** Valid bestseller runs in a unit list (see the section note). */
export function bestsellerInstances(units: TotePlanUnit[]): BestsellerInstance[] {
  const out: BestsellerInstance[] = [];
  let i = 0;
  while (i < units.length) {
    const id = units[i].bestseller;
    const preset = id ? BESTSELLER_PRESETS.find((p) => p.id === id) : undefined;
    const n = preset?.units.length ?? 0;
    const matches =
      !!preset &&
      i + n <= units.length &&
      preset.units.every((pu, k) => {
        const u = units[i + k];
        return u.bestseller === id && u.cols === pu.cols && u.rows === pu.rows && !u.sideways;
      });
    if (matches) {
      out.push({ presetId: id!, start: i, count: n });
      i += n;
    } else {
      i += 1;
    }
  }
  return out;
}

/** Drops every bestseller tag that isn't part of a valid run. */
export function normalizeBestsellers(units: TotePlanUnit[]): TotePlanUnit[] {
  const keep = new Set<number>();
  for (const inst of bestsellerInstances(units)) for (let k = 0; k < inst.count; k++) keep.add(inst.start + k);
  return units.map((u, i) => {
    if (!u.bestseller || keep.has(i)) return u;
    const { bestseller: _dropped, ...rest } = u;
    return rest;
  });
}

/** Preset id for a bestseller name ("Indiana Joe"), if it is one. */
export function bestsellerIdForName(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const lower = name.trim().toLowerCase();
  return BESTSELLER_PRESETS.find((p) => p.name.toLowerCase() === lower)?.id;
}

/**
 * Validate an untrusted design. Accepts {units:[…], name?}, a single legacy
 * unit config ({cols, rows, toteType…} — purchases made before multi-unit
 * plans), or the compact string form. Returns null if ANY unit is invalid.
 */
export function parseTotePlanDesign(raw: unknown): TotePlanDesign | null {
  if (typeof raw === "string") return decodeTotePlanDesign(raw);
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;

  const rawUnits = Array.isArray(c.units) ? c.units : "cols" in c ? [c] : null;
  if (!rawUnits || rawUnits.length === 0 || rawUnits.length > TOTE_PLAN_LIMITS.maxUnits) return null;

  const units: TotePlanUnit[] = [];
  for (const u of rawUnits) {
    const unit = parseTotePlanUnit(u);
    if (!unit) return null;
    units.push(unit);
  }
  // Mini and 27-gal racks are separate products: a design is one or the other.
  if (units.some(isMiniUnit) && !units.every(isMiniUnit)) return null;
  const name = cleanName(c.name);
  const normalized = normalizeBestsellers(units);
  return name ? { units: normalized, name } : { units: normalized };
}

// ── Compact string form (URLs, Stripe metadata) ──────────────────────────
// Unit token: <H|G|M><cols>x<rows>[w][t][s][_<bestseller code>]
//             e.g. "H4x4wt", "G2x6", "H2x4t_ij", "H3x4wts" (s = sideways),
//             "M4x4t" (Mini Tote Rack)
// Design:     tokens joined by "."      e.g. "H2x4t_ij.H2x2t_ij.H2x4t_ij"

const UNIT_TOKEN = /^([HGM])(\d{1,2})x(\d{1,2})(w?)(t?)(s?)(?:_([a-z]{2,3}))?$/;
const TOTE_LETTER: Record<TotePlanToteType, string> = { HDX: "H", GM: "G", MINI: "M" };
const TOTE_BY_LETTER: Record<string, TotePlanToteType> = { H: "HDX", G: "GM", M: MINI_TOTE_TYPE };

export function encodeTotePlanDesign(design: TotePlanDesign): string {
  return design.units
    .map(
      (u) =>
        `${TOTE_LETTER[u.toteType]}${u.cols}x${u.rows}${u.hasWheels ? "w" : ""}${u.hasTop ? "t" : ""}${u.sideways ? "s" : ""}` +
        (u.bestseller && BESTSELLER_CODES[u.bestseller] ? `_${BESTSELLER_CODES[u.bestseller]}` : ""),
    )
    .join(".");
}

export function decodeTotePlanDesign(value: string | null | undefined, name?: string | null): TotePlanDesign | null {
  if (!value) return null;
  const tokens = value.trim().split(".");
  if (tokens.length === 0 || tokens.length > TOTE_PLAN_LIMITS.maxUnits) return null;
  const units: unknown[] = [];
  for (const token of tokens) {
    const m = UNIT_TOKEN.exec(token);
    if (!m) return null;
    units.push({
      toteType: TOTE_BY_LETTER[m[1]],
      cols: Number(m[2]),
      rows: Number(m[3]),
      hasWheels: m[4] === "w",
      hasTop: m[5] === "t",
      ...(m[6] === "s" ? { sideways: true } : {}),
      ...(m[7] && BESTSELLER_BY_CODE[m[7]] ? { bestseller: BESTSELLER_BY_CODE[m[7]] } : {}),
    });
  }
  return parseTotePlanDesign({ units, name: name ?? undefined });
}

/**
 * Relative link to the plans designer pre-filled with a design. `ref` is
 * the installer whose link the customer came through (designer, quote page,
 * quote email) — they get the plan-sale split (see plan-splits.ts).
 */
export function totePlanDesignHref(design: TotePlanDesign, source?: string, ref?: string | null): string {
  const params = new URLSearchParams({ design: encodeTotePlanDesign(design) });
  if (design.name) params.set("name", design.name);
  if (source) params.set("utm_source", source);
  if (ref) params.set("ref", ref);
  return `/plans/checkout?${params.toString()}`;
}

/** Reads ?design=&name= (current) or ?config= (legacy single-unit JSON). */
export function designFromSearchParams(params: { get(key: string): string | null }): TotePlanDesign | null {
  const compact = decodeTotePlanDesign(params.get("design"), params.get("name"));
  if (compact) return compact;
  const legacy = params.get("config");
  if (!legacy) return null;
  for (const candidate of [legacy, safeDecode(legacy)]) {
    if (!candidate) continue;
    try {
      return parseTotePlanDesign(JSON.parse(candidate));
    } catch {
      // try the next form
    }
  }
  return null;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Geometry — DIY plans are built with 2×4 RAILS (the plans standard).
// Same numbers as the build engine / Rack3D in 2×4-rail mode.
// ═══════════════════════════════════════════════════════════════════════════

/** Universal 21" bay between uprights — fits HDX and Greenmade 27-gal totes */
export const BAY_OPENING_IN = RAILS_2X4.opening;
/** Sideways bay: the tote's 30-1/4" length spans it */
export const BAY_OPENING_SIDEWAYS_IN = rails2x4Geometry(true).opening;
export const POST_IN = 1.5;
/** Bottom plate + top plate, 1-1/2" each */
export const PLATES_H_IN = 3;
export const CASTER_IN = 2.75;
export const UNIT_DEPTH_IN = RAILS_2X4_DEPTH;
/** Sideways racks are shallower: 20" rails */
export const UNIT_DEPTH_SIDEWAYS_IN = rails2x4Geometry(true).depth;

// Every geometry helper takes `mini` last: Mini Tote Racks (@/lib/mini-rack)
// have 8-1/4" bays (13" sideways), 12-3/4" depth (8" sideways), 2×3 frames,
// and modules up to 9 wide (6 sideways) × 14 tall.

/** Bay opening for a unit, standard or sideways. */
export function bayOpeningIn(sideways?: boolean, mini = false): number {
  if (mini) return miniOpening(sideways === true);
  return sideways ? BAY_OPENING_SIDEWAYS_IN : BAY_OPENING_IN;
}

/** Rack depth (= rail length) for a unit, standard or sideways. */
export function unitDepthIn(sideways?: boolean, mini = false): number {
  if (mini) return miniDepth(sideways === true);
  return sideways ? UNIT_DEPTH_SIDEWAYS_IN : UNIT_DEPTH_IN;
}

/** Most totes across one module. */
export function moduleMaxCols(sideways = false, mini = false): number {
  if (mini) return miniMaxModuleCols(sideways);
  return sideways ? MODULE_MAX_COLS_SIDEWAYS : MODULE_MAX_COLS;
}

/** Most totes tall in one tier. */
export function moduleMaxRows(mini = false): number {
  return mini ? miniMaxRowsPerTier() : MODULE_MAX_ROWS;
}

/** Width split: greedy 4s (2s sideways), remainder last — identical to buildEngine for standard. */
export function splitWidth(cols: number, sideways = false, mini = false): number[] {
  const max = moduleMaxCols(sideways, mini);
  const mods: number[] = [];
  let remaining = cols;
  while (remaining > max) {
    mods.push(max);
    remaining -= max;
  }
  if (remaining > 0) mods.push(remaining);
  return mods;
}

/** Height split: 6-row tiers (14 for mini), remainder on top — identical to buildEngine. */
export function splitHeight(rows: number, mini = false): number[] {
  const tiers: number[] = [];
  const max = moduleMaxRows(mini);
  let remaining = rows;
  while (remaining > max) {
    tiers.push(max);
    remaining -= max;
  }
  if (remaining > 0) tiers.push(remaining);
  return tiers;
}

/** Outside width of one module. Tote brand doesn't matter: the 21" bay fits both. */
export function moduleWidthIn(cols: number, sideways = false, mini = false): number {
  if (mini) return miniPlateLength(cols, sideways);
  return cols * bayOpeningIn(sideways) + (cols + 1) * POST_IN;
}

/** Frame height of one module (plates + upright), without casters. */
export function moduleFrameHeightIn(rows: number, mini = false): number {
  if (mini) return miniFrameHeight(rows);
  return PLATES_H_IN + upright2x4(rows);
}

export function unitOuterSize(unit: TotePlanUnit): { widthIn: number; heightIn: number; depthIn: number } {
  const mini = isMiniUnit(unit);
  return {
    widthIn: splitWidth(unit.cols, unit.sideways, mini).reduce((s, c) => s + moduleWidthIn(c, unit.sideways, mini), 0),
    heightIn:
      splitHeight(unit.rows, mini).reduce((s, r) => s + moduleFrameHeightIn(r, mini), 0) + (unit.hasWheels ? CASTER_IN : 0),
    depthIn: unitDepthIn(unit.sideways, mini),
  };
}

// ── Casters ──────────────────────────────────────────────────────────────
// Up to 4 wide (one module, under 8') rolls on 4 casters at the corners.
// Over 8' rolls on 6, and every further 48" of length adds a pair. Each
// pair (front + back) sits under an upright, as close to even spacing as
// the 22-1/2" upright pitch allows.

const CASTER_BASE_LENGTH_IN = 96;
const CASTER_EXTRA_PAIR_EVERY_IN = 48;

/** Upright centerlines across a unit, inches from its left end (seams have two). */
export function unitUprightXs(unit: Pick<TotePlanUnit, "cols" | "sideways"> & Partial<Pick<TotePlanUnit, "toteType">>): number[] {
  const mini = unit.toteType === MINI_TOTE_TYPE;
  const xs: number[] = [];
  let offset = 0;
  for (const cols of splitWidth(unit.cols, unit.sideways, mini)) {
    for (let i = 0; i <= cols; i++) xs.push(offset + POST_IN / 2 + i * (bayOpeningIn(unit.sideways, mini) + POST_IN));
    offset += moduleWidthIn(cols, unit.sideways, mini);
  }
  return xs;
}

/** Number of caster PAIRS (front + back) a rolling unit gets. */
export function casterPairCount(unit: Pick<TotePlanUnit, "cols" | "sideways">): number {
  const width = unitOuterSize({ cols: unit.cols, rows: 1, toteType: "HDX", hasWheels: false, hasTop: false, sideways: unit.sideways }).widthIn;
  if (width <= CASTER_BASE_LENGTH_IN) return 2;
  return 2 + Math.ceil((width - CASTER_BASE_LENGTH_IN) / CASTER_EXTRA_PAIR_EVERY_IN);
}

/**
 * Where each caster pair goes: the upright centerline (inches from the
 * unit's left end) nearest to evenly spaced targets, ends always included.
 * Empty for units without casters.
 */
export function casterPositions(unit: TotePlanUnit): number[] {
  if (!unit.hasWheels || isMiniUnit(unit)) return [];
  const xs = unitUprightXs(unit);
  const first = xs[0];
  const last = xs[xs.length - 1];
  const pairs = casterPairCount(unit);
  const picked: number[] = [];
  for (let p = 0; p < pairs; p++) {
    const target = first + ((last - first) * p) / (pairs - 1);
    const candidates = xs.filter((x) => !picked.includes(x));
    const nearest = candidates.reduce((best, x) => (Math.abs(x - target) < Math.abs(best - target) ? x : best), candidates[0]);
    picked.push(nearest);
  }
  return picked.sort((a, b) => a - b);
}

/** Units stand side by side: total width, tallest unit. */
export function designOuterSize(design: TotePlanDesign): { widthIn: number; heightIn: number; depthIn: number } {
  const sizes = design.units.map(unitOuterSize);
  return {
    widthIn: sizes.reduce((s, u) => s + u.widthIn, 0),
    heightIn: Math.max(...sizes.map((u) => u.heightIn)),
    depthIn: Math.max(...sizes.map((u) => u.depthIn)),
  };
}

/**
 * Largest single unit (within plan limits) that fits a wall opening.
 * Accounts for the extra upright at every module seam and the plates of
 * every stacked tier. Returns null when not even a 1×1 fits.
 */
export function fitTotePlanToWall(
  wallWidthIn: number,
  wallHeightIn: number,
  options: Pick<TotePlanUnit, "toteType" | "hasWheels" | "sideways">,
): { cols: number; rows: number } | null {
  if (!(wallWidthIn > 0) || !(wallHeightIn > 0)) return null;
  const base = { ...options, hasTop: false };
  let cols = 0;
  while (cols < TOTE_PLAN_LIMITS.maxCols && unitOuterSize({ ...base, cols: cols + 1, rows: 1 }).widthIn <= wallWidthIn) cols++;
  let rows = 0;
  const maxRows = options.toteType === MINI_TOTE_TYPE ? TOTE_PLAN_LIMITS.maxRowsMini : TOTE_PLAN_LIMITS.maxRows;
  while (rows < maxRows && unitOuterSize({ ...base, cols: 1, rows: rows + 1 }).heightIn <= wallHeightIn) rows++;
  if (cols < 1 || rows < 1) return null;
  return { cols, rows };
}

// ═══════════════════════════════════════════════════════════════════════════
// Modules and module types
// ═══════════════════════════════════════════════════════════════════════════

// Naming: units are lettered A, B, C… left to right. A unit built from
// several modules numbers them in build order (bottom tier first, left to
// right): A1, A2… A one-module unit is just its letter. Identical modules
// still share a TYPE (internal letter, used for snapshots and grouping) so
// the customer builds each type once and repeats it; people see the type
// by the module names it covers, e.g. "A1–A3, C1".

/** Unit letter for a unit index: 0 → "A". */
export function unitLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** "A1","A2","A3","C1" → "A1–A3, C1" (consecutive numbers collapse). */
export function formatModuleNames(names: string[]): string {
  const parsed = names.map((n) => {
    const m = /^([A-Z])(\d*)$/.exec(n);
    return m ? { unit: m[1], num: m[2] ? Number(m[2]) : null } : { unit: n, num: null };
  });
  const out: string[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const start = parsed[i];
    if (start.num === null) {
      out.push(start.unit);
      continue;
    }
    let end = i;
    while (
      end + 1 < parsed.length &&
      parsed[end + 1].unit === start.unit &&
      parsed[end + 1].num === (parsed[end].num as number) + 1
    ) {
      end++;
    }
    out.push(end > i + 1 ? `${start.unit}${start.num}–${start.unit}${parsed[end].num}` : `${start.unit}${start.num}`);
    if (end === i + 1) out.push(`${start.unit}${parsed[end].num}`);
    i = end;
  }
  return out.join(", ");
}

export interface PlanModule {
  /** Build-engine key: "<unitIdx>-<widthModIndex>-<heightTierIndex>" */
  key: string;
  /** What people see: "A" for a one-module unit, else "A1", "A2"… */
  name: string;
  unitIndex: number;
  widthIndex: number;
  widthCount: number;
  tierIndex: number;
  tierCount: number;
  cols: number;
  rows: number;
  toteType: TotePlanToteType;
  /** Totes turned 90° (see TotePlanUnit.sideways) */
  sideways: boolean;
  /** True when this module gets its casters in its own steps (one-module-wide rolling units) */
  hasWheels: boolean;
  /** Worktop is part of the module build only when the module IS the unit */
  hasTop: boolean;
  /** Internal type letter, shared by identical modules (see "Naming" above) */
  type: string;
}

export interface PlanModuleType {
  letter: string;
  cols: number;
  rows: number;
  toteType: TotePlanToteType;
  sideways: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  /** How many of this module the design needs */
  count: number;
  /** Names of every module of this type, in build order */
  moduleNames: string[];
  /** Display label, e.g. "A1–A3, C1" */
  label: string;
}

/** "Module B" / "Modules A, C" / "Modules A1–A3" */
export function moduleTypeTitle(t: Pick<PlanModuleType, "moduleNames" | "label">): string {
  return `${t.moduleNames.length > 1 ? "Modules" : "Module"} ${t.label}`;
}

export interface DesignModules {
  modules: PlanModule[];
  types: PlanModuleType[];
}

const typeKey = (m: Pick<PlanModule, "cols" | "rows" | "toteType" | "sideways" | "hasWheels" | "hasTop">) =>
  `${m.toteType}:${m.cols}x${m.rows}:${m.hasWheels ? "w" : ""}${m.hasTop ? "t" : ""}${m.sideways ? "s" : ""}`;

/** Break a design into modules (build order) and group identical ones. */
export function designModules(design: TotePlanDesign): DesignModules {
  const modules: PlanModule[] = [];
  const types: PlanModuleType[] = [];
  const letterByKey = new Map<string, string>();

  design.units.forEach((unit, unitIndex) => {
    const mini = isMiniUnit(unit);
    const widths = splitWidth(unit.cols, unit.sideways, mini);
    const tiers = splitHeight(unit.rows, mini);
    const single = widths.length === 1 && tiers.length === 1;
    const letter = unitLetter(unitIndex);
    let moduleNumber = 0;
    // Build order matches the engine: bottom tier first, left to right.
    tiers.forEach((rows, tierIndex) => {
      widths.forEach((cols, widthIndex) => {
        const spec = {
          cols,
          rows,
          toteType: unit.toteType,
          sideways: unit.sideways === true,
          // A one-module-wide unit gets its 4 casters while its bottom module
          // is laid down; wider units get theirs after the modules are joined.
          hasWheels: unit.hasWheels && tierIndex === 0 && widths.length === 1,
          hasTop: unit.hasTop && single,
        };
        const k = typeKey(spec);
        let typeLetter = letterByKey.get(k);
        if (!typeLetter) {
          typeLetter = String.fromCharCode(65 + types.length);
          letterByKey.set(k, typeLetter);
          types.push({ letter: typeLetter, ...spec, count: 0, moduleNames: [], label: "" });
        }
        const name = single ? letter : `${letter}${++moduleNumber}`;
        const type = types.find((t) => t.letter === typeLetter)!;
        type.count += 1;
        type.moduleNames.push(name);
        modules.push({
          key: `${unitIndex}-${widthIndex}-${tierIndex}`,
          name,
          unitIndex,
          widthIndex,
          widthCount: widths.length,
          tierIndex,
          tierCount: tiers.length,
          ...spec,
          type: typeLetter,
        });
      });
    });
  });

  for (const t of types) t.label = formatModuleNames(t.moduleNames);
  return { modules, types };
}

// ═══════════════════════════════════════════════════════════════════════════
// Naming
// ═══════════════════════════════════════════════════════════════════════════

export function totePlanUnitLabel(unit: TotePlanUnit): string {
  return `${unit.cols}×${unit.rows}${unit.sideways ? " sideways" : ""}`;
}

export function totePlanName(design: TotePlanDesign): string {
  if (design.name) return design.name;
  const product = isMiniDesign(design) ? MINI.name : "Tote Organizer";
  if (design.units.length === 1) {
    const u = design.units[0];
    return `${u.cols}×${u.rows}${u.sideways ? " Sideways" : ""} ${product}`;
  }
  return `${design.units.length}-Unit ${product} System`;
}

export function totePlanSummary(design: TotePlanDesign): string {
  const totes = design.units.reduce((s, u) => s + u.cols * u.rows, 0);
  const brands = new Set(design.units.map((u) => u.toteType));
  const parts: string[] = [
    design.units.length > 1
      ? `${design.units.map(totePlanUnitLabel).join(" + ")} · ${totes} totes`
      : `${totes} totes`,
    // One universal 21" bay fits HDX, Greenmade and most other 27-gallon totes
    brands.has(MINI_TOTE_TYPE) ? `${MINI.tote.name} totes` : "27-gallon totes",
  ];
  if (design.units.length === 1 && design.units[0].sideways) {
    parts.push(`sideways (${unitDepthIn(true, isMiniUnit(design.units[0]))}" deep)`);
  }
  if (design.units.some((u) => u.hasWheels)) parts.push("casters");
  if (design.units.some((u) => u.hasTop)) parts.push("plywood worktop");
  return parts.join(" · ");
}

export const DEFAULT_TOTE_PLAN_UNIT: TotePlanUnit = {
  cols: 4,
  rows: 4,
  toteType: "HDX",
  hasWheels: true,
  hasTop: true,
};

export const DEFAULT_TOTE_PLAN_DESIGN: TotePlanDesign = { units: [DEFAULT_TOTE_PLAN_UNIT] };

// ═══════════════════════════════════════════════════════════════════════════
// Translating designer / quote items into a plan design
// ═══════════════════════════════════════════════════════════════════════════

/** The subset of a designer cart item / saved quote unit we can read. */
export interface PlanSourceItem {
  cols?: number;
  rows?: number;
  toteType?: string;
  unitType?: string;
  orientation?: string;
  hasWheels?: boolean;
  hasTop?: boolean;
  use2x4Rails?: boolean;
  quantity?: number;
  shelvingConfigId?: string | null;
  overheadStorageConfig?: unknown;
  overheadGridPresetId?: string | null;
  raisedBedConfig?: unknown;
  chairConfig?: unknown;
  chairId?: string | null;
  presetUnits?: Array<{ cols: number; rows: number; hasTop: boolean; hasWheels: boolean }> | null;
  desc?: string;
}

/**
 * Name of a bestseller collapsed into one quote line by the installer
 * dashboard — "Indiana Joe (2×4 + 2×2 + 2×4 — 20 slots, Totes, Top)" —
 * or null for any other description.
 */
export function collapsedPresetName(desc: string | undefined): string | null {
  if (!desc) return null;
  const m = /^(.+?) \((\d+\s*[×x]\s*\d+(?:\s*\+\s*\d+\s*[×x]\s*\d+)*)\s+—\s+\d+ slots/.exec(desc);
  return m ? m[1].trim() : null;
}

export interface PlanTranslation {
  design: TotePlanDesign | null;
  /** Items that became plan units */
  covered: number;
  /** Items we can't produce plans for (shelving, chairs, mini, sideways…) */
  skipped: number;
}

/**
 * Turn designer cart items / saved quote units into a plan design.
 * Bestsellers break out into their sub-units; quantity repeats a unit.
 * Non-tote items are skipped (and counted) rather than failing the design.
 */
export function designFromItems(items: PlanSourceItem[], name?: string): PlanTranslation {
  const units: TotePlanUnit[] = [];
  let covered = 0;
  let skipped = 0;

  for (const item of items) {
    const isOtherProduct =
      !!item.shelvingConfigId ||
      !!item.overheadStorageConfig ||
      !!item.overheadGridPresetId ||
      !!item.raisedBedConfig ||
      !!item.chairConfig ||
      !!item.chairId;
    if (isOtherProduct) {
      skipped++;
      continue;
    }

    const base = {
      toteType: item.toteType,
      unitType: item.unitType,
      orientation: item.orientation,
    };
    let presetUnits = item.presetUnits && item.presetUnits.length > 0 ? item.presetUnits : null;
    // Which bestseller this line is, if any — "Indiana Joe (2x4 + …)" in a
    // designer cart, the collapsed quote line, or an expanded old-format
    // sub-unit "Indiana Joe — 2x4". Sizes are checked later (normalizeBestsellers).
    const bestseller =
      bestsellerIdForName(collapsedPresetName(item.desc)) ??
      bestsellerIdForName(EXPANDED_PRESET_DESC.exec(item.desc ?? "")?.[1]) ??
      (presetUnits ? bestsellerIdForName(item.desc?.split(" (")[0]) : undefined);
    if (!presetUnits) {
      const collapsed = collapsedPresetName(item.desc);
      if (collapsed !== null) {
        // Installer quotes store a bestseller as ONE line carrying only its
        // first sub-unit's size. Rebuild it from the catalog, or skip it —
        // never sell a plan for the wrong build.
        const preset = BESTSELLER_PRESETS.find((p) => p.name.toLowerCase() === collapsed.toLowerCase());
        if (!preset) {
          skipped++;
          continue;
        }
        presetUnits = preset.units;
      }
    }
    const tag = bestseller ? { bestseller } : {};
    const subUnits = presetUnits
      ? presetUnits.map((su) => ({ ...base, ...su, ...tag }))
      : [{ ...base, cols: item.cols, rows: item.rows, hasWheels: item.hasWheels, hasTop: item.hasTop, ...tag }];

    const parsed = subUnits.map(parseTotePlanUnit);
    if (parsed.some((u) => !u)) {
      skipped++;
      continue;
    }
    const quantity = Math.max(1, Math.min(TOTE_PLAN_LIMITS.maxUnits, Math.floor(item.quantity ?? 1)));
    for (let q = 0; q < quantity; q++) units.push(...(parsed as TotePlanUnit[]));
    covered++;
  }

  if (units.length === 0 || units.length > TOTE_PLAN_LIMITS.maxUnits) {
    return { design: null, covered: units.length > 0 ? covered : 0, skipped };
  }
  const clean = cleanName(name);
  const tagged = normalizeBestsellers(units);
  return { design: clean ? { units: tagged, name: clean } : { units: tagged }, covered, skipped };
}

/** Old-format quote sub-unit: "Indiana Joe — 2x4" */
const EXPANDED_PRESET_DESC = /^(.+?) — \d+\s*[×x]\s*\d+$/;

// ═══════════════════════════════════════════════════════════════════════════
// Layout — front elevation of the whole design, in inches
// (drawn by the PDF, the plans page and the 3D guide's module map)
// ═══════════════════════════════════════════════════════════════════════════

export interface LayoutModule {
  key: string;
  /** Display name, "A" / "A1" */
  name: string;
  unitIndex: number;
  type: string;
  cols: number;
  rows: number;
  sideways: boolean;
  /** Left edge, inches from the left end of the design */
  x: number;
  /** Bottom edge, inches above the floor (casters lift rolling units) */
  y: number;
  w: number;
  h: number;
}

export interface LayoutUnit {
  unitIndex: number;
  x: number;
  w: number;
  h: number;
  hasWheels: boolean;
  hasTop: boolean;
  /** Front to back: 30" standard, 20" sideways */
  depthIn: number;
  /** Caster pair centerlines, inches from the left end of the design */
  casters: number[];
  /** Mini Tote Rack unit (2×3 frame, plywood rails, 6.5 qt totes) */
  mini?: boolean;
}

export interface DesignLayout {
  modules: LayoutModule[];
  units: LayoutUnit[];
  widthIn: number;
  heightIn: number;
}

/** Units drawn side by side with a small visual gap between them. */
export function designLayout(design: TotePlanDesign, unitGapIn = 8): DesignLayout {
  const { modules } = designModules(design);
  const out: LayoutModule[] = [];
  const units: LayoutUnit[] = [];
  let unitX = 0;

  design.units.forEach((unit, unitIndex) => {
    const mini = isMiniUnit(unit);
    const widths = splitWidth(unit.cols, unit.sideways, mini);
    const tiers = splitHeight(unit.rows, mini);
    const base = unit.hasWheels ? CASTER_IN : 0;
    const colX: number[] = [];
    widths.reduce((x, c, i) => {
      colX[i] = x;
      return x + moduleWidthIn(c, unit.sideways, mini);
    }, unitX);
    const tierY: number[] = [];
    tiers.reduce((y, r, i) => {
      tierY[i] = y;
      return y + moduleFrameHeightIn(r, mini);
    }, base);

    for (const m of modules.filter((mm) => mm.unitIndex === unitIndex)) {
      out.push({
        key: m.key,
        name: m.name,
        unitIndex,
        type: m.type,
        cols: m.cols,
        rows: m.rows,
        sideways: m.sideways,
        x: colX[m.widthIndex],
        y: tierY[m.tierIndex],
        w: moduleWidthIn(m.cols, m.sideways, mini),
        h: moduleFrameHeightIn(m.rows, mini),
      });
    }
    const size = unitOuterSize(unit);
    units.push({
      unitIndex,
      x: unitX,
      w: size.widthIn,
      h: size.heightIn,
      hasWheels: unit.hasWheels,
      hasTop: unit.hasTop,
      depthIn: size.depthIn,
      casters: casterPositions(unit).map((c) => unitX + c),
      ...(mini ? { mini: true } : {}),
    });
    unitX += size.widthIn + unitGapIn;
  });

  return {
    modules: out,
    units,
    widthIn: unitX - unitGapIn,
    heightIn: Math.max(...units.map((u) => u.h)),
  };
}

/** Key for a module type's step render, shared by the renderer and the PDF. */
export function planSnapshotKey(typeLetter: string, stepId: string): string {
  return `${typeLetter}:${stepId}`;
}
