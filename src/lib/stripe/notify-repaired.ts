import type { getServiceClient } from "@/lib/supabase-server";
import {
  sendBookingConfirmation,
  sendNewBookingAlert,
  quoteDataToBookingUnits,
} from "@/lib/email";

// ── Notifications for a repaired booking ───────────────────────────────────
// A deposit that was never recorded also never triggered its emails: the
// customer has a Stripe receipt but no booking confirmation, and the installer
// was never told the job exists. Both are sent here, guarded by the same
// `booking_email_sent` flag the webhook uses, so a lead can never be mailed
// twice no matter which path records it.
export async function notifyRepairedBooking(
  db: ReturnType<typeof getServiceClient>,
  leadId: string
): Promise<void> {
  const { data: lead } = await db
    .from("leads")
    .select(
      "customer_name, customer_email, address, quote_data, estimated_price, deposit_amount, installer_id, scheduled_at, booking_email_sent, dimensions"
    )
    .eq("id", leadId)
    .single();

  if (!lead || lead.booking_email_sent || !lead.customer_email) return;

  let installerName = "Your Installer";
  let installerPhone: string | undefined;
  let installerAvatar: string | undefined;

  if (lead.installer_id) {
    const { data: profile } = await db
      .from("profiles")
      .select("first_name, last_name, business_name, phone, avatar_url")
      .eq("id", lead.installer_id)
      .single();
    if (profile) {
      installerName =
        profile.business_name ||
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        "Your Installer";
      installerPhone = profile.phone || undefined;
      installerAvatar = profile.avatar_url || undefined;
    }
  }

  const unitCount = Array.isArray(lead.quote_data) ? lead.quote_data.length : 1;
  const snapshotUrl = (lead.dimensions as Record<string, unknown> | null)?.build_snapshot_url as
    | string
    | undefined;

  await sendBookingConfirmation({
    customerName: lead.customer_name ?? "Customer",
    customerEmail: lead.customer_email,
    installerName,
    installerPhone,
    installerAvatarUrl: installerAvatar,
    scheduledDate: lead.scheduled_at ?? "TBD",
    address: lead.address ?? "Address Pending",
    depositAmount: lead.deposit_amount ?? 0,
    totalPrice: lead.estimated_price ?? lead.deposit_amount ?? 0,
    jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
    units: quoteDataToBookingUnits(lead.quote_data),
    leadId,
    buildSnapshotUrl: snapshotUrl,
  });

  if (lead.installer_id) {
    const { data: authUser } = await db.auth.admin.getUserById(lead.installer_id);
    const installerEmail = authUser?.user?.email;
    if (installerEmail) {
      const city = lead.address
        ? lead.address.split(",").slice(-2, -1)[0]?.trim() || lead.address
        : "Unknown";
      await sendNewBookingAlert(installerEmail, city, {
        customerName: lead.customer_name ?? "Customer",
        customerEmail: lead.customer_email || undefined,
        address: lead.address || undefined,
        unitCount,
        totalPrice: lead.estimated_price ?? lead.deposit_amount ?? 0,
        leadId,
        buildSnapshotUrl: snapshotUrl,
      });
    }
  }

  await db.from("leads").update({ booking_email_sent: true }).eq("id", leadId);
}
