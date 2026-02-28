import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Middleware — Affiliate Cookie Tracking
// ═══════════════════════════════════════════════════════════════════════════

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // ── Affiliate Cookie Tracking ──────────────────────────────────────────
  const installerId = request.nextUrl.searchParams.get("installer_id");

  if (installerId) {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidPattern.test(installerId)) {
      response.cookies.set({
        name: siteConfig.cookies.partnerRef.name,
        value: installerId,
        maxAge: siteConfig.cookies.partnerRef.maxAge,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }
  }

  return response;
}

// Run middleware on design, checkout, and partner signup pages
export const config = {
  matcher: [
    "/design/:path*",
    "/checkout/:path*",
    "/partner/join",
  ],
};
