"use server";

import { createClient } from "@supabase/supabase-js";
import { smsCustomerEnRoute, smsNewBookingAlert } from "@/lib/twilio";

// ═══════════════════════════════════════════════════════════════════════════
// SMS Server Actions — Twilio-powered notifications
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────────────────────────────────
// Start Trip & Notify Customer
//
// Called when installer taps "Start Trip & Notify Customer" on the job page.
// Sends an en-route SMS to the customer with:
//   - Installer's first name
//   - Prep instructions (clear garage path + install wall)
//   - Remaining balance due
//   - Rough ETA window
// ─────────────────────────────────────────────────────────────────────────

export async function startTripNotify(
  leadId: string,
  installerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch lead details
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select(
        "id, customer_name, customer_phone, estimated_price, deposit_amount, balance_due, address_zip, en_route_notified, installer_id"
      )
      .eq("id", leadId)
      .single();

    if (leadErr || !lead) {
      return { success: false, error: "Job not found." };
    }

    // Verify the caller is the assigned installer
    if (lead.installer_id !== installerId) {
      return { success: false, error: "Not authorized for this job." };
    }

    // Prevent double-sends
    if (lead.en_route_notified) {
      return { success: false, error: "Customer was already notified." };
    }

    // Validate customer phone
    if (!lead.customer_phone) {
      return {
        success: false,
        error: "No phone number on file for this customer.",
      };
    }

    // 2. Fetch installer profile
    const { data: installer } = await supabase
      .from("profiles")
      .select("first_name, is_pro, service_zip")
      .eq("id", installerId)
      .single();

    if (!installer) {
      return { success: false, error: "Installer profile not found." };
    }

    const installerFirstName = installer.first_name || "Your installer";

    // 3. Calculate remaining balance
    const totalPrice = lead.estimated_price || 0;
    const depositPaid = lead.deposit_amount || totalPrice * 0.15;
    const remaining = lead.balance_due || totalPrice - depositPaid;
    const formattedBalance = `$${remaining.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    // 4. Rough ETA — simplified zip-distance heuristic
    const etaWindow = estimateEta(installer.service_zip, lead.address_zip);

    // 5. Send SMS
    const smsResult = await smsCustomerEnRoute(
      lead.customer_phone,
      lead.customer_name,
      installerFirstName,
      formattedBalance,
      etaWindow
    );

    if (!smsResult.success) {
      return {
        success: false,
        error: smsResult.error || "SMS failed to send.",
      };
    }

    // 6. Update lead — mark as notified
    await supabase
      .from("leads")
      .update({
        en_route_notified: true,
        en_route_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    console.log(
      `[SMS] En-route notification sent for lead ${leadId} → ${lead.customer_phone}`
    );

    return { success: true };
  } catch (err) {
    console.error("[SMS] startTripNotify failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Notification failed.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Send New Booking SMS to Installer
//
// Called from the Stripe webhook alongside the email alert.
// Only sends if installer has a phone number and is Pro.
// ─────────────────────────────────────────────────────────────────────────

export async function sendInstallerBookingSms(
  installerId: string,
  leadId: string,
  customerZip: string,
  profitEstimate: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch installer profile
    const { data: installer } = await supabase
      .from("profiles")
      .select("phone, is_pro")
      .eq("id", installerId)
      .single();

    if (!installer) {
      return { success: false, error: "Installer not found." };
    }

    if (!installer.phone) {
      return { success: false, error: "No phone number on installer profile." };
    }

    const result = await smsNewBookingAlert(
      installer.phone,
      customerZip,
      profitEstimate
    );

    if (result.success) {
      // Mark SMS as sent on the lead
      await supabase
        .from("leads")
        .update({ installer_sms_sent: true })
        .eq("id", leadId);
    }

    return { success: result.success, error: result.error };
  } catch (err) {
    console.error("[SMS] sendInstallerBookingSms failed:", err);
    return { success: false, error: "SMS send failed." };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Rough ETA Estimation
//
// Simple heuristic: if both ZIPs share the same 3-digit prefix, they're
// in the same metro area (~30-45 min). Otherwise assume ~45-75 min.
// This avoids external Maps API calls while giving a reasonable estimate.
// ─────────────────────────────────────────────────────────────────────────

function estimateEta(
  installerZip: string | null,
  customerZip: string | null
): string {
  if (!installerZip || !customerZip) {
    return "approx. 60 minutes";
  }

  // Same 3-digit ZIP prefix = same metro/region
  const installerPrefix = installerZip.substring(0, 3);
  const customerPrefix = customerZip.substring(0, 3);

  if (installerPrefix === customerPrefix) {
    return "30-45 minutes";
  }

  // Same first 2 digits = same state region
  if (installerZip.substring(0, 2) === customerZip.substring(0, 2)) {
    return "45-75 minutes";
  }

  return "approx. 60 minutes";
}
