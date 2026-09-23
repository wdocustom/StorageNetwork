// ═══════════════════════════════════════════════════════════════════════════
// Lead money math — pure helpers shared by the payment actions and webhook.
//
// No rate constants live here (those stay in fee-engine / payments). These
// helpers only combine amounts already stored on a lead, so every place that
// asks "what does the customer still owe?" gets the same answer.
// ═══════════════════════════════════════════════════════════════════════════

import type { QuoteUnit } from "@/lib/buildEngine.types";
import { roundMoney } from "@/utils/mathHelpers";

// ── Quote totals ──────────────────────────────────────────────────────────
// Same formula createQuote uses to price a quote server-side:
//   total   = Σ unit.price + Σ indoor delivery fees + delivery fee
//   taxable = Σ unit.price, excluding cleanout / custom-service labor
// Delivery and indoor delivery are tax-exempt.
export function quoteTotals(
  units: Array<Pick<QuoteUnit, "price" | "indoorDelivery" | "indoorDeliveryFee"> & { toteType?: string }>,
  deliveryFee: number | null | undefined
): { total: number; taxable: number } {
  let build = 0;
  let indoor = 0;
  let taxable = 0;
  for (const u of units) {
    const price = Number(u.price) || 0;
    build += price;
    if (u.indoorDelivery && u.indoorDeliveryFee) indoor += Number(u.indoorDeliveryFee) || 0;
    if (u.toteType !== "cleanout" && u.toteType !== "custom_service") taxable += price;
  }
  return {
    total: roundMoney(build + indoor + (Number(deliveryFee) || 0)),
    taxable: roundMoney(taxable),
  };
}

// ── Balance due ───────────────────────────────────────────────────────────
// What the customer still owes on a lead, before any tip:
//   estimated_price − deposit actually collected − discount + sales tax
//
// estimated_price includes every post-deposit add-on and deposit_amount
// includes every add-on deposit already paid, so an add-on whose deposit is
// still unpaid is automatically owed here in full.
export interface BalanceFields {
  estimated_price: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean | null;
  discount_amount: number | null;
  sales_tax_amount: number | null;
}

export function computeBalanceDue(lead: BalanceFields): number {
  const depositCredit = lead.deposit_paid ? Number(lead.deposit_amount) || 0 : 0;
  return roundMoney(
    (Number(lead.estimated_price) || 0) -
      depositCredit -
      (Number(lead.discount_amount) || 0) +
      (Number(lead.sales_tax_amount) || 0)
  );
}

// ── Tips ──────────────────────────────────────────────────────────────────
// Free-form tip typed by the customer on the balance payment page. Returns
// the tip in cents, or an error. Empty / zero means no tip.
export const MAX_TIP_DOLLARS = 5_000;

export function parseTipCents(
  input: number | string | null | undefined
): { cents: number } | { error: string } {
  if (input === null || input === undefined || input === "") return { cents: 0 };
  const n = typeof input === "number" ? input : Number(String(input).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return { error: "Tip must be a positive amount." };
  if (n > MAX_TIP_DOLLARS) return { error: `Tip can't be more than $${MAX_TIP_DOLLARS.toLocaleString()}.` };
  return { cents: Math.round(n * 100) };
}

// ── Add-on description ────────────────────────────────────────────────────
// Short human-readable summary of what a post-deposit edit added, for the
// add-on record, the customer's add-on deposit checkout, and the job ticket.
type DescribableUnit = Pick<QuoteUnit, "price" | "desc" | "hasTop" | "hasWheels" | "hasTotes">;

export function describeAddon(before: DescribableUnit[], after: DescribableUnit[]): string {
  const parts: string[] = [];
  after.forEach((a, i) => {
    const b = before[i];
    if (!b) {
      parts.push(`+ ${a.desc || `Unit ${i + 1}`}`);
      return;
    }
    const adds: string[] = [];
    if (a.hasTop && !b.hasTop) adds.push("top");
    if (a.hasWheels && !b.hasWheels) adds.push("wheels");
    if (a.hasTotes && !b.hasTotes) adds.push("totes");
    if (adds.length > 0) {
      parts.push(`Unit ${i + 1}: + ${adds.join(", ")}`);
    } else if ((Number(a.price) || 0) > (Number(b.price) || 0)) {
      parts.push(`Unit ${i + 1}: upgraded`);
    }
  });
  return parts.length > 0 ? parts.join("; ").slice(0, 300) : "Quote updated";
}
