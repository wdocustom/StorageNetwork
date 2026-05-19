"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendInstallScheduledNotice } from "@/lib/email";
import { calculateMaterialCostServer } from "@/app/actions/calculate-materials";
import type { MaterialConfig, MaterialPrices } from "@/utils/calculateMaterials";
import { updateInventoryAfterJob, getInstallerInventory } from "@/app/actions/inventory";
import type { MaterialPricingConfig } from "@/app/actions/material-pricing";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDepositAmount } from "@/app/actions/fee-engine";
import { validateDiscountCode } from "@/app/actions/discount-codes";
import type { QuoteUnit } from "@/lib/buildEngine.types";

const supabase = getServiceClient();

// ── Auth Helper: Verify caller owns the lead ────────────────────────────
async function requireLeadOwnership(
  leadId: string
): Promise<{ userId: string } | { error: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { data: lead } = await supabase
    .from("leads")
    .select("installer_id")
    .eq("id", leadId)
    .single();

  if (!lead) return { error: "Lead not found." };
  if (lead.installer_id !== user.id) return { error: "Not authorized." };
  return { userId: user.id };
}

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

  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

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

  const { logActivityInternal } = await import("@/app/actions/installer-activity");
  await logActivityInternal(auth.userId, "job_status_update", { leadId, status });

  return { success: true };
}

/** Convert DB material_pricing_config to MaterialPrices for the calculator. */
function toMaterialPrices(mpc: MaterialPricingConfig | null | undefined): MaterialPrices | undefined {
  if (!mpc) return undefined;
  const p: Record<string, number> = {};
  if (mpc.lumber_2x4_8ft !== undefined) p.lumber_2x4_8ft = mpc.lumber_2x4_8ft;
  if (mpc.plywood_sheet !== undefined) p.plywood_sheet = mpc.plywood_sheet;
  if (mpc.tote !== undefined) p.tote = mpc.tote;
  if (mpc.wheels_4pk !== undefined) p.wheels_4pk = mpc.wheels_4pk;
  // Normalize custom screw packages to equivalent default-box-size price
  if (mpc.screw_1in) p.screw_1in_90ct = mpc.screw_1in.price / mpc.screw_1in.count * 90;
  if (mpc.screw_1_5_8in) p.screw_1_5_8in_158ct = mpc.screw_1_5_8in.price / mpc.screw_1_5_8in.count * 158;
  if (mpc.screw_3in) p.screw_3in_137ct = mpc.screw_3in.price / mpc.screw_3in.count * 137;
  return Object.keys(p).length > 0 ? (p as MaterialPrices) : undefined;
}

