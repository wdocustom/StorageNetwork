import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendAssetForgeAnnouncementEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/url-helper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════════════════════
// /api/cron/asset-forge-announcement
//
// Manual-trigger only — INTENTIONALLY NOT listed in vercel.json so Vercel
// never auto-schedules it. The operator hits this endpoint once (e.g. when
// the Storage-Network LoRA finishes training) to blast the AI Asset Forge
// launch email to every eligible installer.
//
// Trigger from a terminal:
//   curl -X POST https://storage-network.app/api/cron/asset-forge-announcement \
//        -H "Authorization: Bearer $CRON_SECRET"
//
// Re-running is safe — installers who already received it are filtered out
// via profiles.asset_forge_announcement_sent_at (migration 102). Pass
// ?force=1 to re-send to everyone (use sparingly).
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

interface InstallerRow {
  id: string;
  email: string;
  first_name: string | null;
  business_name: string | null;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET not configured." },
      { status: 500 }
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";

  try {
    let query = db()
      .from("profiles")
      .select("id, email, first_name, business_name")
      .or("is_suspended.is.null,is_suspended.eq.false")
      .not("email", "is", null)
      .order("created_at", { ascending: true })
      .limit(1000);

    if (!force) {
      query = query.is("asset_forge_announcement_sent_at", null);
    }

    const { data: installers, error: profileErr } = await query;

    if (profileErr || !installers) {
      console.error("[AssetForgeBlast] Profile query error:", profileErr?.message);
      return NextResponse.json(
        { success: false, error: profileErr?.message },
        { status: 500 }
      );
    }

    if (installers.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: force ? "No eligible installers." : "All eligible installers already received it.",
      });
    }

    const appUrl = getAppUrl();
    const marketingUrl = `${appUrl}/dashboard/marketing`;
    const now = new Date().toISOString();
    let sent = 0;
    const errors: string[] = [];

    for (const installer of installers as InstallerRow[]) {
      const installerName =
        installer.business_name || installer.first_name || "there";
      const unsubscribeUrl = `${appUrl}/api/unsubscribe-digest?id=${installer.id}`;

      try {
        const result = await sendAssetForgeAnnouncementEmail(installer.email, {
          installerName,
          marketingUrl,
          unsubscribeUrl,
        });

        if (result.success) {
          sent++;
          await db()
            .from("profiles")
            .update({ asset_forge_announcement_sent_at: now })
            .eq("id", installer.id);
        } else {
          errors.push(`${installer.email}: ${result.error}`);
        }
      } catch (err) {
        errors.push(
          `${installer.email}: ${err instanceof Error ? err.message : "Unknown"}`
        );
      }
    }

    const response = {
      success: true,
      timestamp: now,
      total: installers.length,
      sent,
      forced: force,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("[AssetForgeBlast] Completed:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[AssetForgeBlast] Failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
