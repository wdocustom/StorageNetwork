"use server";

import { getServiceClient } from "@/lib/supabase-server";

const supabase = getServiceClient();

// ═══════════════════════════════════════════════════════════════════════════
// Demand Signals — Persistent record of uncovered-area interest
//
// Two flavors:
//   1. Anonymous: ZIP check returned no installer (cold signal)
//   2. Waitlist:  customer left contact info (warm signal)
//
// When an installer later covers these ZIPs, we can:
//   - Auto-email waitlisted customers
//   - Show the new installer their area's demand count
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Record an anonymous demand signal — a customer checked a ZIP
 * and no installer was available. No contact info captured.
 *
 * Fire-and-forget: callers should .catch(() => {}) this.
 */
export async function recordAnonymousDemand(
  zip: string,
  sourceInstallerId?: string
): Promise<void> {
  const trimmed = zip.trim();
  if (!/^\d{5}$/.test(trimmed)) return;

  // Deduplicate: don't record the same ZIP more than once per hour
  // (prevents spam from repeated ZIP checks)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: recent } = await supabase
    .from("demand_signals")
    .select("id")
    .eq("zip", trimmed)
    .eq("signal_type", "anonymous")
    .gte("created_at", oneHourAgo)
    .limit(1);

  if (recent && recent.length > 0) return; // Already recorded recently

  await supabase.from("demand_signals").insert({
    zip: trimmed,
    signal_type: "anonymous",
    status: "unresolved",
    source_installer_id: sourceInstallerId || null,
  });
}

/**
 * Record a waitlist demand signal — customer left their contact info
 * because the installer's area didn't cover their ZIP.
 *
 * This replaces the old fire-and-forget email-only waitlist with a
 * persistent record that can be activated months later.
 */
