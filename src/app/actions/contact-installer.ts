"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Contact Installer — Black Box Server Action
//
// Allows a customer to send a message to an installer without ever seeing
// the installer's email address. The email lookup, composition, and sending
// all happen server-side. The client only submits: installerId + message.
//
// When quoteData is provided, the configuration is saved to demand_signals
// so the customer can return to their exact build via a link in the
// confirmation email.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import {
  sendTransactionalEmail,
  buildCustomerInquiryTemplate,
  emailShell,
} from "@/lib/email";
import { getAppUrl } from "@/lib/url-helper";

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
  /** Full configurator build — saved so customer can resume later */
  quoteData?: unknown[];
  /** Customer's ZIP — used to rebuild the return link */
  zip?: string;
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
  const { installerId, customerName, customerEmail, customerPhone, message, quoteTotal, leadId, quoteData, zip } = input;

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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
    return { success: false, error: "Please enter a valid email address." };
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
      quoteData,
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

    // ── Save quote & send customer confirmation with return link ────────
    // If the customer configured a build, save it to demand_signals so
    // they can pick up exactly where they left off via a link in the
    // confirmation email. This prevents lost conversions when the
    // customer closes the tab while waiting for the installer's reply.
    if (quoteData && quoteData.length > 0 && customerEmail) {
      try {
        const { data: signal } = await supabase
          .from("demand_signals")
          .insert({
            zip: zip?.trim() || "00000",
            signal_type: "inquiry",
            status: "unresolved",
            customer_name: customerName.trim(),
            customer_email: customerEmail.trim(),
            customer_phone: customerPhone?.trim() || null,
            source_installer_id: installerId,
            quote_data: quoteData,
          })
          .select("id")
          .single();

        if (signal?.id) {
          // Build return link: /design?signal_id=UUID&installer_id=INSTALLER&zip=ZIP
          const linkParams = new URLSearchParams({
            signal_id: signal.id,
            installer_id: installerId,
          });
          if (zip?.trim()) linkParams.set("zip", zip.trim());
          const designUrl = `${getAppUrl()}/design?${linkParams.toString()}`;

          const firstName = customerName.trim().split(" ")[0] || "there";

          // Build a quick summary of the saved items
          const totalPrice = quoteData.reduce((sum: number, u: unknown) => {
            const item = u as Record<string, unknown>;
            return sum + (typeof item.price === "number" ? item.price : 0);
          }, 0);

          const itemSummary = quoteData
            .map((u: unknown, i: number) => {
              const item = u as Record<string, unknown>;
              const name = item.desc || `${item.cols}\u00d7${item.rows} Unit`;
              const price = typeof item.price === "number" ? `$${item.price.toLocaleString()}` : "";
              return `<tr><td style="padding:6px 0;color:#334155;font-size:14px;">${i + 1}. ${name}</td><td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:700;text-align:right;">${price}</td></tr>`;
            })
            .join("");

          const confirmHtml = emailShell(
            "Your Quote Is Saved",
            `
            <p style="margin:0 0 16px;color:#334155;font-size:16px;">Hi ${firstName},</p>

            <p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.7;">
              Your message has been sent to <strong>${businessName}</strong>. They'll get back to you shortly at <strong>${customerEmail.trim()}</strong>.
            </p>

            <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.7;">
              We saved your configuration so you can pick up right where you left off — no need to rebuild anything.
            </p>

            ${totalPrice > 0 ? `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:24px;">
              <p style="margin:0 0 8px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your Saved Build</p>
              <table style="width:100%;border-collapse:collapse;">
                ${itemSummary}
                <tr style="border-top:1px solid #e2e8f0;">
                  <td style="padding:10px 0 0;color:#64748b;font-size:13px;">Estimate</td>
                  <td style="padding:10px 0 0;color:#1e293b;font-size:18px;font-weight:800;text-align:right;">$${totalPrice.toLocaleString()}</td>
                </tr>
              </table>
            </div>
            ` : ""}

            <div style="text-align:center;margin-bottom:24px;">
              <a href="${designUrl}" style="display:inline-block;background-color:#facc15;color:#0f172a;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;">
                Return to My Quote &rarr;
              </a>
            </div>

            <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
              This link will restore your exact configuration. Bookmark it to come back anytime.
            </p>
            `
          );

          await sendTransactionalEmail({
            to: customerEmail.trim(),
            toName: customerName.trim(),
            subject: `Your quote is saved — return anytime to complete your order`,
            html: confirmHtml,
            replyTo: installerEmail,
          });

          console.log("[ContactInstaller] Confirmation email with saved quote link sent to:", customerEmail);
        }
      } catch (saveErr) {
        // Non-blocking — the inquiry was already sent successfully
        console.error("[ContactInstaller] Quote save/confirmation failed:", saveErr);
      }
    }

    return { success: true };
  } catch (err) {
    console.error("[ContactInstaller] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}
