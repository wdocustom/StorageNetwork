import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Affiliate / Partner Slug Route — /join/[slug]
//
// One URL pattern that serves two systems:
//
//   1. Legacy partners (Joe Long / Elite). Slug lives on the `partners` row.
//      Sets the 30-day sn_affiliate_slug cookie. Existing behavior.
//
//   2. Phase 6.6 — new affiliates with an active agreement. Slug is the
//      installer's own profiles.slug (the same one that powers /p/[slug]).
//      Sets a 90-day sn_affiliate_link cookie holding the affiliate's
//      profile id. onboard-installer reads this and attributes the
//      recruit via the same code path as a Phase 6 invite token.
//
// Partners-table lookup wins when both routes could match the same slug
// (legacy stays canonical). New affiliates can't accidentally hijack a
// legacy partner's URL.
//
// No-match still redirects to /partner/join (no attribution) so the URL
// always lands somewhere useful even after a typo or expired link.
// ═══════════════════════════════════════════════════════════════════════════

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const slugLower = slug.toLowerCase();

  const supabase = getSupabase();

  // ── 1. Legacy partners-table lookup ───────────────────────────────────────
  const { data: partner } = await supabase
    .from("partners")
    .select("id, slug, name, company")
    .eq("slug", slugLower)
    .maybeSingle();

  const redirectUrl = new URL("/partner/join", request.url);

  if (partner) {
    // Pass partner name through so the signup page can render
    // "Pro trial courtesy of …" even before the cookie is read server-side.
    const partnerDisplay = partner.company || partner.name;
    redirectUrl.searchParams.set("ref", partnerDisplay);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: "sn_affiliate_slug",
      value: partner.slug,
      maxAge: 60 * 60 * 24 * 30, // 30 days (legacy default)
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    return response;
  }

  // ── 2. New affiliate — profile-slug lookup (Phase 6.6) ────────────────────
  // We only consider profiles whose owner has an *active* affiliate agreement.
  // Otherwise random installer slugs would set cookies that go nowhere at
  // signup-attribution time.
  const { data: affiliate } = await supabase
    .from("profiles")
    .select("id, slug, business_name, first_name, last_name")
    .eq("slug", slugLower)
    .maybeSingle();

  if (affiliate) {
    const { data: activeAgreement } = await supabase
      .from("affiliate_agreements")
      .select("id")
      .eq("affiliate_id", affiliate.id)
      .eq("status", "active")
      .maybeSingle();

    if (activeAgreement) {
      const display =
        (affiliate.business_name as string | null) ||
        [affiliate.first_name, affiliate.last_name].filter(Boolean).join(" ") ||
        "An installer";
      redirectUrl.searchParams.set("ref", display);
      const response = NextResponse.redirect(redirectUrl);
      // sn_affiliate_link carries the affiliate's profile id directly —
      // onboard-installer.ts reads this and attributes the recruit. 90-day
      // cookie matches the Phase 6 invite-token cookie's TTL.
      response.cookies.set({
        name: "sn_affiliate_link",
        value: affiliate.id as string,
        maxAge: 60 * 60 * 24 * 90, // 90 days
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      return response;
    }
  }

  // ── 3. No match — bare redirect, no cookie set ────────────────────────────
  return NextResponse.redirect(redirectUrl);
}