export async function recordWaitlistDemand(input: {
  zip: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  sourceInstallerId?: string;
  quoteData?: unknown[];
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const trimmed = input.zip.trim();
  if (!/^\d{5}$/.test(trimmed)) {
    return { success: false, error: "Invalid ZIP code." };
  }
  if (!input.customerName?.trim() || !input.customerEmail?.trim()) {
    return { success: false, error: "Name and email are required." };
  }

  const { data, error } = await supabase.from("demand_signals").insert({
    zip: trimmed,
    signal_type: "waitlist",
    status: "unresolved",
    customer_name: input.customerName.trim(),
    customer_email: input.customerEmail.trim(),
    customer_phone: input.customerPhone?.trim() || null,
    source_installer_id: input.sourceInstallerId || null,
    quote_data: input.quoteData && input.quoteData.length > 0 ? input.quoteData : null,
  }).select("id").single();

  if (error) {
    console.error("[DemandSignal] Insert failed:", error);
    return { success: false, error: "Failed to save waitlist request." };
  }

  return { success: true, id: data?.id };
}

/**
 * Fetch a demand signal's saved quote data by ID.
 * Used when a waitlisted customer returns via the activation email link.
 * Returns the saved configurator build + referrer attribution so
 * the configurator can pre-populate their previous selections.
 */
export async function getSavedQuoteFromSignal(
  signalId: string
): Promise<{
  quoteData: unknown[] | null;
  sourceInstallerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
} | null> {
  if (!signalId) return null;

  const { data, error } = await supabase
    .from("demand_signals")
    .select("quote_data, source_installer_id, customer_name, customer_email, customer_phone")
    .eq("id", signalId)
    .single();

  if (error || !data) return null;

  return {
    quoteData: Array.isArray(data.quote_data) ? data.quote_data : null,
    sourceInstallerId: data.source_installer_id || null,
    customerName: data.customer_name || null,
    customerEmail: data.customer_email || null,
    customerPhone: data.customer_phone || null,
  };
}

/**
 * Get demand signal counts for a set of ZIPs.
 * Used by installer dashboard to show "X customers waiting in your area".
 */
export async function getDemandCountForZips(
  zips: string[]
): Promise<{ total: number; waitlist: number }> {
  if (!zips || zips.length === 0) return { total: 0, waitlist: 0 };

  const { count: total } = await supabase
    .from("demand_signals")
    .select("id", { count: "exact", head: true })
    .in("zip", zips)
    .eq("status", "unresolved");

  const { count: waitlist } = await supabase
    .from("demand_signals")
    .select("id", { count: "exact", head: true })
    .in("zip", zips)
    .eq("status", "unresolved")
    .eq("signal_type", "waitlist");

  return {
    total: total ?? 0,
    waitlist: waitlist ?? 0,
  };
}

/**
 * Activate demand signals when an installer sets their service area.
 *
 * Called from updateInstallerProfile() after service_zips is computed.
 * For each unresolved waitlist signal in the new coverage area:
 *   1. Mark it as 'notified' with the installer's ID
 *   2. Send the customer an email that an installer is now available
 *
 * Anonymous signals are just marked 'notified' (no email to send).
 */
export async function activateDemandSignals(
  installerId: string,
  coveredZips: string[],
  installerName: string
): Promise<{ notified: number }> {
  if (!coveredZips || coveredZips.length === 0) return { notified: 0 };

  // Fetch all unresolved waitlist signals in the new coverage area
  const { data: waitlistSignals, error } = await supabase
    .from("demand_signals")
    .select("id, customer_email, customer_name, zip, source_installer_id, quote_data")
    .in("zip", coveredZips)
    .eq("status", "unresolved")
    .eq("signal_type", "waitlist");

  if (error || !waitlistSignals || waitlistSignals.length === 0) {
    // Still mark anonymous signals as resolved (no email needed)
    await supabase
      .from("demand_signals")
      .update({
        status: "notified",
        resolved_by_installer_id: installerId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("zip", coveredZips)
      .eq("status", "unresolved")
      .eq("signal_type", "anonymous");

    return { notified: 0 };
  }

  // Send activation emails to waitlisted customers
  let notifiedCount = 0;
  try {
    const { sendTransactionalEmail, emailShell } = await import("@/lib/email");
    const { getAppUrl } = await import("@/lib/url-helper");

    for (const signal of waitlistSignals) {
      if (!signal.customer_email) continue;

      try {
        // Build the re-engagement link with referrer attribution + saved quote
        const linkParams = new URLSearchParams({
          zip: signal.zip,
          from: "network",
          signal_id: signal.id,
        });
        if (signal.source_installer_id) {
          linkParams.set("ref_installer", signal.source_installer_id);
        }
        const designUrl = `${getAppUrl()}/design?${linkParams.toString()}`;

        // Summarize their saved build for the email (if they had one)
        const quoteItems = Array.isArray(signal.quote_data) ? signal.quote_data : [];
        const hasSavedBuild = quoteItems.length > 0;
        const totalPrice = quoteItems.reduce((sum: number, u: Record<string, unknown>) =>
          sum + (typeof u.price === "number" ? u.price : 0), 0);
        const depositAmount = Math.round(totalPrice * 0.15 * 100) / 100;
        const firstName = (signal.customer_name || "").split(" ")[0] || "there";

        const buildSummaryHtml = hasSavedBuild
          ? `
            <div style="background:#fffbeb;border:2px solid #fde68a;border-radius:12px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 12px;color:#92400e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">&#9989; Your Saved Build — Ready to Go</p>
              <table style="width:100%;border-collapse:collapse;">
                ${quoteItems.map((u: Record<string, unknown>, i: number) => `
                  <tr>
                    <td style="padding:6px 0;color:#334155;font-size:14px;font-weight:600;">${i + 1}. ${u.desc || `${u.cols}\u00d7${u.rows} Unit`}</td>
                    <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:700;text-align:right;">${u.price ? `$${Number(u.price).toLocaleString()}` : ""}</td>
                  </tr>
                `).join("")}
                ${totalPrice > 0 ? `
                  <tr style="border-top:2px solid #fde68a;">
                    <td style="padding:10px 0 4px;color:#64748b;font-size:13px;">Total Estimate</td>
                    <td style="padding:10px 0 4px;color:#1e293b;font-size:18px;font-weight:800;text-align:right;">$${totalPrice.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding:2px 0;color:#64748b;font-size:12px;">Deposit to Reserve (15%)</td>
                    <td style="padding:2px 0;color:#f59e0b;font-size:14px;font-weight:700;text-align:right;">$${depositAmount.toLocaleString()}</td>
                  </tr>
                ` : ""}
              </table>
            </div>
          `
          : "";

        const ctaText = hasSavedBuild
          ? "Complete My Order &rarr;"
          : "Design My Storage System &rarr;";

        const subjectLine = hasSavedBuild
          ? `${firstName}, your storage build is ready — an installer just joined your area!`
          : `Great news, ${firstName}! An installer is now available in your area`;

        const emailHtml = emailShell(
          "Your Wait Is Over!",
          `
          <!-- Celebration Icon -->
          <div style="text-align:center;margin-bottom:20px;">
            <div style="display:inline-block;background:#d1fae5;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;">
              &#127881;
            </div>
          </div>

          <p style="margin:0 0 16px;color:#334155;font-size:16px;">Hi ${firstName},</p>

          <p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.7;">
            <strong>Great news!</strong> A professional installer has just become available in your area (ZIP ${signal.zip}).
          </p>

          <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.7;">
            <strong style="color:#1e293b;">${installerName}</strong> is a verified Storage Network partner installer and is ready to build your custom tote storage system.
            ${hasSavedBuild ? " Your original configuration is saved and ready to go — just pick up right where you left off." : ""}
          </p>

          ${buildSummaryHtml}

          <!-- CTA Button -->
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${designUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 48px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(250,204,21,0.3);">
              ${ctaText}
            </a>
          </div>

          <!-- Trust Signals -->
          <div style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:12px;padding:16px;margin-bottom:24px;">
            <table style="width:100%;font-size:12px;color:#64748b;">
              <tr>
                <td style="padding:6px 4px;text-align:center;width:33%;">&#128274; Secure Checkout</td>
                <td style="padding:6px 4px;text-align:center;width:33%;">&#128176; Only 15% Deposit</td>
                <td style="padding:6px 4px;text-align:center;width:33%;">&#9989; Pro-Installed</td>
              </tr>
            </table>
          </div>

          <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
            You're receiving this because you joined the waitlist at storage-network.app.
          </p>
          `
        );

        await sendTransactionalEmail({
          to: signal.customer_email,
          toName: signal.customer_name || undefined,
          subject: subjectLine,
          html: emailHtml,
        });

        notifiedCount++;
      } catch (emailErr) {
        console.error("[DemandSignal] Email failed for signal:", signal.id, emailErr);
      }
    }
  } catch (importErr) {
    console.error("[DemandSignal] Email import failed:", importErr);
  }

  // Mark all matching signals (waitlist + anonymous) as notified
  const signalIds = waitlistSignals.map((s) => s.id);
  if (signalIds.length > 0) {
    await supabase
      .from("demand_signals")
      .update({
        status: "notified",
        resolved_by_installer_id: installerId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", signalIds);
  }

  // Also mark anonymous signals in these ZIPs
  await supabase
    .from("demand_signals")
    .update({
      status: "notified",
      resolved_by_installer_id: installerId,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("zip", coveredZips)
    .eq("status", "unresolved")
    .eq("signal_type", "anonymous");

  console.log(`[DemandSignal] Activated: ${notifiedCount} waitlist emails sent, ${waitlistSignals.length} signals resolved for installer ${installerId}`);
  return { notified: notifiedCount };
}
