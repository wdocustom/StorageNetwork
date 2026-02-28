"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Contact Installer — Black Box Server Action
//
// Allows a customer to send a message to an installer without ever seeing
// the installer's email address. The email lookup, composition, and sending
// all happen server-side. The client only submits: installerId + message.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import {
  sendTransactionalEmail,
  buildCustomerInquiryTemplate,
} from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ContactInstallerInput {
  installerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  message: string;
  /** Optional context: what the customer was looking at */
  quoteTotal?: number;
  leadId?: string;
}

export interface ContactInstallerResult {
  success: boolean;
  error?: string;
}

/**
 * Send a customer inquiry email to an installer.
 * The installer's email is looked up server-side — never exposed to the client.
 */
export async function contactInstaller(
  input: ContactInstallerInput
): Promise<ContactInstallerResult> {
  const { installerId, customerName, customerEmail, customerPhone, message, quoteTotal, leadId } = input;

  // ── Validation ──────────────────────────────────────────────────────────
  if (!installerId) {
    return { success: false, error: "Installer ID is required." };
  }
  if (!customerName?.trim()) {
    return { success: false, error: "Your name is required." };
  }
  if (!customerEmail?.trim()) {
    return { success: false, error: "Your email is required." };
  }
  if (!message?.trim()) {
    return { success: false, error: "Please enter a message." };
  }
  if (message.trim().length > 2000) {
    return { success: false, error: "Message is too long (max 2000 characters)." };
  }

  try {
    // ── Look up installer's email (server-side only) ────────────────────
    // Join through auth.users to get the email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, business_name, first_name, phone")
      .eq("id", installerId)
      .single();

    if (profileError || !profile) {
      console.error("[ContactInstaller] Profile lookup failed:", profileError);
      return { success: false, error: "Installer not found." };
    }

    // Get email from auth.users (not stored in profiles)
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(installerId);

    if (authError || !authUser?.user?.email) {
      console.error("[ContactInstaller] Auth lookup failed:", authError);
      return { success: false, error: "Unable to reach installer at this time." };
    }

    const installerEmail = authUser.user.email;
    const installerName = profile.first_name || profile.business_name || "Installer";
    const businessName = profile.business_name || "Your Business";

    // ── Build and send the email ────────────────────────────────────────
    const html = buildCustomerInquiryTemplate({
      installerName,
      businessName,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone?.trim(),
      message: message.trim(),
      quoteTotal,
      leadId,
    });

    const result = await sendTransactionalEmail({
      to: installerEmail,
      toName: installerName,
      subject: `New Inquiry from ${customerName.trim()}`,
      html,
      replyTo: customerEmail.trim(),
    });

    if (!result.success) {
      console.error("[ContactInstaller] Email send failed:", result.error);
      return { success: false, error: "Failed to send message. Please try again." };
    }

    // ── Log to communication_logs (if table exists) ─────────────────────
    // Fire-and-forget — logging should not block the response
    try {
      await supabase
        .from("communication_logs")
        .insert({
          lead_id: leadId || null,
          installer_id: installerId,
          type: "email",
          direction: "inbound",
          message: message.trim(),
          created_by: customerEmail.trim(),
        });
    } catch {
      // Silently fail — logging is non-critical
    }

    return { success: true };
  } catch (err) {
    console.error("[ContactInstaller] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}
