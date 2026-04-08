import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { siteConfig } from "@/config/site";
import { rateLimit } from "@/lib/rate-limit";
import { getCacheConfig, buildCacheHeader } from "@/lib/edge-config";

// ═══════════════════════════════════════════════════════════════════════════
// Middleware — Auth Guard + Rate Limiting + Cache Control + Affiliate Cookies
// ═══════════════════════════════════════════════════════════════════════════

// Rate limit tiers (requests per 60-second window)
const API_LIMIT = 100; // API routes — tuned for 2.5M subscriber base
const PAGE_LIMIT = 200; // Page requests — generous for viral traffic

// Paths whose Cache-Control is driven by Edge Config
const EDGE_CACHED_PATHS = new Set(["/design", "/join"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Rate Limiting ────────────────────────────────────────────────────────
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const isApi = pathname.startsWith("/api/");
  const limit = isApi ? API_LIMIT : PAGE_LIMIT;
  const tier = isApi ? "api" as const : "page" as const;
  const key = `${ip}:${tier}`;

  const result = await rateLimit(key, limit, 60_000, tier);

  if (!result.allowed) {
    return new NextResponse("Too many requests. Please try again shortly.", {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  // ── Dashboard Auth Guard ─────────────────────────────────────────────
  // Server-side redirect — prevents unauthenticated access before any HTML
  // is sent. Runs on Edge, uses Supabase SSR cookie-based session check.
  if (pathname.startsWith("/dashboard")) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
          setAll: () => {}, // Read-only in middleware — no cookie writes needed
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();

  // Rate limit headers (informational)
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));

  // ── Edge Config Cache Control ──────────────────────────────────────────
  // Dynamic cache headers for /design and /join — tunable from Vercel dashboard
  if (EDGE_CACHED_PATHS.has(pathname)) {
    const cacheConfig = await getCacheConfig();
    const rule = cacheConfig.paths[pathname];
    if (rule) {
      response.headers.set("Cache-Control", buildCacheHeader(rule));
      response.headers.set("CDN-Cache-Control", buildCacheHeader(rule));
    }
  }

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

// Run middleware on all public pages + API routes
export const config = {
  matcher: [
    // Public pages
    "/",
    "/design/:path*",
    "/checkout/:path*",
    "/partner/join",
    "/p/:path*",
    "/join",
    "/demo",
    "/features",
    "/technology",
    "/about/:path*",
    // API routes
    "/api/:path*",
    // Dashboard (auth-guarded)
    "/dashboard/:path*",
  ],
};
