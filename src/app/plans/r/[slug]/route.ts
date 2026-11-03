import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { PLAN_REF_COOKIE } from "@/lib/plan-splits";

// ═══════════════════════════════════════════════════════════════════════════
// DIY-plans referral link — /plans/r/<installer slug>
//
// Remembers the installer (sn_plans_ref, same cookie /plans/checkout's ?ref
// sets) and sends the customer to /plans. Any plan they buy from this
// browser credits the installer — see planSplitShares. Unknown slugs and
// realtors still land on /plans, just without credit.
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const response = NextResponse.redirect(new URL("/plans", request.url));

  const { data: profile } = await getServiceClient()
    .from("profiles")
    .select("id, is_realtor")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (profile && profile.is_realtor !== true) {
    // Readable by /plans/checkout, which renews it on every visit
    response.cookies.set({
      name: PLAN_REF_COOKIE,
      value: profile.id,
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
      sameSite: "lax",
    });
  }
  return response;
}
