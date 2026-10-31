import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getPlanById } from "@/lib/plans-config";
import { sendLadderJigAccessEmail, sendPlanAccessEmail, sendTotePlanAccessEmail } from "@/lib/emails/plansTemplates";
import { LADDER_JIG_PLAN_ID } from "@/lib/ladder-jig";
import { TOTE_PLAN_ID, isTotePlanTier, parseTotePlanDesign } from "@/lib/tote-plans";

export async function POST(request: NextRequest) {
  try {
    const { email, planId } = await request.json() as { email: string; planId?: string };
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Find all purchases for this email (optionally filtered by plan)
    let query = supabase
      .from("public_plan_purchases")
      .select("access_token, plan_id, tier, build_config")
      .eq("email", email.toLowerCase().trim());

    if (planId) query = query.eq("plan_id", planId);

    const { data: purchases } = await query;

    if (!purchases || purchases.length === 0) {
      // Don't reveal whether the email exists — always return success
      return NextResponse.json({ success: true });
    }

    // Send one email per purchased plan; record the ones that went out.
    const to = email.toLowerCase().trim();
    for (const purchase of purchases) {
      let sent: { success: boolean } | null = null;
      if (purchase.plan_id === LADDER_JIG_PLAN_ID) {
        sent = await sendLadderJigAccessEmail(to, purchase.access_token);
      } else if (purchase.plan_id === TOTE_PLAN_ID) {
        const design = parseTotePlanDesign(purchase.build_config);
        if (design && isTotePlanTier(purchase.tier)) {
          sent = await sendTotePlanAccessEmail(to, design, purchase.tier, purchase.access_token);
        }
      } else {
        const plan = getPlanById(purchase.plan_id);
        if (plan) sent = await sendPlanAccessEmail(to, plan, purchase.access_token);
      }
      if (sent?.success) {
        await supabase.from("public_plan_purchases").update({ email_sent: true }).eq("access_token", purchase.access_token);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PlansResendLink]", err);
    return NextResponse.json({ error: "Failed to resend link." }, { status: 500 });
  }
}
