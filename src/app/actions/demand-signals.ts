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
}): Promise<{ success: boolean; error?: string }> {
  const trimmed = input.zip.trim();
  if (!/^\d{5}$/.test(trimmed)) {
    return { success: false, error: "Invalid ZIP code." };
  }
  if (!input.customerName?.trim() || !input.customerEmail?.trim()) {
    return { success: false, error: "Name and email are required." };
  }

  const { error } = await supabase.from("demand_signals").insert({
    zip: trimmed,
    signal_type: "waitlist",
    status: "unresolved",
    customer_name: input.customerName.trim(),
    customer_email: input.customerEmail.trim(),
    customer_phone: input.customerPhone?.trim() || null,
    source_installer_id: input.sourceInstallerId || null,
  });

  if (error) {
    console.error("[DemandSignal] Insert failed:", error);
    return { success: false, error: "Failed to save waitlist request." };
  }

  return { success: true };
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
    .select("id, customer_email, customer_name, zip")
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
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a1a; margin-bottom: 8px;">Great News!</h2>
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
              Hi ${signal.customer_name || "there"}, a Storage Network installer is now available in your area (ZIP ${signal.zip}).
            </p>
            <p style="color: #666; font-size: 14px; margin-bottom: 24px;">
              <strong>${installerName}</strong> is ready to build your custom tote storage system.
            </p>
            <a href="https://www.storage-network.app/design?zip=${signal.zip}&from=network"
               style="display: block; background: #facc15; color: #1a1a1a; text-align: center; padding: 14px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 15px;">
              Design Your Storage System →
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
