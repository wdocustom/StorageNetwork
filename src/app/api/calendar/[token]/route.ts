import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { verifyTrackToken, trackInstallUrl } from "@/lib/server/request-link";
import { installerInfo } from "@/lib/server/install-tracking";
import { googleCalendarUrl, installEvent, installIcs, outlookCalendarUrl, pickCalendar } from "@/lib/install-calendar";

// The "Add to calendar" button in the install-date emails. Sends the customer
// straight to their own calendar (pickCalendar: email provider, then device):
// Google / Outlook open pre-filled, everyone else gets <token>.ics, which
// Apple Calendar (or the OS's default calendar app) opens. Same signed token
// as /track, and the same UID as the emailed invite.

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const raw = (await params).token;
  const wantsFile = raw.endsWith(".ics");
  const leadId = verifyTrackToken(raw.replace(/\.ics$/, ""));
  if (!leadId) return new NextResponse("Not found", { status: 404 });

  const db = getServiceClient();
  const { data: lead } = await db
    .from("leads")
    .select("id, installer_id, deposit_paid, scheduled_at, customer_email, address, delivery_address_line1, delivery_address_city, delivery_address_state")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead?.installer_id || !lead.deposit_paid || !lead.scheduled_at) return new NextResponse("Not found", { status: 404 });

  // time_preference is optional on older databases — read it separately.
  const { data: pref } = await db.from("leads").select("time_preference").eq("id", leadId).maybeSingle();
  const installer = await installerInfo(lead.installer_id as string);
  const event = installEvent({
    leadId,
    date: lead.scheduled_at as string,
    installerName: installer.name,
    timePreference: (pref?.time_preference as string | null) ?? null,
    address:
      [lead.delivery_address_line1, lead.delivery_address_city, lead.delivery_address_state].filter(Boolean).join(", ") ||
      (lead.address as string) ||
      "",
    trackUrl: trackInstallUrl(leadId),
  });
  if (!event) return new NextResponse("Not found", { status: 404 });

  if (!wantsFile) {
    const kind = pickCalendar(lead.customer_email as string | null, req.headers.get("user-agent"));
    const to =
      kind === "google"
        ? googleCalendarUrl(event)
        : kind === "outlook"
          ? outlookCalendarUrl(event)
          : icsUrl(req.url);
    return NextResponse.redirect(to, { status: 302, headers: { "Cache-Control": "no-store" } });
  }

  return new NextResponse(installIcs(event, { method: "PUBLISH" }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="storage-rack-install.ics"',
      "Cache-Control": "no-store",
    },
  });
}

/** Same link with .ics on the end, so phones treat it as a calendar file. */
function icsUrl(current: string): string {
  const u = new URL(current);
  u.pathname = u.pathname.replace(/\/?$/, ".ics");
  u.search = "";
  return u.toString();
}
