import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════
// /api/unsubscribe-digest?id=<installer_id>
//
// GET  → renders a confirmation page with a POST form. This protects against
//        email link prefetchers (Gmail, Outlook, Apple Mail) and corporate
//        security scanners (Defender, Mimecast, Proofpoint, etc.) that visit
//        every URL in an email — a bare GET would silently unsubscribe
//        recipients without their consent.
// POST → performs the actual unsubscribe.
// ═══════════════════════════════════════════════════════════════════════════

function confirmPage(id: string, message?: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Unsubscribe</title></head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;font-family:sans-serif;color:#e2e8f0;">
  <div style="text-align:center;max-width:420px;padding:40px;">
    <h1 style="color:#facc15;margin:0 0 16px;">Unsubscribe from weekly digest?</h1>
    <p style="color:#cbd5e1;">${message || "Click the button below to stop receiving the weekly scorecard email."}</p>
    <form method="POST" action="/api/unsubscribe-digest?id=${encodeURIComponent(id)}" style="margin-top:24px;">
      <button type="submit" style="background:#facc15;color:#1e293b;border:0;padding:12px 28px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;">
        Yes, unsubscribe me
      </button>
    </form>
  </div>
</body>
</html>`;
}

function successPage(): string {
  return `<!DOCTYPE html>
<html>
<head><title>Unsubscribed</title></head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;font-family:sans-serif;color:#e2e8f0;">
  <div style="text-align:center;max-width:400px;padding:40px;">
    <h1 style="color:#facc15;margin:0 0 16px;">Unsubscribed</h1>
    <p>You've been removed from the weekly digest. You can re-subscribe anytime from your dashboard settings.</p>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return new NextResponse("Missing installer ID", { status: 400 });
  }
  return new NextResponse(confirmPage(id), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return new NextResponse("Missing installer ID", { status: 400 });
  }

  const supabase = getServiceClient();
  await supabase
    .from("profiles")
    .update({ weekly_digest_opted_out: true })
    .eq("id", id);

  return new NextResponse(successPage(), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}
