import { NextRequest, NextResponse } from "next/server";
import { getCacheConfig } from "@/lib/edge-config";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cron/prewarm
// Pre-warms the CDN cache for high-traffic pages (/design, /join).
//
// Reads the list of paths from Edge Config (or uses built-in defaults),
// then fires a HEAD request to each so Vercel's CDN caches the response
// before real users hit a cold cache.
//
// Called by Vercel Cron every 5 minutes or on-demand.
// ═══════════════════════════════════════════════════════════════════════════

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const baseUrl = getBaseUrl();
  const config = await getCacheConfig();
  const paths = config.prewarmPaths;

  const results = await Promise.allSettled(
    paths.map(async (path) => {
      const url = `${baseUrl}${path}`;
      const start = Date.now();

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "StorageNetwork-Prewarm/1.0",
          // Tell CDN this is a warm-up request (informational)
          "X-Prewarm": "1",
        },
        // Don't follow redirects — we just need the CDN to cache the origin response
        redirect: "manual",
      });

      return {
        path,
        status: res.status,
        durationMs: Date.now() - start,
        cacheStatus: res.headers.get("x-vercel-cache") ?? "unknown",
      };
    })
  );

  const summary = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return { path: paths[i], error: String(r.reason), status: 0, durationMs: 0 };
  });

  return NextResponse.json({
    success: true,
    warmed: summary.length,
    paths: summary,
    timestamp: new Date().toISOString(),
  });
}
