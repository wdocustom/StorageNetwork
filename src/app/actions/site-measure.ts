"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Site Measure Request — Server Action
//
// Captures a customer's contact info when they say "I don't know my wall
// dimensions" in the Design Entry Modal. Two outcomes:
//
//   1. demand_signals row (signal_type='site_measure') so the installer's
//      lead dashboard / platform admin can follow up.
//   2. Email to the installer (when one is locked in) so they can reach
//      out immediately. If no installer is locked, the row sits in the
//      platform queue.
//
// Rate-limited like contact-installer because this is a public action
// that triggers email + DB writes.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import {
  sendTransactionalEmail,
  emailShell,
} from "@/lib/email";
import {
  enforceActionRateLimit,
  RateLimitError,
} from "@/lib/server/action-rate-limit";

const supabase = getServiceClient();

export interface SiteMeasureRequestInput {
  installerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  zip: string;
  notes?: string;
}

export interface SiteMeasureRequestResult {
  success: boolean;
  error?: string;
}

export async function requestOnSiteMeasure(
  input: SiteMeasureRequestInput
): Promise<SiteMeasureRequestResult> {
  try {
    await enforceActionRateLimit({
      action: "site-measure-request",
      limit: 5,
      window: "1 h",
      identify: "user-or-ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  const name = input.customerName?.trim();
  const email = input.customerEmail?.trim().toLowerCase();
  const phone = input.customerPhone?.trim();
  const zip = input.zip?.trim();
  const notes = input.notes?.trim();

  if (!name) return { success: false, error: "Your name is required." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    return { success: false, error: "Please enter a valid phone number." };
  }
  if (!/^\d{5}$/.test(zip)) {
    return { success: false, error: "Please enter a 5-digit ZIP code." };
  }
  if (notes && notes.length > 1000) {
    return { success: false, error: "Notes are too long (max 1000 characters)." };
  }

  // ── 1. Persist demand signal ───────────────────────────────────────────
  const { error: insertErr } = await supabase.from("demand_signals").insert({
    zip,
    signal_type: "site_measure",
    status: "unresolved",
    customer_name: name,
    customer_email: email,
    customer_phone: phone || null,
    source_installer_id: input.installerId || null,
    quote_data: notes ? [{ kind: "site_measure_note", note: notes }] : null,
  });

  if (insertErr) {
    console.error("[SiteMeasure] insert failed:", insertErr);
    return {
      success: false,
      error: "We couldn't save your request right now. Please try again.",
    };
  }

  // ── 2. Email installer if one is locked in ────────────────────────────
  // No installer locked = platform-level lead. The demand_signals row is
  // the durable record; admins will see it in the analytics / leads tab.
  if (input.installerId) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, business_name")
        .eq("id", input.installerId)
        .single();

      const { data: authUser } = await supabase.auth.admin.getUserById(
        input.installerId
      );

      const installerEmail = authUser?.user?.email;
      if (installerEmail && profile) {
        const installerName =
          (profile.first_name as string | null) ||
          (profile.business_name as string | null) ||
          "Installer";

        const html = emailShell(
          "Site Measure Request",
          `
          <p style="margin:0 0 12px;color:#ffffff;font-size:16px;">
            Hey ${installerName},
          </p>
          <p style="margin:0 0 20px;color:#a3a3a3;font-size:15px;line-height:1.6;">
            A homeowner in <strong style="color:#facc15;">${zip}</strong> doesn't
            have their wall dimensions and wants you to come measure on-site
            before they design their build. Reply to this email to reach them
            directly.
          </p>
          <table style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#0a0a0a;border:1px solid #222;border-radius:8px;">
            <tr>
              <td style="padding:14px 16px;border-bottom:1px solid #222;">
                <p style="margin:0 0 2px;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Name</p>
                <p style="margin:0;color:#ffffff;font-size:15px;">${name}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 16px;border-bottom:1px solid #222;">
                <p style="margin:0 0 2px;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Email</p>
                <p style="margin:0;"><a href="mailto:${email}" style="color:#facc15;text-decoration:none;">${email}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 16px;border-bottom:1px solid #222;">
                <p style="margin:0 0 2px;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Phone</p>
                <p style="margin:0;"><a href="tel:${phone}" style="color:#facc15;text-decoration:none;">${phone}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 16px;">
                <p style="margin:0 0 2px;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">ZIP</p>
                <p style="margin:0;color:#ffffff;font-size:15px;">${zip}</p>
              </td>
            </tr>
          </table>
          ${notes ? `
          <p style="margin:0 0 6px;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Notes from the customer</p>
          <div style="border-top:1px solid #222;border-bottom:1px solid #222;padding:14px 0;margin:0 0 20px;color:#ffffff;font-size:14px;line-height:1.6;white-space:pre-wrap;">${notes.replace(/</g, "&lt;")}</div>
          ` : ""}
          <p style="margin:0;color:#666;font-size:12px;line-height:1.5;">
            Reply to this email and your response goes straight to ${name}.
          </p>
          `
        );

        await sendTransactionalEmail({
          to: installerEmail,
          toName: installerName,
          subject: `Site Measure Request from ${name} (${zip})`,
          html,
          replyTo: email,
        });
      }
    } catch (err) {
      // Email failure should NOT fail the whole request — the demand_signals
      // row is the durable record and the admin will still see it.
      console.error("[SiteMeasure] installer email failed:", err);
    }
  }

  return { success: true };
}
