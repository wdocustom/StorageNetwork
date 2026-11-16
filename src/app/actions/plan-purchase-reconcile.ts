"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Plan purchase reconcile — the safety net under plan fulfilment
//
// Every paid tote plan / ladder jig checkout from the last 3 days must have
// a purchase row (and its access email). The webhook and the buyer's return
// both record it; this catches anything both missed (a dropped webhook, a
// closed tab) and fulfils it the same way. Hourly via
// /api/cron/plan-purchase-reconcile.
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "stripe";
import { stripeConfig } from "@/lib/stripe/http";
import { getServiceClient } from "@/lib/supabase-server";
import { FULFILLED_PLAN_TYPES, fulfilPlanSession } from "@/lib/server/plan-fulfilment";

export interface ReconcileResult {
  checked: number;
  recovered: string[];
  errors: string[];
}

export async function reconcilePlanPurchases(days = 3): Promise<ReconcileResult> {
  const result: ReconcileResult = { checked: 0, recovered: [], errors: [] };
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, stripeConfig());
  const since = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  const paid: Stripe.Checkout.Session[] = [];
  for await (const s of stripe.checkout.sessions.list({ created: { gte: since }, status: "complete", limit: 100 })) {
    if (s.payment_status === "paid" && FULFILLED_PLAN_TYPES.has(s.metadata?.type ?? "")) paid.push(s);
  }
  result.checked = paid.length;
  if (!paid.length) return result;

  const { data: rows } = await getServiceClient()
    .from("public_plan_purchases")
    .select("stripe_session_id")
    .in("stripe_session_id", paid.map((s) => s.id));
  const recorded = new Set((rows ?? []).map((r) => r.stripe_session_id as string));

  for (const session of paid) {
    if (recorded.has(session.id)) continue;
    const done = await fulfilPlanSession(session).catch((err) => ({ ok: false as const, error: String(err) }));
    if (done.ok) result.recovered.push(session.id);
    else result.errors.push(`${session.id}: ${done.error}`);
  }
  console.log("[PlanReconcile]", { checked: result.checked, recovered: result.recovered, errors: result.errors });
  return result;
}
