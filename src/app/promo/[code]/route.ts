import { NextRequest, NextResponse } from "next/server";
import { resolvePromoterReferralCode } from "@/app/actions/promoter-program";

// ═══════════════════════════════════════════════════════════════════════════
// GET /promo/<code>
// Promoter share-link landing. Validates the code, drops an attribution
// cookie, and bounces to /plans so the visitor continues straight into the
// purchase flow. The plan-checkout actions read this cookie server-side and
// stash the promoter id in the Stripe session metadata for the webhook.
// ═══════════════════════════════════════════════════════════════════════════

const COOKIE_NAME = "sn_promoter_ref";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const raw = params.code || "";
  const normalized = raw.trim().toUpperCase();

  const baseUrl = req.nextUrl.origin;
  const redirectUrl = new URL("/plans", baseUrl);

  const resolved = await resolvePromoterReferralCode(normalized);
  if (!resolved) {
    // Unknown / inactive code: still send them through so a typo or a
    // deactivated promoter doesn't drop into a 404. Just no cookie.
    return NextResponse.redirect(redirectUrl);
  }

  redirectUrl.searchParams.set("promo", normalized);

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set({
    name: COOKIE_NAME,
    value: normalized,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
