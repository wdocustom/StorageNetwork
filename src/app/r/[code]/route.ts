import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getInstallerLink } from "@/lib/utils";
import { normalizePartnerCode, PARTNER_REF_COOKIE, PARTNER_REF_MAX_AGE_SECONDS } from "@/lib/referral-partners";

// ═══════════════════════════════════════════════════════════════════════════
// GET /r/<code> — referral partner share link (migration 168).
// Drops the attribution cookie and sends the customer to that installer's
// page. At checkout the booking screen applies the partner discount from the
// cookie, and createDepositIntent attributes the deposit to the partner.
// An unknown or switched-off code just lands on the homepage, no cookie.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizePartnerCode((await params).code);
  const home = new URL("/", req.nextUrl.origin);
  if (!code) return NextResponse.redirect(home);

  let destination: string | null = null;
  try {
    const db = getServiceClient();
    const { data: partner } = await db.from("referral_partners").select("installer_id, active").eq("code", code).maybeSingle();
    if (partner?.active) {
      const { data: installer } = await db.from("profiles").select("id, slug, is_pro").eq("id", partner.installer_id).maybeSingle();
      if (installer) destination = getInstallerLink(installer);
    }
  } catch {
    destination = null;
  }
  if (!destination) return NextResponse.redirect(home);

  const url = new URL(destination, req.nextUrl.origin);
  url.searchParams.set("ref", code);
  const res = NextResponse.redirect(url);
  res.cookies.set({
    name: PARTNER_REF_COOKIE,
    value: code,
    maxAge: PARTNER_REF_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    httpOnly: false, // the booking screen reads it to pre-apply the discount
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
