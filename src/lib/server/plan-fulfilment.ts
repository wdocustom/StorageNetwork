import "server-only";

// ═══════════════════════════════════════════════════════════════════════════
// Plan purchase fulfilment — record a paid plan checkout and email the link
//
// One place for a tote plan (type "diy_plan") or ladder jig ("ladder_jig")
// session to become a purchase row + access email. Three callers, so a sale
// is never lost to a closed tab:
//   • the buyer's return to /plans/build or /plans/ladder-jig (session_id)
//   • the Stripe webhook (checkout.session.completed)
//   • the hourly reconcile job, for anything both of those missed
// Idempotent on stripe_session_id: whoever comes second gets the same row
// and no second email.
// ═══════════════════════════════════════════════════════════════════════════

import type Stripe from "stripe";
import { getServiceClient } from "@/lib/supabase-server";
import { sendLadderJigAccessEmail, sendTotePlanAccessEmail } from "@/lib/emails/plansTemplates";
import { LADDER_JIG_PLAN_ID } from "@/lib/ladder-jig";
import { grantDiyInventory } from "@/lib/server/diy-inventory";
import { queueSmartInventoryFollowUp } from "@/lib/server/smart-inventory-follow-up";
import {
  TOTE_PLAN_ID,
  decodeTotePlanDesign,
  isTotePlanTier,
  offerIncludesInventory,
  parseTotePlanDesign,
  type TotePlanDesign,
  type TotePlanTier,
} from "@/lib/tote-plans";

export const FULFILLED_PLAN_TYPES = new Set(["diy_plan", "ladder_jig"]);

export const PLAN_ROW_COLUMNS =
  "access_token, email, tier, build_config, plan_id, customer_name, included_from, purchased_at";

export interface FulfilledRow {
  access_token: string;
  email: string;
  tier: string | null;
  build_config: unknown;
  plan_id: string;
  customer_name: string | null;
  included_from: string | null;
  purchased_at: string;
}

export type FulfilResult =
  | { ok: true; row: FulfilledRow; created: boolean; email: string }
  | { ok: false; error: string };

/** Design recorded on a paid session: compact `design` (current) or `config` JSON (single-unit legacy). */
export function designFromSessionMetadata(metadata: Stripe.Metadata): TotePlanDesign | null {
  if (metadata.design) return decodeTotePlanDesign(metadata.design, metadata.design_name);
  try {
    return parseTotePlanDesign(JSON.parse(metadata.config ?? "null"));
  } catch {
    return null;
  }
}

async function rowBySession(sessionId: string): Promise<FulfilledRow | null> {
  const { data } = await getServiceClient()
    .from("public_plan_purchases")
    .select(PLAN_ROW_COLUMNS)
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  return (data as FulfilledRow | null) ?? null;
}

export async function fulfilPlanSession(session: Stripe.Checkout.Session): Promise<FulfilResult> {
  const type = session.metadata?.type ?? "";
  if (!FULFILLED_PLAN_TYPES.has(type)) return { ok: false, error: "Not a plan purchase." };

  const existing = await rowBySession(session.id);
  if (existing) return { ok: true, row: existing, created: false, email: existing.email };

  if (session.payment_status !== "paid") return { ok: false, error: "We couldn't confirm that payment." };
  const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase();
  const metadata = session.metadata ?? {};

  const isTote = type === "diy_plan";
  const design = isTote ? designFromSessionMetadata(metadata) : null;
  // Sessions created before tiers existed carry no tier: they bought the PDF.
  const tier: TotePlanTier = isTotePlanTier(metadata.tier) ? metadata.tier : "pdf";
  if (!email || (isTote && !design)) {
    console.error("[PlanFulfilment] Paid session missing design or email:", session.id);
    return { ok: false, error: "Your payment went through but the order is incomplete. Reply to your receipt and we'll sort it out." };
  }

  // When they paid, not when this ran (the reconcile job can be hours late).
  const purchasedAt = new Date((session.created || Date.now() / 1000) * 1000).toISOString();
  const db = getServiceClient();
  const { data: inserted, error } = await db
    .from("public_plan_purchases")
    .insert(
      isTote
        ? {
            email,
            plan_id: TOTE_PLAN_ID,
            tier,
            build_config: design,
            stripe_session_id: session.id,
            customer_name: session.customer_details?.name?.trim() || null,
            email_sent: false,
            referred_by_promoter_id: metadata.promoter_id || null,
            promoter_referral_code_snapshot: metadata.promoter_referral_code || null,
            // Retention offer or promo code it was bought with (FRIDAY is once per email).
            offer_code: metadata.offer ? metadata.offer.slice(0, 40) : null,
            purchased_at: purchasedAt,
          }
        : { email, plan_id: LADDER_JIG_PLAN_ID, stripe_session_id: session.id, email_sent: false, purchased_at: purchasedAt },
    )
    .select(PLAN_ROW_COLUMNS)
    .single();

  if (error || !inserted) {
    // Lost a race with another caller for the same session: use its row.
    if ((error as { code?: string } | null)?.code === "23505") {
      const winner = await rowBySession(session.id);
      if (winner) return { ok: true, row: winner, created: false, email: winner.email };
    }
    console.error("[PlanFulfilment] Insert error:", session.id, error);
    return { ok: false, error: "We couldn't record your purchase. Please refresh the page." };
  }

  const row = inserted as FulfilledRow;
  // Last-chance offer: Smart Inventory included free (idempotent per email).
  if (isTote && offerIncludesInventory(metadata.offer)) {
    await grantDiyInventory(email, session.id, 0).catch((err) =>
      console.error("[PlanFulfilment] Smart Inventory grant failed:", session.id, err)
    );
  } else if (isTote) {
    // The purchase email doesn't pitch Smart Inventory: a follow-up does, 4–5 days on.
    await queueSmartInventoryFollowUp(email, row.access_token);
  }
  // Awaited: a send left running after the response can be dropped by the
  // serverless runtime, and email_sent must only be true when it went out.
  const sent = await (isTote
    ? sendTotePlanAccessEmail(email, design!, tier, row.access_token, offerIncludesInventory(metadata.offer))
    : sendLadderJigAccessEmail(email, row.access_token)
  ).catch((err) => {
    console.error("[PlanFulfilment] Email error:", err);
    return null;
  });
  if (sent?.success) {
    await db.from("public_plan_purchases").update({ email_sent: true }).eq("access_token", row.access_token);
  } else if (sent) {
    console.error("[PlanFulfilment] Email not sent:", sent.error);
  }
  console.log(`[PlanFulfilment] Recorded ${type} ${session.id}`);
  return { ok: true, row, created: true, email };
}

/** The buyer is back from checkout with the session id: trust this device for a fresh purchase. */
export function isFreshPurchase(row: Pick<FulfilledRow, "purchased_at">, withinMs = 2 * 60 * 60 * 1000): boolean {
  return Date.now() - new Date(row.purchased_at).getTime() < withinMs;
}
