import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Middleware — Affiliate Cookie Tracking
// When ?installer_id=UUID is present, save to cookie for 30-day attribution
// ═══════════════════════════════════════════════════════════════════════════

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Check for installer_id in query params
  const installerId = request.nextUrl.searchParams.get("installer_id");

  if (installerId) {
    // Validate UUID format (basic check)
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidPattern.test(installerId)) {
      // Set the affiliate cookie
      response.cookies.set({
        name: siteConfig.cookies.partnerRef.name,
        value: installerId,
        maxAge: siteConfig.cookies.partnerRef.maxAge, // 30 days
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }
  }

  return response;
}

// Only run middleware on design and checkout pages
export const config = {
  matcher: ["/design/:path*", "/checkout/:path*"],
};
