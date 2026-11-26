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
//   payHeldCommission        sends a collected cut to the partner's Stripe
//   releaseHeldCommissions   retries everything held for a partner (called
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
    if (inserted.status === "held") await payHeldCommission(inserted.id as string);
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

/** Retry every held cut for the partner logged in as `userId`. */
export async function releaseHeldCommissions(userId: string): Promise<number> {
  try {
    const { data: partners } = await db().from("referral_partners").select("id").eq("user_id", userId);
    const ids = (partners ?? []).map((p) => p.id as string);
    if (!ids.length) return 0;
    const { data: held } = await db().from("referral_commissions").select("id").in("partner_id", ids).eq("status", "held").limit(50);
    let paid = 0;
    for (const c of held ?? []) if ((await payHeldCommission(c.id as string)) === "paid") paid++;
    return paid;
  } catch {
    return 0;
  }
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
