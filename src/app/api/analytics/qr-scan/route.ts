import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/analytics/qr-scan
// Logs a QR code scan event. Called from middleware when ?qr=1 is detected.
// ═══════════════════════════════════════════════════════════════════════════

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + (process.env.ANALYTICS_SALT || "sn-analytics-2026"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function classifyDevice(ua: string | null): string {
  if (!ua) return "desktop";
  const lower = ua.toLowerCase();
  if (lower.includes("mobile") || lower.includes("iphone") || lower.includes("android")) return "mobile";
  if (lower.includes("tablet") || lower.includes("ipad")) return "tablet";
  return "desktop";
}

interface QRScanBody {
  installerId: string;
  pagePath: string;
  referrer?: string;
  userAgent?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as QRScanBody;
    if (!body.installerId || !body.pagePath) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const city = req.headers.get("x-vercel-ip-city") || null;
    const region = req.headers.get("x-vercel-ip-country-region") || null;
    const country = req.headers.get("x-vercel-ip-country") || null;
    const ua = body.userAgent || req.headers.get("user-agent") || null;
    const ipHash = await hashIP(ip);

    const supabase = getServiceClient();
    await supabase.from("qr_scans").insert({
      installer_id: body.installerId,
      page_path: body.pagePath.slice(0, 500),
      referrer: body.referrer?.slice(0, 1000) || null,
      user_agent: ua?.slice(0, 512) || null,
      device_type: classifyDevice(ua),
      city: city ? decodeURIComponent(city) : null,
      region,
      country,
      ip_hash: ipHash,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
