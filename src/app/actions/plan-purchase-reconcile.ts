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
import { GIFT_MAX_AUTO_ATTEMPTS, GIFT_SESSION_TYPE, fulfilGiftSession } from "@/lib/server/plan-gifts";

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
  const gifts: Stripe.Checkout.Session[] = [];
  for await (const s of stripe.checkout.sessions.list({ created: { gte: since }, status: "complete", limit: 100 })) {
    if (s.payment_status !== "paid") continue;
    if (FULFILLED_PLAN_TYPES.has(s.metadata?.type ?? "")) paid.push(s);
    else if (s.metadata?.type === GIFT_SESSION_TYPE) gifts.push(s);
  }
  result.checked = paid.length + gifts.length;

  await reconcileGiftSessions(gifts, result);
  if (!paid.length) {
    if (gifts.length) console.log("[PlanReconcile]", { checked: result.checked, recovered: result.recovered, errors: result.errors });
    return result;
  }

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

/**
 * Gift orders: anything not yet marked paid, a recipient without a purchase
 * or still owed an email (failed or stuck sends get GIFT_MAX_AUTO_ATTEMPTS
 * tries in all), or a gifter receipt that never went out.
 */
async function reconcileGiftSessions(sessions: Stripe.Checkout.Session[], result: ReconcileResult): Promise<void> {
  if (!sessions.length) return;
  const db = getServiceClient();
  const { data: orders } = await db
    .from("plan_gift_orders")
    .select("id, stripe_session_id, status, receipt_claimed_at")
    .in("stripe_session_id", sessions.map((s) => s.id));
  const byId = new Map((orders ?? []).map((o) => [o.stripe_session_id as string, o]));
  const orderIds = (orders ?? []).map((o) => o.id as string);
  const { data: owed } = orderIds.length
    ? await db
        .from("plan_gifts")
        .select("order_id, purchase_token, email_status, email_attempts")
        .in("order_id", orderIds)
        .neq("email_status", "sent")
    : { data: [] };
  const needsWork = new Set(
    (owed ?? [])
      .filter((g) => !g.purchase_token || (g.email_attempts as number) < GIFT_MAX_AUTO_ATTEMPTS)
      .map((g) => g.order_id as string)
  );

  for (const session of sessions) {
    const order = byId.get(session.id);
    if (order && order.status === "paid" && order.receipt_claimed_at && !needsWork.has(order.id as string)) continue;
    const done = await fulfilGiftSession(session, { retryFailed: true }).catch((err) => ({
      ok: false as const,
      error: String(err),
    }));
    if (done.ok) result.recovered.push(session.id);
    else result.errors.push(`${session.id}: ${done.error}`);
  }
}
