"use server";

import Stripe from "stripe";
import { getServiceClient } from "@/lib/supabase-server";
import { getPlanById } from "@/lib/plans-config";
import { sendPlanAccessEmail } from "@/lib/emails/plansTemplates";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

export async function verifyAndCreatePlanAccess(
  sessionId: string,
  planId: string,
): Promise<{ success: boolean; token?: string; email?: string; error?: string }> {
  const plan = getPlanById(planId);
  if (!plan) return { success: false, error: "Plan not found." };

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (
      session.payment_status !== "paid" ||
      session.metadata?.type !== "public_plan" ||
      session.metadata?.plan_id !== planId
    ) {
      return { success: false, error: "Payment not confirmed." };
    }

    const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase();
    if (!email) return { success: false, error: "No email on session." };

    const supabase = getServiceClient();

    // Upsert — idempotent on stripe_session_id (unique constraint)
    const { data: existing } = await supabase
      .from("public_plan_purchases")
      .select("access_token, email_sent")
      .eq("stripe_session_id", sessionId)
      .single();

    if (existing) {
      // Already processed — just return the token (don't resend email)
      return { success: true, token: existing.access_token, email };
    }

    // First time — insert and send email. Promoter attribution (if any)
    // rides in the session metadata (set at checkout-creation time by
    // /api/plans/checkout) — snapshot it here for the audit trail. The
    // commission itself is computed and paid independently by the Stripe
    // webhook, which doesn't depend on this row existing.
    const promoterId = session.metadata?.promoter_id || null;
    const promoterCode = session.metadata?.promoter_referral_code || null;

    const { data: inserted, error: insertError } = await supabase
      .from("public_plan_purchases")
      .insert({
        email,
        plan_id: planId,
        stripe_session_id: sessionId,
        email_sent: false,
        referred_by_promoter_id: promoterId,
        promoter_referral_code_snapshot: promoterCode,
      })
      .select("access_token")
      .single();

    if (insertError || !inserted) {
      console.error("[PublicPlans] Insert error:", insertError);
      return { success: false, error: "Failed to record purchase." };
    }

    const token = inserted.access_token as string;

    // Send email (fire and forget — don't block the page render)
    sendPlanAccessEmail(email, plan, token)
      .then(() =>
        supabase
          .from("public_plan_purchases")
          .update({ email_sent: true })
          .eq("access_token", token),
      )
      .catch((err) => console.error("[PublicPlans] Email error:", err));

    return { success: true, token, email };
  } catch (err) {
    console.error("[PublicPlans] Verify error:", err);
    return { success: false, error: "Verification failed." };
  }
}

export async function validatePlanToken(
  token: string,
): Promise<{ valid: boolean; planId?: string }> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("public_plan_purchases")
      .select("plan_id")
      .eq("access_token", token)
      .single();

    if (!data) return { valid: false };
    return { valid: true, planId: data.plan_id };
  } catch {
    return { valid: false };
  }
}
