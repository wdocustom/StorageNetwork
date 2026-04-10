import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/unsubscribe-digest?id=<installer_id>
// One-click unsubscribe from the weekly activity digest email.
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    return new NextResponse("Missing installer ID", { status: 400 });
  }

  const supabase = getServiceClient();
  await supabase
    .from("profiles")
    .update({ weekly_digest_opted_out: true })
    .eq("id", id);

  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head><title>Unsubscribed</title></head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;font-family:sans-serif;color:#e2e8f0;">
  <div style="text-align:center;max-width:400px;padding:40px;">
    <h1 style="color:#facc15;margin:0 0 16px;">Unsubscribed</h1>
    <p>You've been removed from the weekly digest. You can re-subscribe anytime from your dashboard settings.</p>
  </div>
</body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }
  );
}
