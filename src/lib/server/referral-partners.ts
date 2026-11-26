import Stripe from "stripe";
import { getServiceClient } from "@/lib/supabase-server";
import { stripeConfig } from "@/lib/stripe/http";
import { checkTransferEligibility } from "@/lib/stripe/cross-border";
import { normalizeCurrency } from "@/lib/geo/currency";
import {
  computePartnerCutCents,
  jobTotalAfterDiscountCents,
  normalizePartnerCode,
  type CutType,
} from "@/lib/referral-partners";
import { sendPartnerCommissionEmail } from "@/lib/emails/referralPartnerTemplates";

// ═══════════════════════════════════════════════════════════════════════════
// Referral partners — server side of the money (migration 168).
//
//   attributeLeadToPartner   at deposit setup: which partner (if any) sent
//                            this customer, and their cut, stamped on the lead
//   settleReferralCommission when the deposit is confirmed (webhook, or the
//                            verifyAndConfirmDeposit fallback, or cash): one
//                            commission row per lead, idempotent
//   processDueCommissions    the payout pass (daily cron + partner portal):
//                            a held cut is paid once its deposit has cleared
//                            (PAYOUT_HOLD_DAYS), voided and handed back to
//                            the installer if the job was cancelled or the
//                            deposit refunded, left held while disputed
//   payHeldCommission        sends one collected cut to the partner's Stripe
//   releaseHeldCommissions   the payout pass for one partner (called
//                            when they open their portal / finish Stripe)
//
// Every function here swallows its own errors. A partner payout problem must
// never fail a customer's deposit or a webhook — and until migration 168 is
// applied the tables don't exist, which has to look like "no partner".
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

let _stripe: Stripe | null | undefined;
function stripe(): Stripe | null {
  if (_stripe === undefined) {
    _stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, stripeConfig()) : null;
  }
  return _stripe;
}

interface PartnerRow {
  id: string;
  installer_id: string;
  name: string;
  email: string | null;
  code: string;
  cut_type: CutType;
  cut_value: number;
  user_id: string | null;
  portal_enabled: boolean;
  active: boolean;
}

const PARTNER_COLUMNS = "id, installer_id, name, email, code, cut_type, cut_value, user_id, portal_enabled, active";

/**
 * Decide which partner sent this customer and stamp the lead with the partner
 * and their cut. `collectCents` is what to take from the deposit: the cut
 * for a portal partner (who can connect Stripe), 0 for a basic partner (the
 * installer pays them directly, so the commission is recorded as owed).
 *
 *   1. a partner already on the lead (same installer, still active)
 *   2. the /r/<code> cookie (customer-facing checkouts only — pass null from
 *      installer-initiated charges, where the cookie would be the installer's)
 *   3. the discount code the customer typed, if it is a partner's code
 *
 * Self-referrals are dropped: the partner can't be the installer, and the
 * customer can't be the partner.
 */
