"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const { sendTransactionalEmail } = await import("@/lib/email");

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
        const designUrl = `https://www.storage-network.app/design?${linkParams.toString()}`;

        // Summarize their saved build for the email (if they had one)
        const quoteItems = Array.isArray(signal.quote_data) ? signal.quote_data : [];
        const buildSummaryHtml = quoteItems.length > 0
          ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
              <p style="margin: 0 0 8px; color: #1a1a1a; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Your Saved Build</p>
              ${quoteItems.map((u: Record<string, unknown>, i: number) => `
                <p style="margin: 0; color: #666; font-size: 13px; line-height: 1.8;">
                  Unit ${i + 1}: ${u.desc || `${u.cols}×${u.rows}`}${u.price ? ` — $${Number(u.price).toLocaleString()}` : ""}
                </p>
              `).join("")}
            </div>
          `
          : "";

        const ctaText = quoteItems.length > 0
          ? "Continue With Your Build →"
          : "Design Your Storage System →";

        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a1a; margin-bottom: 8px;">Great News!</h2>
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
              Hi ${signal.customer_name || "there"}, a Storage Network installer is now available in your area (ZIP ${signal.zip}).
            </p>
            <p style="color: #666; font-size: 14px; margin-bottom: 24px;">
              <strong>${installerName}</strong> is ready to build your custom tote storage system.
            </p>
            ${buildSummaryHtml}
            <a href="${designUrl}"
               style="display: block; background: #facc15; color: #1a1a1a; text-align: center; padding: 14px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 15px;">
              ${ctaText}
            </a>
            <p style="color: #aaa; font-size: 11px; text-align: center; margin-top: 16px;">
              You're receiving this because you joined the waitlist at storage-network.app.
            </p>
          </div>
        `;

        await sendTransactionalEmail({
          to: signal.customer_email,
          toName: signal.customer_name || undefined,
          subject: `An installer is now available in your area (ZIP ${signal.zip})`,
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
