// ═══════════════════════════════════════════════════════════════════════════
// DIY plan reviews — shared bits (client-safe). Server: @/app/actions/plan-reviews.
// One review per buyer email per product: the 27-gal plans ("tote") and the
// Mini Tote Rack plans ("mini").
// ═══════════════════════════════════════════════════════════════════════════

import { MINI_TOTE_TYPE } from "@/lib/mini-rack";
import { SKILL_LEVELS } from "@/lib/reviews";

export type PlanReviewProduct = "tote" | "mini";

export const PLAN_REVIEW_PRODUCT_LABEL: Record<PlanReviewProduct, string> = {
  tote: "Tote rack plans",
  mini: "Mini Tote Rack plans",
};

/** Days after purchase for the review email, then the one reminder. */
export const PLAN_REVIEW_REQUEST_AFTER_DAYS = 7;
export const PLAN_REVIEW_REMINDER_AFTER_DAYS = 5;
/** Past this, don't start asking (older buyers from before reviews existed). */
export const PLAN_REVIEW_REQUEST_MAX_AGE_DAYS = 45;

interface UnitLike {
  cols: number;
  rows: number;
  toteType?: string;
  hasWheels?: boolean;
  hasTop?: boolean;
  sideways?: boolean;
}

/** What they built, from their design: "4×4 rolling rack with a top", "3-unit system". */
export function planBuildSummary(design: { units: UnitLike[] } | null | undefined): string | null {
  const units = design?.units ?? [];
  if (!units.length) return null;
  const mini = units.every((u) => u.toteType === MINI_TOTE_TYPE);
  if (units.length > 1) return `${units.length}-unit ${mini ? "mini " : ""}system`;
  const u = units[0];
  const extras = [u.hasTop ? "a top" : null].filter(Boolean);
  return [
    `${u.cols}×${u.rows}`,
    u.sideways ? "sideways" : null,
    u.hasWheels ? "rolling" : null,
    mini ? "mini rack" : "rack",
    extras.length ? `with ${extras.join(" and ")}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** "Built a 4×4 rolling rack · First build · 4 hrs" */
export function planReviewMeta(r: { build_summary: string | null; skill_level: string | null; build_hours: number | null }): string | null {
  const skill = SKILL_LEVELS.find((s) => s.id === r.skill_level)?.label ?? null;
  const hours = r.build_hours ? `${Number(r.build_hours)} hr${Number(r.build_hours) === 1 ? "" : "s"}` : null;
  // "an 8×4", "an 11×2", "an 18×…"; "a 4×4"
  const article = r.build_summary && /^(8|11|18)(\D|$)/.test(r.build_summary) ? "an" : "a";
  const parts = [r.build_summary ? `Built ${article} ${r.build_summary}` : null, skill, hours].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Hours from the form: 0.5–200 in half hours, else null. */
export function cleanBuildHours(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 200) return null;
  return Math.round(n * 2) / 2 || null;
}