export async function attributeLeadToPartner(params: {
  leadId: string;
  installerId: string | null | undefined;
  refCode?: string | null;
  discountCode?: string | null;
  customerEmail?: string | null;
  totalPriceCents: number;
  discountCents: number;
}): Promise<{ partnerId: string; cutCents: number; collectCents: number } | null> {
  const { leadId, installerId, totalPriceCents, discountCents } = params;
  if (!leadId || !installerId) return null;
  try {
    const { data: lead, error: leadErr } = await db()
      .from("leads")
      .select("referral_partner_id, deposit_paid, customer_email")
      .eq("id", leadId)
      .maybeSingle();
    if (leadErr || !lead || lead.deposit_paid) return null;

    let partner: PartnerRow | null = null;
    if (lead.referral_partner_id) {
      const { data } = await db().from("referral_partners").select(PARTNER_COLUMNS).eq("id", lead.referral_partner_id).maybeSingle();
      partner = (data as PartnerRow | null) ?? null;
    }
    if (!partner) {
      for (const raw of [params.refCode, params.discountCode]) {
        const code = normalizePartnerCode(raw);
        if (!code) continue;
        const { data } = await db().from("referral_partners").select(PARTNER_COLUMNS).eq("code", code).maybeSingle();
        if (data) {
          partner = data as PartnerRow;
          break;
        }
      }
    }
    if (!partner || !partner.active || partner.installer_id !== installerId) return null;

    const customerEmail = (params.customerEmail || lead.customer_email || "").trim().toLowerCase();
    const isSelfReferral =
      partner.user_id === installerId || (!!customerEmail && !!partner.email && partner.email.trim().toLowerCase() === customerEmail);
    if (isSelfReferral) return null;

    const cutCents = computePartnerCutCents({
      cutType: partner.cut_type,
      cutValue: Number(partner.cut_value),
      jobTotalCents: jobTotalAfterDiscountCents(totalPriceCents, discountCents),
    });

    const { error: stampErr } = await db()
      .from("leads")
      .update({ referral_partner_id: partner.id, partner_cut_cents: cutCents })
      .eq("id", leadId)
      .eq("deposit_paid", false);
    if (stampErr) {
      console.warn("[ReferralPartners] stamp lead failed:", stampErr.message);
      return null;
    }
    const canReceivePayouts = partner.portal_enabled && !!partner.user_id;
    return { partnerId: partner.id, cutCents, collectCents: canReceivePayouts ? cutCents : 0 };
  } catch (err) {
    console.warn("[ReferralPartners] attribution skipped:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * The deposit on `leadId` is confirmed. Record what the partner earned:
 * `held` if the cut rode on the deposit charge (then try to send it), `owed`
 * if it didn't (the installer pays the partner directly). Safe to call from
 * every deposit-confirmed path — the lead_id unique key makes repeats no-ops.
 */
export async function settleReferralCommission(params: {
  leadId: string;
  collectedCents?: number;
  paymentIntentId?: string | null;
}): Promise<void> {
  const { leadId, paymentIntentId } = params;
  try {
    const { data: lead } = await db()
      .from("leads")
      .select("id, installer_id, referral_partner_id, partner_cut_cents, customer_name")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead?.referral_partner_id || !lead.installer_id) return;
    const cutCents = Number(lead.partner_cut_cents) || 0;
    if (cutCents <= 0) return;

    const collected = Math.max(0, Math.min(Number(params.collectedCents) || 0, cutCents));
    const { data: installer } = await db().from("profiles").select("currency").eq("id", lead.installer_id).maybeSingle();

    const { data: inserted, error } = await db()
      .from("referral_commissions")
      .upsert(
        {
          partner_id: lead.referral_partner_id,
          installer_id: lead.installer_id,
          lead_id: leadId,
          amount_cents: cutCents,
          currency: normalizeCurrency(installer?.currency as string | null),
          status: collected >= cutCents ? "held" : "owed",
          collected_cents: collected,
          payment_intent_id: paymentIntentId ?? null,
        },
        { onConflict: "lead_id", ignoreDuplicates: true },
      )
      .select("id, status")
      .maybeSingle();
    if (error) {
      console.warn("[ReferralPartners] settle failed:", error.message);
      return;
    }
    if (!inserted) return; // already settled by another path

    console.log(`[ReferralPartners] Lead ${leadId}: ${inserted.status} ${cutCents}¢ for partner ${lead.referral_partner_id}`);
    notifyPartner(lead.referral_partner_id, cutCents, inserted.status as string, lead.customer_name as string | null).catch(() => {});
    // Held cuts are paid by processDueCommissions once the deposit has
    // cleared, not now: the transfer comes out of the platform's available
    // balance, and this deposit's fee is still pending in it.
  } catch (err) {
    console.warn("[ReferralPartners] settle threw:", err instanceof Error ? err.message : err);
  }
}

async function notifyPartner(partnerId: string, cents: number, status: string, customerName: string | null) {
  const { data: p } = await db()
    .from("referral_partners")
    .select("name, email, user_id, portal_enabled, installer_id")
    .eq("id", partnerId)
    .maybeSingle();
  if (!p?.email) return;
  const { data: inst } = await db().from("profiles").select("business_name, first_name").eq("id", p.installer_id).maybeSingle();
  await sendPartnerCommissionEmail(p.email as string, {
    partnerName: p.name as string,
    installerName: (inst?.business_name as string) || (inst?.first_name as string) || "Your installer",
    amountCents: cents,
    customerName,
    collected: status === "held",
    hasLogin: !!p.user_id && !!p.portal_enabled,
  });
}

/**
 * Send one collected cut to the partner's Stripe. Claims the row first
 * (held → processing) so two callers can't both transfer it; anything that
 * stops the transfer puts it back to held with the reason.
 */
export async function payHeldCommission(commissionId: string): Promise<"paid" | "held"> {
  const s = stripe();
  if (!s) return "held";
  const { data: claimed } = await db()
    .from("referral_commissions")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", commissionId)
    .eq("status", "held")
    .select("id, lead_id, partner_id, collected_cents, currency, payment_intent_id")
    .maybeSingle();
  if (!claimed) return "held";

  const backToHeld = async (reason: string) => {
    await db()
      .from("referral_commissions")
      .update({ status: "held", last_error: reason.slice(0, 300), updated_at: new Date().toISOString() })
      .eq("id", commissionId);
    return "held" as const;
  };

  try {
    const { data: partner } = await db().from("referral_partners").select("user_id, name").eq("id", claimed.partner_id).maybeSingle();
    if (!partner?.user_id) return backToHeld("partner has not claimed their portal");
    const { data: account } = await db()
      .from("referral_partner_accounts")
      .select("stripe_account_id, payouts_ready")
      .eq("user_id", partner.user_id)
      .maybeSingle();
    if (!account?.stripe_account_id || !account.payouts_ready) return backToHeld("partner has not finished Stripe setup");

    const eligibility = await checkTransferEligibility(s, account.stripe_account_id, claimed.currency as string);
    if (!eligibility.ok) return backToHeld(eligibility.detail);

    const transfer = await s.transfers.create(
      {
        amount: claimed.collected_cents as number,
        currency: (claimed.currency as string) || "usd",
        destination: account.stripe_account_id,
        ...(claimed.payment_intent_id ? { transfer_group: claimed.payment_intent_id as string } : {}),
        description: `Referral payout — ${partner.name} — job ${String(claimed.lead_id).slice(0, 8)}`,
        metadata: { referral_commission_id: commissionId, lead_id: String(claimed.lead_id) },
      },
      { idempotencyKey: `referral-commission-${commissionId}` },
    );
    await db()
      .from("referral_commissions")
      .update({ status: "paid", stripe_transfer_id: transfer.id, paid_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
      .eq("id", commissionId);
    console.log(`[ReferralPartners] Paid commission ${commissionId}: ${transfer.id}`);
    return "paid";
  } catch (err) {
    return backToHeld(err instanceof Error ? err.message : "transfer failed");
  }
}

/** The payout pass for the partner logged in as `userId` (their portal calls this). */
export async function releaseHeldCommissions(userId: string): Promise<number> {
  try {
    const { data: partners } = await db().from("referral_partners").select("id").eq("user_id", userId);
    const ids = (partners ?? []).map((p) => p.id as string);
    if (!ids.length) return 0;
    return (await processDueCommissions({ partnerIds: ids })).paid;
  } catch {
    return 0;
  }
}

/**
 * Days a collected cut waits before it's paid out. Card money reaches the
 * platform's Stripe balance as "pending" and turns "available" about two
 * business days later; a transfer can only spend available money. Three
 * days clears that, and gives a cancelled job time to show up before the
 * partner is paid.
 */
export const PAYOUT_HOLD_DAYS = 3;

/** How long an owed cut keeps being checked for a cancelled job. */
const OWED_RECHECK_DAYS = 60;

/** Lead statuses that mean the job is off: the partner's cut is voided. */
const CANCELLED_LEAD_STATUSES = new Set(["cancelled", "canceled"]);

export interface PayoutPassResult {
  checked: number;
  paid: number;
  voided: number;
  waiting: number;
}

interface CommissionRow {
  id: string;
  lead_id: string;
  installer_id: string;
  status: string;
  collected_cents: number;
  payment_intent_id: string | null;
  created_at: string;
}

type DepositState =
  | { kind: "ok" }
  | { kind: "cancelled"; reason: string; applicationFeeId: string | null }
  | { kind: "disputed" };

/**
 * Is the deposit behind this commission still good? Reads the lead's status
 * and, when there is one, the deposit charge on the installer's account.
 * A Stripe lookup failure is "ok" for the lead check only — it throws so the
 * caller leaves the cut held and tries again next pass.
 */
async function depositState(c: CommissionRow): Promise<DepositState> {
  const { data: lead } = await db().from("leads").select("status").eq("id", c.lead_id).maybeSingle();
  const leadCancelled = !!lead && CANCELLED_LEAD_STATUSES.has(String(lead.status));

  const s = stripe();
  let applicationFeeId: string | null = null;
  if (s && c.payment_intent_id) {
    const { data: installer } = await db().from("profiles").select("stripe_account_id").eq("id", c.installer_id).maybeSingle();
    const account = installer?.stripe_account_id as string | undefined;
    if (account) {
      const pi = await s.paymentIntents.retrieve(c.payment_intent_id, { expand: ["latest_charge"] }, { stripeAccount: account });
      const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
      if (charge) {
        applicationFeeId = typeof charge.application_fee === "string" ? charge.application_fee : (charge.application_fee?.id ?? null);
        if ((charge.amount_refunded ?? 0) > 0) return { kind: "cancelled", reason: "deposit refunded", applicationFeeId };
        if (charge.disputed) return { kind: "disputed" };
      }
    }
  }
  if (leadCancelled) return { kind: "cancelled", reason: "job cancelled", applicationFeeId };
  return { kind: "ok" };
}

/**
 * Void a commission. A cut that was collected from the deposit goes back to
 * the installer by refunding that part of the platform's application fee;
 * an owed one simply stops being owed.
 */
async function voidCommission(c: CommissionRow, reason: string, applicationFeeId: string | null): Promise<boolean> {
  const fromStatus = c.status;
  const { data: claimed } = await db()
    .from("referral_commissions")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", c.id)
    .eq("status", fromStatus)
    .select("id")
    .maybeSingle();
  if (!claimed) return false;
  try {
    if (fromStatus === "held" && c.collected_cents > 0) {
      const s = stripe();
      if (!s || !applicationFeeId) throw new Error("can't find the deposit's platform fee to hand the cut back");
      await s.applicationFees.createRefund(
        applicationFeeId,
        { amount: c.collected_cents, metadata: { referral_commission_id: c.id, reason } },
        { idempotencyKey: `referral-commission-void-${c.id}` },
      );
    }
    await db()
      .from("referral_commissions")
      .update({ status: "void", last_error: reason, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    console.log(`[ReferralPartners] Voided commission ${c.id} (${reason})`);
    return true;
  } catch (err) {
    await db()
      .from("referral_commissions")
      .update({ status: fromStatus, last_error: `void failed: ${err instanceof Error ? err.message : "unknown"}`.slice(0, 300), updated_at: new Date().toISOString() })
      .eq("id", c.id);
    return false;
  }
}

/**
 * The payout pass. For every held cut whose deposit is at least
 * PAYOUT_HOLD_DAYS old: void it if the job was cancelled or the deposit
 * refunded, leave it while the deposit is disputed, otherwise send it.
 * Also voids owed cuts on cancelled jobs, so the installer isn't told to pay
 * for a job that fell through. `partnerIds` limits the pass to one partner.
 */
export async function processDueCommissions(opts: { partnerIds?: string[]; now?: Date; limit?: number } = {}): Promise<PayoutPassResult> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result: PayoutPassResult = { checked: 0, paid: 0, voided: 0, waiting: 0 };

  // Held and owed are fetched separately so a backlog of one can't crowd out the other.
  // Owed cuts are re-checked for cancellation for OWED_RECHECK_DAYS, then left alone.
  const owedSince = new Date(now.getTime() - OWED_RECHECK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const columns = "id, lead_id, installer_id, status, collected_cents, payment_intent_id, created_at";
  const limit = opts.limit ?? 200;
  const heldQ = db().from("referral_commissions").select(columns).eq("status", "held").lte("created_at", cutoff).order("created_at", { ascending: true }).limit(limit);
  const owedQ = db().from("referral_commissions").select(columns).eq("status", "owed").gte("created_at", owedSince).order("created_at", { ascending: true }).limit(limit);
  const [held, owed] = await Promise.all([
    opts.partnerIds ? heldQ.in("partner_id", opts.partnerIds) : heldQ,
    opts.partnerIds ? owedQ.in("partner_id", opts.partnerIds) : owedQ,
  ]);
  if (held.error || owed.error) {
    console.warn("[ReferralPartners] payout pass query failed:", (held.error ?? owed.error)?.message);
    return result;
  }
  const data = [...(held.data ?? []), ...(owed.data ?? [])];

  for (const c of (data ?? []) as CommissionRow[]) {
    result.checked++;
    let state: DepositState;
    try {
      state = await depositState(c);
    } catch (err) {
      console.warn(`[ReferralPartners] deposit check failed for ${c.id}:`, err instanceof Error ? err.message : err);
      result.waiting++;
      continue;
    }
    if (state.kind === "cancelled") {
      if (await voidCommission(c, state.reason, state.applicationFeeId)) result.voided++;
      continue;
    }
    if (c.status !== "held") continue;
    if (state.kind === "disputed") {
      await db()
        .from("referral_commissions")
        .update({ last_error: "deposit disputed — paid out once the dispute is settled", updated_at: now.toISOString() })
        .eq("id", c.id);
      result.waiting++;
      continue;
    }
    if ((await payHeldCommission(c.id)) === "paid") result.paid++;
    else result.waiting++;
  }
  return result;
}

/** Re-read the partner's Stripe account and record whether it can receive payouts. */
export async function refreshPartnerAccount(userId: string): Promise<{ connected: boolean; ready: boolean }> {
  const s = stripe();
  const { data: account } = await db().from("referral_partner_accounts").select("stripe_account_id, payouts_ready").eq("user_id", userId).maybeSingle();
  if (!account?.stripe_account_id) return { connected: false, ready: false };
  if (!s) return { connected: true, ready: !!account.payouts_ready };
  try {
    const acct = await s.accounts.retrieve(account.stripe_account_id);
    const ready = !!acct.details_submitted && !!acct.payouts_enabled;
    if (ready !== !!account.payouts_ready) {
      await db().from("referral_partner_accounts").update({ payouts_ready: ready, updated_at: new Date().toISOString() }).eq("user_id", userId);
    }
    return { connected: true, ready };
  } catch {
    return { connected: true, ready: !!account.payouts_ready };
  }
}

export function partnerStripe(): Stripe | null {
  return stripe();
}
