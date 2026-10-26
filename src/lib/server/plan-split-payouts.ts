import "server-only";

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeTotePlanDesign } from "@/lib/tote-plans";
import { planSplitShares, planSplitsEnabled } from "@/lib/plan-splits";

// ═══════════════════════════════════════════════════════════════════════════
// processPlanSplits — pays the installer share of a confirmed tote plan sale
//
// Called by the Stripe webhook on checkout.session.completed for
// metadata.type === "diy_plan" (not upgrades, not the ladder jig). Shares
// come from planSplitShares (referral → $5 to that installer; otherwise the
// bestseller owners split $5 equally; otherwise nothing).
//
// Per share:
//   1. INSERT the plan_split_payouts row — UNIQUE(session, recipient) makes
//      a webhook retry hit 23505 and skip (never pays twice)
//   2. Connected Stripe account missing → row 'failed'
//   3. Transfer from the sale's charge (source_transaction), idempotency
//      key per session + recipient → row 'paid', else 'failed'
// ═══════════════════════════════════════════════════════════════════════════

export interface PlanSplitResult {
  recipientId: string;
  cents: number;
  status: "paid" | "failed" | "skipped";
  reason?: string;
}

async function chargeIdFor(stripe: Stripe, session: Stripe.Checkout.Session): Promise<string | null> {
  const pi = session.payment_intent;
  if (!pi) return null;
  try {
    const intent = typeof pi === "string" ? await stripe.paymentIntents.retrieve(pi) : pi;
    const charge = intent.latest_charge;
    return typeof charge === "string" ? charge : charge?.id ?? null;
  } catch (err) {
    // Without it the transfer draws on the available balance instead
    console.warn("[PlanSplit] Couldn't read the sale's charge:", err);
    return null;
  }
}

export async function processPlanSplits(
  session: Stripe.Checkout.Session,
  { stripe, db }: { stripe: Stripe; db: SupabaseClient },
): Promise<PlanSplitResult[]> {
  const metadata = session.metadata || {};
  if (!planSplitsEnabled()) return [];
  if (metadata.type !== "diy_plan" || session.payment_status !== "paid") return [];

  const design = decodeTotePlanDesign(metadata.design, metadata.design_name);
  if (!design) return [];
  const shares = planSplitShares({ referralInstallerId: metadata.referral_installer_id, design });
  if (shares.length === 0) return [];

  const chargeId = await chargeIdFor(stripe, session);
  const results: PlanSplitResult[] = [];

  for (const share of shares) {
    const fail = async (rowId: string, reason: string) => {
      await db
        .from("plan_split_payouts")
        .update({ status: "failed", failure_reason: reason, updated_at: new Date().toISOString() })
        .eq("id", rowId);
      results.push({ recipientId: share.recipientId, cents: share.cents, status: "failed", reason });
    };

    // 1. Claim
    const { data: row, error: insertErr } = await db
      .from("plan_split_payouts")
      .insert({
        stripe_session_id: session.id,
        recipient_id: share.recipientId,
        amount_cents: share.cents,
        reason: share.reason,
        bestsellers: share.bestsellers,
        plan_tier: metadata.tier ?? null,
        design: metadata.design ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (insertErr || !row) {
      const duplicate = (insertErr as { code?: string } | null)?.code === "23505";
      if (!duplicate) console.error("[PlanSplit] ledger insert failed:", insertErr);
      results.push({ recipientId: share.recipientId, cents: share.cents, status: "skipped", reason: duplicate ? "already_recorded" : "insert_failed" });
      continue;
    }

    try {
      // 2. Connected account
      const { data: profile } = await db
        .from("profiles")
        .select("stripe_account_id, stripe_details_submitted")
        .eq("id", share.recipientId)
        .single();
      if (!profile?.stripe_account_id || !profile.stripe_details_submitted) {
        await fail(row.id, "no_connected_stripe_account");
        continue;
      }

      // 3. Transfer
      const transfer = await stripe.transfers.create(
        {
          amount: share.cents,
          currency: "usd",
          destination: profile.stripe_account_id,
          transfer_group: session.id,
          ...(chargeId ? { source_transaction: chargeId } : {}),
          description:
            share.reason === "referral"
              ? "DIY plan sale — referral share"
              : `DIY plan sale — bestseller share (${share.bestsellers.join(", ")})`,
          metadata: {
            type: "plan_split",
            stripe_session_id: session.id,
            reason: share.reason,
            bestsellers: share.bestsellers.join(","),
          },
        },
        { idempotencyKey: `plan-split-${session.id}-${share.recipientId}` },
      );

      await db
        .from("plan_split_payouts")
        .update({
          status: "paid",
          stripe_transfer_id: transfer.id,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      results.push({ recipientId: share.recipientId, cents: share.cents, status: "paid" });
      console.log(`[PlanSplit] Paid $${(share.cents / 100).toFixed(2)} → ${share.recipientId.slice(0, 8)}… (${share.reason}) for ${session.id}`);
    } catch (err) {
      console.error("[PlanSplit] transfer failed:", err);
      await fail(row.id, `transfer_error: ${err instanceof Error ? err.message.slice(0, 200) : "unknown"}`);
    }
  }

  return results;
}
