import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Middleware — Affiliate Cookie Tracking + Pro Community Gatekeeper
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

  // ── Pro Community Gatekeeper ───────────────────────────────────────────
  // Redirect non-Pro users to the upgrade page when accessing /community
  if (request.nextUrl.pathname.startsWith("/community")) {
    // Read the Supabase auth token from cookies
    const accessToken =
      request.cookies.get("sb-access-token")?.value ||
      request.cookies.get(
        `sb-${(process.env.NEXT_PUBLIC_SUPABASE_URL || "")
          .replace("https://", "")
          .split(".")[0]}-auth-token`
      )?.value;

    // No auth token → redirect to login
    if (!accessToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify the user is Pro via Supabase service role
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Decode the JWT to get the user ID (the sub claim)
      const tokenPayload = JSON.parse(
        Buffer.from(accessToken.split(".")[1], "base64").toString()
      );
      const userId = tokenPayload.sub;

      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_pro")
          .eq("id", userId)
          .single();

        if (!profile?.is_pro) {
          return NextResponse.redirect(
            new URL("/community/upgrade", request.url)
          );
        }
      } else {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    } catch {
      // If token decode fails, let the page-level auth handle it
    }
  }

  return response;
}

// Run middleware on design, checkout, partner signup, and community pages
export const config = {
  matcher: [
    "/design/:path*",
    "/checkout/:path*",
    "/partner/join",
    "/community/:path*",
  ],
};
