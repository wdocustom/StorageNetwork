import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Vanity Affiliate Route — /join/[slug]
//
// When someone visits /join/elite:
//   1. Validate the partner slug exists in the partners table
//   2. Set a 30-day cookie: sn_affiliate_slug = 'elite'
//   3. Redirect to /partner/join (installer signup page)
//
// The cookie is later read by onboardInstaller() to create the referral link.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Validate partner slug
  const { data: partner } = await supabase
    .from("partners")
    .select("id, slug")
    .eq("slug", slug.toLowerCase())
    .single();

  // Always redirect to signup — even if slug is invalid, we still want
  // the person to land on the signup page (just without attribution)
  const redirectUrl = new URL("/partner/join", request.url);
  const response = NextResponse.redirect(redirectUrl);

  if (partner) {
    // Set stealth affiliate cookie — 30 days, httpOnly
    response.cookies.set({
      name: "sn_affiliate_slug",
      value: partner.slug,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }

  return response;
}
