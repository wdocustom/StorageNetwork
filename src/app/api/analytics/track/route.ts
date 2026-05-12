import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { isBot } from "@/lib/bot-detection";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/analytics/track
// Lightweight tracking endpoint for platform-wide page views.
// Captures device, geo (Vercel headers), referrer, UTM, bot detection.
//
// Writes directly to DB on every request — no in-memory buffering.
// Serverless functions freeze between invocations, so setTimeout-based
// flush buffers silently lose data. One insert per request is fine at
// this traffic scale and ensures every page view is captured.
//
// IP storage note: we keep both the raw IP (for the admin Visitor Intel
// view — competitor / spy detection) and a salted hash (legacy field,
// kept for backward compat with rows from before migration 107). Raw IP
// is PII; the privacy policy / terms must disclose this.
// ═══════════════════════════════════════════════════════════════════════════

// Simple SHA-256 hash for IP privacy
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + (process.env.ANALYTICS_SALT || "sn-analytics-2026"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function classifyDevice(ua: string | null, screenWidth: number | null): string {
  if (screenWidth) {
    if (screenWidth < 768) return "mobile";
    if (screenWidth < 1024) return "tablet";
    return "desktop";
  }
  if (!ua) return "desktop";
  const lower = ua.toLowerCase();
  if (lower.includes("mobile") || lower.includes("iphone") || lower.includes("android")) return "mobile";
  if (lower.includes("tablet") || lower.includes("ipad")) return "tablet";
  return "desktop";
}

interface TrackBody {
  pagePath: string;
  visitorId?: string;
  sessionId?: string;
  referrer?: string;
  userAgent?: string;
  screenWidth?: number;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TrackBody;
    if (!body.pagePath) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Extract IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Geo from Vercel headers
    const city = req.headers.get("x-vercel-ip-city") || null;
    const region = req.headers.get("x-vercel-ip-country-region") || null;
    const country = req.headers.get("x-vercel-ip-country") || null;

    // UA + bot detection
    const ua = body.userAgent || req.headers.get("user-agent") || null;
    const botDetected = isBot(ua);

    const ipHash = await hashIP(ip);

    const row = {
      page_path: body.pagePath.slice(0, 500),
      visitor_id: body.visitorId?.slice(0, 64) || null,
      ip: ip === "unknown" ? null : ip.slice(0, 64),
      ip_hash: ipHash,
      device_type: classifyDevice(ua, body.screenWidth ?? null),
      user_agent: ua?.slice(0, 512) || null,
      screen_width: body.screenWidth || null,
      city: city ? decodeURIComponent(city) : null,
      region,
      country,
      referrer: body.referrer?.slice(0, 1000) || null,
      utm_source: body.utmSource?.slice(0, 100) || null,
      utm_medium: body.utmMedium?.slice(0, 100) || null,
      utm_campaign: body.utmCampaign?.slice(0, 200) || null,
      is_bot: botDetected,
      session_id: body.sessionId?.slice(0, 64) || null,
    };

    // Write directly — no buffering. Serverless instances freeze between
    // requests, so setTimeout-based flushes silently drop buffered rows.
    const supabase = getServiceClient();
    await supabase.from("platform_page_views").insert(row);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
