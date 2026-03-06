"use server";

import { createClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/email";
import { calculateMaterialCost, type MaterialConfig } from "@/utils/calculateMaterials";
import { updateInventoryAfterJob } from "@/app/actions/inventory";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════════════════════════════
// updateOperationalStatus — Pipeline state toggle from CRM cards
// Updates the installer-facing operational status independently of payment.
// ═══════════════════════════════════════════════════════════════════════════

export type OperationalStatus = "new" | "scheduled" | "completed";

const VALID_OP_STATUSES: OperationalStatus[] = ["new", "scheduled", "completed"];

export async function updateOperationalStatus(
  leadId: string,
  status: OperationalStatus
): Promise<{ success: boolean; error?: string }> {
  if (!leadId) return { success: false, error: "Lead ID is required." };
  if (!VALID_OP_STATUSES.includes(status)) {
    return { success: false, error: `Invalid status: ${status}` };
  }

  const { error } = await supabase
    .from("leads")
    .update({
      operational_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) {
    console.error("[OperationalStatus] DB error:", error);
    return { success: false, error: "Failed to update status." };
  }

  return { success: true };
}

/**
 * Update material inventory after a job is completed.
 * Fetches the lead's quote_data, calculates raw material usage,
 * and adjusts the installer's running inventory.
 */
async function syncInventoryForLead(leadId: string) {
  try {
    const { data: lead } = await supabase
      .from("leads")
      .select("installer_id, quote_data")
      .eq("id", leadId)
      .single();

    if (!lead?.installer_id || !lead?.quote_data) return;

    const quoteData = lead.quote_data as MaterialConfig[];
    if (!Array.isArray(quoteData) || quoteData.length === 0) return;

    const breakdown = calculateMaterialCost(quoteData);
    await updateInventoryAfterJob(lead.installer_id, breakdown.rawCounts);
  } catch (err) {
    // Non-blocking: inventory sync failure should never block job completion
    console.error("[Inventory] Sync failed for lead:", leadId, err);
  }
}

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

  // Update material inventory (non-blocking)
  syncInventoryForLead(leadId);

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// completeJob — Simple completion without requiring proof photo
// Sets status to payment_pending so installer can collect payment
// ═══════════════════════════════════════════════════════════════════════════

export async function completeJob(leadId: string) {
  const { error } = await supabase
    .from("leads")
    .update({
      status: "payment_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) {
    console.error("[CompleteJob] DB error:", error);
    return { success: false, error: "Failed to complete job." };
  }

  // Update material inventory (non-blocking)
  syncInventoryForLead(leadId);

  console.log(`[CompleteJob] Lead ${leadId} marked as payment_pending (no photo required)`);
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

// ═══════════════════════════════════════════════════════════════════════════
// scheduleJob — Manually assign an install date to a job ticket
//
// Used when an installer sends a manual quote from /build and then confirms
// a date with the customer via email. Updates scheduled_at so the scheduler
// engine counts this slot toward daily capacity (prevents double-booking).
// ═══════════════════════════════════════════════════════════════════════════

export async function scheduleJob(
  leadId: string,
  date: string,
  customerEmail: string,
  customerName: string
): Promise<{ success: boolean; error?: string }> {
  if (!leadId || !date) {
    return { success: false, error: "Lead ID and date are required." };
  }

  // Update the lead with the scheduled date
  const { error: updateError } = await supabase
    .from("leads")
    .update({ scheduled_at: date, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (updateError) {
    console.error("[ScheduleJob] DB error:", updateError);
    return { success: false, error: "Failed to schedule job." };
  }

  // Send confirmation email to customer (non-blocking)
  if (customerEmail) {
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("installer_id, installers(email)")
        .eq("id", leadId)
        .single();

      const installerEmail = (lead?.installers as { email?: string } | null)?.email || undefined;

      const formattedDate = new Date(date + "T12:00:00").toLocaleDateString(
        "en-US",
        { weekday: "long", month: "long", day: "numeric", year: "numeric" }
      );
      await sendTransactionalEmail({
        to: customerEmail,
        toName: customerName,
        subject: `Your installation is scheduled for ${formattedDate}`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;margin-bottom:8px;">Installation Scheduled</h2>
          <p style="color:#666;font-size:14px;">Hi ${customerName},</p>
          <p style="color:#666;font-size:14px;">Your storage unit installation has been scheduled for:</p>
          <div style="background:#f8f9fa;border-radius:12px;padding:20px;text-align:center;margin:16px 0;">
            <p style="color:#1a1a1a;font-size:20px;font-weight:700;margin:0;">${formattedDate}</p>
          </div>
          <p style="color:#666;font-size:14px;">We'll see you then! If you need to make any changes, just reply to this email.</p>
          <p style="color:#aaa;font-size:11px;text-align:center;margin-top:16px;">Questions? Reply to this email.</p>
        </div>`,
        replyTo: installerEmail,
      });
      console.log("[ScheduleJob] Confirmation email sent to:", customerEmail, "| Reply-to:", installerEmail);
    } catch (err) {
      console.error("[ScheduleJob] Email failed:", err);
      // Non-blocking — scheduling succeeded even if email fails
    }
  }

  console.log(`[ScheduleJob] Lead ${leadId} scheduled for ${date}`);
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// deleteUnpaidQuote — Permanently delete an unpaid quote (pending_payment)
// Only works on leads that have never had a deposit paid.
// ═══════════════════════════════════════════════════════════════════════════

export async function deleteUnpaidQuote(
  leadId: string
): Promise<{ success: boolean; error?: string }> {
  if (!leadId) return { success: false, error: "Lead ID is required." };

  // Safety check: only delete leads that are pending_payment and never had deposit paid
  const { data: lead } = await supabase
    .from("leads")
    .select("status, deposit_paid")
    .eq("id", leadId)
    .single();

  if (!lead) {
    return { success: false, error: "Quote not found." };
  }

  if (lead.deposit_paid) {
    return { success: false, error: "Cannot delete a quote that has a deposit paid." };
  }

  if (lead.status !== "pending_payment") {
    return { success: false, error: "Can only delete unpaid quotes." };
  }

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", leadId);

  if (error) {
    console.error("[DeleteUnpaidQuote] DB error:", error);
    return { success: false, error: "Failed to delete quote." };
  }

  console.log(`[DeleteUnpaidQuote] Lead ${leadId} deleted`);
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// updateCustomerContact — Update customer email/phone from the job ticket
// Updates both the leads table and the linked customers record.
// ═══════════════════════════════════════════════════════════════════════════

export async function updateCustomerContact(
  leadId: string,
  data: { email?: string | null; phone?: string | null }
): Promise<{ success: boolean; error?: string }> {
  if (!leadId) return { success: false, error: "Lead ID is required." };

  const normalizedEmail = data.email?.trim().toLowerCase() || null;
  const normalizedPhone = data.phone?.trim() || null;

  // Update the lead record
  const leadUpdate: Record<string, unknown> = {};
  if (data.email !== undefined) leadUpdate.customer_email = normalizedEmail;
  if (data.phone !== undefined) leadUpdate.customer_phone = normalizedPhone;

  const { error: leadError } = await supabase
    .from("leads")
    .update(leadUpdate)
    .eq("id", leadId);

  if (leadError) {
    console.error("[UpdateCustomerContact] Lead update error:", leadError);
    return { success: false, error: "Failed to update contact info." };
  }

  // Also update the linked customers record if one exists
  const { data: lead } = await supabase
    .from("leads")
    .select("customer_id")
    .eq("id", leadId)
    .single();

  if (lead?.customer_id) {
    const customerUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.email !== undefined) customerUpdate.email = normalizedEmail;
    if (data.phone !== undefined) customerUpdate.phone = normalizedPhone;

    await supabase
      .from("customers")
      .update(customerUpdate)
      .eq("id", lead.customer_id);
  }

  console.log(`[UpdateCustomerContact] Lead ${leadId} contact updated`);
  return { success: true };
}
