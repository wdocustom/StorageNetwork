import { NextRequest, NextResponse } from "next/server";
import { recentlyUpdatedPaths, submitIndexNow } from "@/lib/indexnow";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cron/indexnow
// Daily IndexNow ping for pages whose content date (src/lib/sitemap-dates.ts)
// changed in the last 3 days — bump a page's date when you change it, merge,
// and Bing hears about it by the next run. No date changes → no ping (IndexNow
// asks for changed URLs only). Run on demand from Vercel → Settings → Cron Jobs.
// ═══════════════════════════════════════════════════════════════════════════

const WINDOW_DAYS = 3;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  // Only production speaks for storage-network.app
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ success: true, skipped: "not production" });
  }

  const paths = recentlyUpdatedPaths(new Date(), WINDOW_DAYS);
  if (paths.length === 0) {
    return NextResponse.json({ success: true, submitted: 0 });
  }
  try {
    const { status, ok } = await submitIndexNow(paths);
    if (!ok) console.error(`[indexnow] rejected: HTTP ${status}`);
    return NextResponse.json({ success: ok, status, submitted: paths.length, paths }, { status: ok ? 200 : 502 });
  } catch (err) {
    console.error("[indexnow] request failed:", err);
    return NextResponse.json({ success: false, error: "IndexNow request failed" }, { status: 502 });
  }
}
