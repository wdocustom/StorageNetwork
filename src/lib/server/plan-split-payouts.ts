import "server-only";

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TOTE_PLAN_TIERS, decodeTotePlanDesign, isTotePlanTier } from "@/lib/tote-plans";
import { PLAN_SPLIT_TOTAL_CENTS, planSplitShares, planSplitsEnabled } from "@/lib/plan-splits";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import { sendPlanSplitEarnedEmail, type PlanSplitEmailData } from "@/lib/emails/planSplitTemplates";

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
//   4. Paid → email the installer what they earned and why (best-effort;
//      a failed email never touches the payout)
// ═══════════════════════════════════════════════════════════════════════════

export type PlanSplitNotifier = (email: string, data: PlanSplitEmailData) => Promise<unknown>;

interface PlanSplitDeps {
  stripe: Stripe;
  db: SupabaseClient;
  /** Defaults to the "you just earned" email */
  notify?: PlanSplitNotifier;
}

/** Tell the installer about a paid split. Never throws. */
async function notifyPaid(
  db: SupabaseClient,
  notify: PlanSplitNotifier,
  split: { recipientId: string; cents: number; reason: "referral" | "bestseller"; bestsellers: string[]; tier?: string | null; shared?: boolean },
): Promise<void> {
  try {
    const { data: profile } = await db
      .from("profiles")
      .select("email, first_name, business_name")
      .eq("id", split.recipientId)
      .single();
    if (!profile?.email) return;
    await notify(profile.email, {
      name: profile.first_name || profile.business_name || "there",
      cents: split.cents,
      reason: split.reason,
      bestsellerNames: split.bestsellers.map((id) => BESTSELLER_PRESETS.find((p) => p.id === id)?.name ?? id),
      productName: isTotePlanTier(split.tier) ? TOTE_PLAN_TIERS[split.tier].name : undefined,
      shared: split.shared,
    });
  } catch (err) {
    console.error("[PlanSplit] earnings email failed (payout unaffected):", err);
  }
}

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
  { stripe, db, notify = sendPlanSplitEarnedEmail }: PlanSplitDeps,
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
      await notifyPaid(db, notify, { ...share, tier: metadata.tier, shared: shares.length > 1 });
    } catch (err) {
      console.error("[PlanSplit] transfer failed:", err);
      await fail(row.id, `transfer_error: ${err instanceof Error ? err.message.slice(0, 200) : "unknown"}`);
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// retryPlanSplitPayout — owner-triggered retry of a 'failed' share
//
// Safe to click twice: the row is claimed failed → pending first, and if
// Stripe already holds a plan-split transfer for this sale + account (e.g.
// the original call timed out after succeeding) it's recorded, not repaid.
// ═══════════════════════════════════════════════════════════════════════════

export async function retryPlanSplitPayout(
  rowId: string,
  { stripe, db, notify = sendPlanSplitEarnedEmail }: PlanSplitDeps,
): Promise<{ ok: boolean; status?: "paid" | "failed"; error?: string }> {
  const { data: row } = await db
    .from("plan_split_payouts")
    .select("id, stripe_session_id, recipient_id, amount_cents, reason, bestsellers, plan_tier, status")
    .eq("id", rowId)
    .single();
  if (!row) return { ok: false, error: "Payout not found." };
  if (row.status !== "failed") return { ok: false, error: "Only failed payouts can be retried." };

  const { data: profile } = await db
    .from("profiles")
    .select("stripe_account_id, stripe_details_submitted")
    .eq("id", row.recipient_id)
    .single();
  if (!profile?.stripe_account_id || !profile.stripe_details_submitted) {
    return { ok: false, error: "This installer hasn't finished connecting Stripe yet." };
  }

  // Claim it so a double click can't pay twice
  const { data: claimed } = await db
    .from("plan_split_payouts")
    .update({ status: "pending", failure_reason: null, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "failed")
    .select("id");
  if (!claimed || claimed.length === 0) return { ok: false, error: "Already being retried." };

  const markPaid = async (transferId: string) => {
    const now = new Date().toISOString();
    await db
      .from("plan_split_payouts")
      .update({ status: "paid", stripe_transfer_id: transferId, paid_at: now, updated_at: now })
      .eq("id", row.id);
    // First time this split is paid (it was 'failed'), so the installer hasn't been told yet
    await notifyPaid(db, notify, {
      recipientId: row.recipient_id,
      cents: row.amount_cents,
      reason: row.reason,
      bestsellers: row.bestsellers ?? [],
      tier: row.plan_tier,
      shared: row.reason === "bestseller" && row.amount_cents < PLAN_SPLIT_TOTAL_CENTS,
    });
    return { ok: true, status: "paid" as const };
  };

  try {
    const existing = await stripe.transfers.list({ transfer_group: row.stripe_session_id, destination: profile.stripe_account_id, limit: 20 });
    const already = existing.data.find((t) => t.metadata?.type === "plan_split");
    if (already) return await markPaid(already.id);

    const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id);
    const chargeId = await chargeIdFor(stripe, session);
    const transfer = await stripe.transfers.create({
      amount: row.amount_cents,
      currency: "usd",
      destination: profile.stripe_account_id,
      transfer_group: row.stripe_session_id,
      ...(chargeId ? { source_transaction: chargeId } : {}),
      description: `DIY plan sale — ${row.reason} share (retry)`,
      metadata: {
        type: "plan_split",
        stripe_session_id: row.stripe_session_id,
        reason: row.reason,
        bestsellers: (row.bestsellers ?? []).join(","),
      },
    });
    return await markPaid(transfer.id);
  } catch (err) {
    const reason = `transfer_error: ${err instanceof Error ? err.message.slice(0, 200) : "unknown"}`;
    await db
      .from("plan_split_payouts")
      .update({ status: "failed", failure_reason: reason, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: false, status: "failed", error: reason };
  }
}
