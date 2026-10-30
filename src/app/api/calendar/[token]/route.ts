import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { verifyTrackToken, trackInstallUrl } from "@/lib/server/request-link";
import { installerInfo } from "@/lib/server/install-tracking";
import { installEvent, installIcs } from "@/lib/install-calendar";

// The "Apple" Add to calendar button in the install-date emails: the install
// day as a .ics file. Same signed token as /track, and the same UID as the
// emailed invite, so adding both doesn't duplicate the event.

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const leadId = verifyTrackToken((await params).token.replace(/\.ics$/, ""));
  if (!leadId) return new NextResponse("Not found", { status: 404 });

  const db = getServiceClient();
  const { data: lead } = await db
    .from("leads")
    .select("id, installer_id, deposit_paid, scheduled_at, address, delivery_address_line1, delivery_address_city, delivery_address_state")
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

  return new NextResponse(installIcs(event, { method: "PUBLISH" }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="storage-rack-install.ics"',
      "Cache-Control": "no-store",
    },
  });
}