/**
 * Update material inventory after a job is completed.
 * Fetches the lead's quote_data, calculates raw material usage,
 * and adjusts the installer's running inventory.
 * Uses the installer's custom material pricing for accurate cost tracking.
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

    // Fetch current inventory AND custom pricing so the calculator uses accurate values
    const [currentInventory, pricingData] = await Promise.all([
      getInstallerInventory(lead.installer_id),
      supabase
        .from("profiles")
        .select("material_pricing_config")
        .eq("id", lead.installer_id)
        .single(),
    ]);

    const customPrices = toMaterialPrices(
      pricingData.data?.material_pricing_config as MaterialPricingConfig | null
    );

    const breakdown = await calculateMaterialCostServer(quoteData, customPrices, currentInventory);
    await updateInventoryAfterJob(lead.installer_id, breakdown.rawCounts);
  } catch (err) {
    // Non-blocking: inventory sync failure should never block job completion
    console.error("[Inventory] Sync failed for lead:", leadId, err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// completeJobWithProof — Upload proof sets status to payment_pending
// Does NOT set completed_at. Job stays "active" until paid.
// No auto-email — installer chooses how to collect payment.
// ═══════════════════════════════════════════════════════════════════════════

export async function completeJobWithProof(
  leadId: string,
  photoUrl: string,
  customerEmail: string | null,
  customerName: string,
  amountDue: number,
  paymentUrl?: string
) {
  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

  // 1. Update DB — mark proof uploaded, status = payment_pending
  await supabase
    .from("leads")
    .update({
      status: "payment_pending",
      photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  // 2. Update material inventory (non-blocking)
  syncInventoryForLead(leadId);

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// completeJob — Simple completion without requiring proof photo
// Sets status to payment_pending so installer can collect payment
// ═══════════════════════════════════════════════════════════════════════════

export async function completeJob(leadId: string) {
  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

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

  const { logActivityInternal } = await import("@/app/actions/installer-activity");
  await logActivityInternal(auth.userId, "job_completed", { leadId });

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
  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

  // Status precondition: only allow marking paid from valid pre-paid states
  const { data: updated, error } = await supabase
    .from("leads")
    .update({
      status: "paid",
      deposit_paid: true,
      payout_status: "paid",
      paid_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .in("status", ["payment_pending", "open", "pending_payment"])
    .select("id, customer_name, customer_email, estimated_price, deposit_amount, installer_id, quote_data")
    .maybeSingle();

  if (error) {
    console.error("[MarkPaidManual] DB error:", error);
    return { success: false, error: "Failed to update payment status." };
  }

  if (!updated) {
    return { success: false, error: "Job is not in a payable state. It may already be paid." };
  }

  console.log(`[MarkPaidManual] Lead ${leadId} marked paid via ${method}`);

  const { logActivityInternal } = await import("@/app/actions/installer-activity");
  await logActivityInternal(auth.userId, "job_paid_manual", { leadId, method });

  // Fire-and-forget: send receipt/alert emails (same as webhook path)
  import("@/lib/email").then(async ({ sendJobReceipt, sendPaymentReceivedAlert, quoteDataToBookingUnits }) => {
    try {
      const balanceCollected = (updated.estimated_price || 0) - (updated.deposit_amount || 0);

      let installerName = "Your Installer";
      let installerEmail: string | null = null;

      if (updated.installer_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, business_name")
          .eq("id", updated.installer_id)
          .single();
        if (profile) {
          installerName = profile.business_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Your Installer";
        }
        const { data: authUser } = await supabase.auth.admin.getUserById(updated.installer_id);
        installerEmail = authUser?.user?.email || null;
      }

      const customerName = updated.customer_name ?? "Customer";

      if (updated.customer_email) {
        // Generate review token for this job
        const { generateReviewToken } = await import("@/app/actions/reviews");
        const { getAppUrl } = await import("@/lib/url-helper");
        const reviewToken = await generateReviewToken(leadId);
        const reviewUrl = reviewToken ? `${getAppUrl()}/review/${reviewToken}` : undefined;

        await sendJobReceipt(updated.customer_email, {
          customerName,
          installerName,
          totalAmount: updated.estimated_price ?? balanceCollected,
          depositPaid: updated.deposit_amount ?? 0,
          balanceCollected,
          jobDescription: "Storage unit installation",
          units: quoteDataToBookingUnits(updated.quote_data),
          completedDate: new Date().toISOString(),
          reviewUrl,
        });
        console.log("[MarkPaidManual] Receipt email sent to customer");
      }

      if (installerEmail) {
        await sendPaymentReceivedAlert(installerEmail, {
          installerName,
          customerName,
          amountReceived: balanceCollected,
          jobTotal: updated.estimated_price ?? balanceCollected,
          leadId,
        });
        console.log("[MarkPaidManual] Payment alert sent to installer:", installerEmail);
      }
    } catch (emailErr) {
      console.error("[MarkPaidManual] Email failed (non-fatal):", emailErr);
    }
  }).catch((err: unknown) => console.error("[MarkPaidManual] Email import failed:", err));

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
  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

  // Update the lead with new date
  await supabase
    .from("leads")
    .update({ scheduled_at: newDate, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (customerEmail) {
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("installer_id")
        .eq("id", leadId)
        .single();

      let installerEmail: string | undefined;
      let installerName: string | undefined;
      if (lead?.installer_id) {
        const [{ data: installerProfile }, { data: installerAuth }] = await Promise.all([
          supabase
            .from("profiles")
            .select("business_name, first_name, last_name")
            .eq("id", lead.installer_id)
            .single(),
          supabase.auth.admin.getUserById(lead.installer_id),
        ]);
        installerEmail = installerAuth?.user?.email || undefined;
        installerName =
          installerProfile?.business_name ||
          [installerProfile?.first_name, installerProfile?.last_name]
            .filter(Boolean)
            .join(" ") ||
          undefined;
      }

      await sendInstallScheduledNotice(customerEmail, {
        customerName,
        installerName,
        scheduledDate: newDate,
        replyTo: installerEmail,
        isReschedule: true,
      });
      console.log(
        "[Reschedule] Email sent to:",
        customerEmail,
        "| Reply-to:",
        installerEmail,
      );
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

  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

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
        .select("installer_id")
        .eq("id", leadId)
        .single();

      let installerEmail: string | undefined;
      let installerName: string | undefined;
      if (lead?.installer_id) {
        const [{ data: installerProfile }, { data: installerAuth }] = await Promise.all([
          supabase
            .from("profiles")
            .select("business_name, first_name, last_name")
            .eq("id", lead.installer_id)
            .single(),
          supabase.auth.admin.getUserById(lead.installer_id),
        ]);
        installerEmail = installerAuth?.user?.email || undefined;
        installerName =
          installerProfile?.business_name ||
          [installerProfile?.first_name, installerProfile?.last_name]
            .filter(Boolean)
            .join(" ") ||
          undefined;
      }

      await sendInstallScheduledNotice(customerEmail, {
        customerName,
        installerName,
        scheduledDate: date,
        replyTo: installerEmail,
      });
      console.log(
        "[ScheduleJob] Confirmation email sent to:",
        customerEmail,
        "| Reply-to:",
        installerEmail,
      );
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

  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

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

  const deletableStatuses = ["pending_payment", "waitlisted", "expired"];
  if (!deletableStatuses.includes(lead.status)) {
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

  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

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

// ═══════════════════════════════════════════════════════════════════════════
// fetchLeadForEdit — Fetch full lead data for the "Edit Quote" flow
// Requires authentication + lead ownership. Rejects paid quotes.
// ═══════════════════════════════════════════════════════════════════════════

export interface LeadForEdit {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  quote_data: QuoteUnit[];
  estimated_price: number;
  delivery_address_line1: string | null;
  delivery_address_line2: string | null;
  delivery_address_city: string | null;
  delivery_address_state: string | null;
  delivery_address_zip: string | null;
  delivery_fee: number | null;
  discount_code: string | null;
  deposit_paid: boolean;
  status: string;
}

export async function fetchLeadForEdit(
  leadId: string
): Promise<{ success: boolean; lead?: LeadForEdit; error?: string }> {
  if (!leadId) return { success: false, error: "Lead ID is required." };

  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, customer_name, customer_email, customer_phone, quote_data, estimated_price, delivery_address_line1, delivery_address_line2, delivery_address_city, delivery_address_state, delivery_address_zip, delivery_fee, discount_code, deposit_paid, status")
    .eq("id", leadId)
    .single();

  if (error || !lead) {
    return { success: false, error: "Quote not found." };
  }

  if (lead.deposit_paid) {
    return { success: false, error: "Cannot edit a quote that has a deposit paid." };
  }

  return { success: true, lead: lead as LeadForEdit };
}

// ═══════════════════════════════════════════════════════════════════════════
// updateQuote — Modify an existing unpaid quote's items and totals
// Recalculates deposit and balance. Customer pay link stays valid.
// ═══════════════════════════════════════════════════════════════════════════

export async function updateQuote(input: {
  leadId: string;
  quote_data: QuoteUnit[];
  grand_total: number;
  delivery_fee?: number;
  discount_code?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { leadId, quote_data, grand_total, delivery_fee, discount_code } = input;

  if (!leadId) return { success: false, error: "Lead ID is required." };
  if (!quote_data || quote_data.length === 0) return { success: false, error: "Quote must have at least one item." };

  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: lead } = await supabase
    .from("leads")
    .select("deposit_paid, installer_id")
    .eq("id", leadId)
    .single();

  if (!lead) return { success: false, error: "Quote not found." };
  if (lead.deposit_paid) return { success: false, error: "Cannot edit a quote that has a deposit paid." };

  const depositAmount = await getDepositAmount(grand_total, lead.installer_id);
  const balanceDue = grand_total - depositAmount;

  let discountAmount: number | null = null;
  if (discount_code && lead.installer_id) {
    const discountResult = await validateDiscountCode(discount_code, lead.installer_id, grand_total);
    if (discountResult.valid && discountResult.discountAmount > 0) {
      discountAmount = discountResult.discountAmount;
    }
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      quote_data,
      estimated_price: grand_total,
      deposit_amount: depositAmount,
      balance_due: balanceDue,
      delivery_fee: delivery_fee ?? 0,
      discount_code: discount_code || null,
      discount_amount: discountAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (updateError) {
    console.error("[UpdateQuote] DB error:", updateError);
    return { success: false, error: "Failed to update quote." };
  }

  const { logActivityInternal } = await import("@/app/actions/installer-activity");
  await logActivityInternal(auth.userId, "quote_updated", { leadId, grand_total });

  console.log(`[UpdateQuote] Lead ${leadId} updated — total: $${grand_total}, deposit: $${depositAmount}`);
  return { success: true };
}
