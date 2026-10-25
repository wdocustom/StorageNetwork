// ═══════════════════════════════════════════════════════════════════════════
// TOTE ORGANIZER PLANS — Retail (non-installer) DIY products
//
// Two tiers sold to retail customers off the /design configurator:
//   • "pdf"         — printable PDF build plan (cut list, shopping list,
//                     every assembly step rendered in 3D)
//   • "interactive" — everything in "pdf" PLUS lifetime access to the
//                     interactive 3D Assembly Guide installers use
//
// Purchases are guest checkouts recorded in public_plan_purchases (same
// ledger as the chair plans) under plan_id = TOTE_PLAN_ID, so one email
// address can recover every plan it bought via /plans "Resend my link".
//
// Client-safe: no server imports.
// ═══════════════════════════════════════════════════════════════════════════

export const TOTE_PLAN_ID = "tote-organizer";

export type TotePlanTier = "pdf" | "interactive";

export interface TotePlanTierInfo {
  id: TotePlanTier;
  name: string;
  tagline: string;
  /** Price in cents */
  price: number;
  includes: string[];
}

export const TOTE_PLAN_TIERS: Record<TotePlanTier, TotePlanTierInfo> = {
  pdf: {
    id: "pdf",
    name: "PDF Build Plan",
    tagline: "Print it, take it to the garage.",
    price: 1900,
    includes: [
      "Every assembly step rendered in 3D for your exact unit",
      "Shopping list with exact quantities",
      "Board-by-board cut diagrams and plywood ripping guide",
      "Tools checklist, fastener callouts, and pro tips",
    ],
  },
  interactive: {
    id: "interactive",
    name: "Interactive Build Guide",
    tagline: "The same 3D guide our pro installers build from.",
    price: 2900,
    includes: [
      "Everything in the PDF Build Plan",
      "Interactive 3D assembly guide — rotate, zoom, step through",
      "Hover any part for its exact dimensions",
      "Works on your phone in the garage, lifetime access",
    ],
  },
};

/** Cost to move an existing PDF purchase up to the interactive tier. */
export const TOTE_PLAN_UPGRADE_PRICE =
  TOTE_PLAN_TIERS.interactive.price - TOTE_PLAN_TIERS.pdf.price;

export function formatPlanPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function isTotePlanTier(value: unknown): value is TotePlanTier {
  return value === "pdf" || value === "interactive";
}

/**
 * The unit configuration a tote plan is generated for. Kept deliberately
 * small: it rides in Stripe metadata (500-char value limit) and is stored
 * on the purchase row.
 */
export interface TotePlanConfig {
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  hasWheels: boolean;
  hasTop: boolean;
}

// One freestanding unit: plates past 4 columns and uprights past 6 rows
// outgrow an 8' board, which is where the build engine splits into modules.
export const TOTE_PLAN_LIMITS = { minCols: 1, maxCols: 4, minRows: 1, maxRows: 6 };

/**
 * Validate and normalize an untrusted config (URL param, Stripe metadata,
 * DB row). Returns null for anything the plan generator can't produce
 * correctly — the assembly steps and 3D guide only model standard-depth,
 * front-loading tote units.
 */
export function parseTotePlanConfig(raw: unknown): TotePlanConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;

  if (c.unitType !== undefined && c.unitType !== "standard") return null;
  if (c.orientation !== undefined && c.orientation !== "standard") return null;

  const cols = Number(c.cols);
  const rows = Number(c.rows);
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) return null;
  if (cols < TOTE_PLAN_LIMITS.minCols || cols > TOTE_PLAN_LIMITS.maxCols) return null;
  if (rows < TOTE_PLAN_LIMITS.minRows || rows > TOTE_PLAN_LIMITS.maxRows) return null;
  if (c.toteType !== "HDX" && c.toteType !== "GM") return null;

  return {
    cols,
    rows,
    toteType: c.toteType,
    hasWheels: c.hasWheels === true,
    hasTop: c.hasTop === true,
  };
}

export function totePlanName(config: TotePlanConfig): string {
  return `${config.cols}×${config.rows} Tote Organizer`;
}

export function totePlanSummary(config: TotePlanConfig): string {
  const parts = [
    `${config.cols * config.rows} totes`,
    config.toteType === "HDX" ? "HDX / Home Depot totes" : "Greenmade / Costco totes",
  ];
  if (config.hasWheels) parts.push("casters");
  if (config.hasTop) parts.push("plywood worktop");
  return parts.join(" · ");
}

export function encodeTotePlanConfig(config: TotePlanConfig): string {
  return encodeURIComponent(JSON.stringify(config));
}

export function decodeTotePlanConfig(param: string | null): TotePlanConfig | null {
  if (!param) return null;
  // useSearchParams() already decodes once; accept either form.
  for (const candidate of [param, safeDecode(param)]) {
    if (!candidate) continue;
    try {
      return parseTotePlanConfig(JSON.parse(candidate));
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

// ── Wall fit ─────────────────────────────────────────────────────────────
// Same geometry as the plan generator: each tote bay is the tote opening
// plus one 1-1/2" upright, each tier is 16", plates and top gap add 5-1/2",
// casters add 2-3/4".

const OPENING_IN = { HDX: 19.75, GM: 20.75 } as const;
const POST_IN = 1.5;
const TIER_IN = 16;
const FRAME_EXTRA_H_IN = 5.5;
const CASTER_IN = 2.75;

export function totePlanOuterSize(config: TotePlanConfig): { widthIn: number; heightIn: number } {
  return {
    widthIn: config.cols * OPENING_IN[config.toteType] + (config.cols + 1) * POST_IN,
    heightIn: config.rows * TIER_IN + FRAME_EXTRA_H_IN + (config.hasWheels ? CASTER_IN : 0),
  };
}

/**
 * Largest grid (within plan limits) that fits a wall opening. Returns null
 * when not even a 1×1 fits.
 */
export function fitTotePlanToWall(
  wallWidthIn: number,
  wallHeightIn: number,
  options: Pick<TotePlanConfig, "toteType" | "hasWheels">,
): { cols: number; rows: number } | null {
  if (!(wallWidthIn > 0) || !(wallHeightIn > 0)) return null;
  const cols = Math.min(
    TOTE_PLAN_LIMITS.maxCols,
    Math.floor((wallWidthIn - POST_IN) / (OPENING_IN[options.toteType] + POST_IN)),
  );
  const rows = Math.min(
    TOTE_PLAN_LIMITS.maxRows,
    Math.floor((wallHeightIn - FRAME_EXTRA_H_IN - (options.hasWheels ? CASTER_IN : 0)) / TIER_IN),
  );
  if (cols < 1 || rows < 1) return null;
  return { cols, rows };
}

export const DEFAULT_TOTE_PLAN_CONFIG: TotePlanConfig = {
  cols: 4,
  rows: 4,
  toteType: "HDX",
  hasWheels: true,
  hasTop: true,
};
