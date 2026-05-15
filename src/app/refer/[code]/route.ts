import { NextRequest, NextResponse } from "next/server";
import { resolveRealtorReferralCode } from "@/app/actions/realtor-referrals";

// ═══════════════════════════════════════════════════════════════════════════
// GET /refer/<code>
// Realtor share-link landing. Validates the code, drops an attribution
// cookie, and bounces to the homepage so the customer continues a normal
// installer-search flow. The booking page later reads the cookie and
// passes the code through to submitNetworkLead.
// ═══════════════════════════════════════════════════════════════════════════

const COOKIE_NAME = "sn_realtor_ref";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const raw = params.code || "";
  const normalized = raw.trim().toUpperCase();

  const baseUrl = req.nextUrl.origin;
  const redirectUrl = new URL("/", baseUrl);

  const resolved = await resolveRealtorReferralCode(normalized);
  if (!resolved) {
    // Unknown / inactive code: still send them to the homepage so a typo or
    // a deactivated realtor doesn't drop into a 404. Just don't set a cookie.
    return NextResponse.redirect(redirectUrl);
  }

  redirectUrl.searchParams.set("ref", normalized);

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set({
    name: COOKIE_NAME,
    value: normalized,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    httpOnly: false, // booking page is a client component; needs to read it
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
