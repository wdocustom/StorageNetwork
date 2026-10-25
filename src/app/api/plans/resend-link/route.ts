import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getPlanById } from "@/lib/plans-config";
import { sendPlanAccessEmail, sendTotePlanAccessEmail } from "@/lib/emails/plansTemplates";
import { TOTE_PLAN_ID, isTotePlanTier, parseTotePlanConfig } from "@/lib/tote-plans";

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

    // Send one email per purchased plan
    for (const purchase of purchases) {
      if (purchase.plan_id === TOTE_PLAN_ID) {
        const config = parseTotePlanConfig(purchase.build_config);
        if (config && isTotePlanTier(purchase.tier)) {
          await sendTotePlanAccessEmail(email.toLowerCase().trim(), config, purchase.tier, purchase.access_token);
        }
        continue;
      }
      const plan = getPlanById(purchase.plan_id);
      if (!plan) continue;
      await sendPlanAccessEmail(email.toLowerCase().trim(), plan, purchase.access_token);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PlansResendLink]", err);
    return NextResponse.json({ error: "Failed to resend link." }, { status: 500 });
  }
}
