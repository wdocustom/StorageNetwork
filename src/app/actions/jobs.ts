"use server";

import { createClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════════════════════════════
// completeJobWithProof — Upload proof sets status to payment_pending
// Does NOT set completed_at. Job stays "active" until paid.
// Sends invoice email to customer.
// ═══════════════════════════════════════════════════════════════════════════

export async function completeJobWithProof(
  leadId: string,
  photoUrl: string,
  customerEmail: string | null,
  customerName: string,
  amountDue: number,
  paymentUrl?: string
) {
  // 1. Update DB — mark proof uploaded, status = payment_pending
  await supabase
    .from("leads")
    .update({
      status: "payment_pending",
      photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  // 2. Send invoice email to customer (non-blocking)
  if (customerEmail && amountDue > 0) {
    try {
      const payLink = paymentUrl
        ? `<a href="${paymentUrl}" style="display:block;background:#facc15;color:#1a1a1a;text-align:center;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;font-size:15px;">Pay $${amountDue.toLocaleString()} Now →</a>`
        : "";

      await sendTransactionalEmail({
        to: customerEmail,
        toName: customerName,
        subject: `Balance Due — $${amountDue.toLocaleString()} for your storage installation`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;margin-bottom:8px;">Your Installation is Complete!</h2>
          <p style="color:#666;font-size:14px;">Hi ${customerName},</p>
          <p style="color:#666;font-size:14px;">Great news — your storage unit build is finished. Here's your remaining balance:</p>
          <div style="background:#f8f9fa;border-radius:12px;padding:20px;text-align:center;margin:16px 0;">
            <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Amount Due</p>
            <p style="color:#1a1a1a;font-size:36px;font-weight:900;margin:0;">$${amountDue.toLocaleString()}</p>
          </div>
          ${payLink}
          <p style="color:#aaa;font-size:11px;text-align:center;margin-top:16px;">Payments processed securely via Stripe.</p>
        </div>`,
      });
      console.log("[CompleteJob] Invoice email sent to:", customerEmail);
    } catch (err) {
      console.error("[CompleteJob] Invoice email failed:", err);
    }
  }

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// markJobPaidManual — Manual override for cash/venmo/check payments
// Moves job to "paid" status (goes to Past Jobs).
// ═══════════════════════════════════════════════════════════════════════════

export async function markJobPaidManual(
  leadId: string,
  method: string = "cash"
) {
  const { error } = await supabase
    .from("leads")
    .update({
      status: "paid",
      deposit_paid: true,
      payout_status: "paid",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) {
    console.error("[MarkPaidManual] DB error:", error);
    return { success: false, error: "Failed to update payment status." };
  }

  console.log(`[MarkPaidManual] Lead ${leadId} marked paid via ${method}`);
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// rescheduleJob — Update date + send reschedule email (replies go to installer)
// ═══════════════════════════════════════════════════════════════════════════

export async function rescheduleJob(
  leadId: string,
  newDate: string,
  customerEmail: string,
  customerName: string
) {
  // Update the lead with new date
  await supabase
    .from("leads")
    .update({ scheduled_at: newDate, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (customerEmail) {
    try {
      // Fetch lead with installer profile to get installer's email
      const { data: lead } = await supabase
        .from("leads")
        .select("installer_id, installers(email)")
        .eq("id", leadId)
        .single();

      const installerEmail = (lead?.installers as { email?: string } | null)?.email || undefined;

      const formattedDate = new Date(newDate + "T12:00:00").toLocaleDateString(
        "en-US",
        { weekday: "long", month: "long", day: "numeric", year: "numeric" }
      );
      await sendTransactionalEmail({
        to: customerEmail,
        toName: customerName,
        subject: `Your installation has been rescheduled to ${formattedDate}`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;margin-bottom:8px;">Installation Rescheduled</h2>
          <p style="color:#666;font-size:14px;">Hi ${customerName},</p>
          <p style="color:#666;font-size:14px;">Your installation has been rescheduled to:</p>
          <div style="background:#f8f9fa;border-radius:12px;padding:20px;text-align:center;margin:16px 0;">
            <p style="color:#1a1a1a;font-size:20px;font-weight:700;margin:0;">${formattedDate}</p>
          </div>
          <p style="color:#aaa;font-size:11px;text-align:center;margin-top:16px;">Questions? Reply to this email.</p>
        </div>`,
        replyTo: installerEmail,
      });
      console.log("[Reschedule] Email sent to:", customerEmail, "| Reply-to:", installerEmail);
    } catch (err) {
      console.error("[Reschedule] Email failed:", err);
    }
  }

  return { success: true };
}
