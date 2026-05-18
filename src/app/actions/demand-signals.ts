"use server";

import zipcodes from "zipcodes";
import { getServiceClient } from "@/lib/supabase-server";
import { roundMoney } from "@/utils/mathHelpers";

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
 * Public preview for the installer onboarding pages (/invite, /join).
 *
 * Given a ZIP, expand to a 85-mile radius and return a count of unresolved
 * waitlist signals + total demand signals in that area. Used to show
 * "X customers in your area are already waiting" banners at signup time.
 *
 * Returns zero counts on invalid input (so callers can render "no demand"
 * state without checking for errors).
 */
export async function getDemandPreviewForZip(
  zip: string,
  radiusMiles: number = 85
): Promise<{ waitlist: number; total: number; radiusMiles: number; zipsInRadius: number }> {
  const trimmed = (zip || "").trim();
  if (!/^\d{5}$/.test(trimmed)) {
    return { waitlist: 0, total: 0, radiusMiles, zipsInRadius: 0 };
  }

  // Cap at 85 miles to match the territory model — npm zipcodes returns the
  // input ZIP itself as the first element when it's a valid US ZIP.
  let nearby: string[] = [];
  try {
    nearby = zipcodes.radius(trimmed, Math.min(radiusMiles, 85));
  } catch {
    nearby = [trimmed];
  }
  if (!nearby.includes(trimmed)) nearby.push(trimmed);

  const counts = await getDemandCountForZips(nearby);
  return {
    waitlist: counts.waitlist,
    total: counts.total,
    radiusMiles,
    zipsInRadius: nearby.length,
  };
}

interface WaitlistSignalForEmail {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  zip: string;
  source_installer_id: string | null;
  quote_data: unknown;
}

/**
 * Render and send a single waitlist activation email for one demand signal.
 * Shared by activateDemandSignals() (installer-profile path) and the cron
 * sweep (covers admin-edited or DB-edited service_zips). Returns true on
 * successful send so callers can count emitted emails.
 */
async function sendWaitlistActivationEmail(
  signal: WaitlistSignalForEmail,
  installerName: string,
): Promise<boolean> {
  if (!signal.customer_email) return false;

  try {
    const { sendTransactionalEmail } = await import("@/lib/email");
    const { masterEmailLayout } = await import("@/lib/emails/components/masterEmailLayout");
    const { getAppUrl } = await import("@/lib/url-helper");

    const linkParams = new URLSearchParams({
      zip: signal.zip,
      from: "network",
      signal_id: signal.id,
    });
    if (signal.source_installer_id) {
      linkParams.set("ref_installer", signal.source_installer_id);
    }
    const designUrl = `${getAppUrl()}/design?${linkParams.toString()}`;

    const quoteItems = Array.isArray(signal.quote_data) ? signal.quote_data : [];
    const hasSavedBuild = quoteItems.length > 0;
    const totalPrice = quoteItems.reduce(
      (sum: number, u: Record<string, unknown>) =>
        sum + (typeof u.price === "number" ? u.price : 0),
      0,
    );
    const depositAmount = roundMoney(totalPrice * 0.15);
    const firstName = (signal.customer_name || "").split(" ")[0] || "there";

    const buildSummaryHtml = hasSavedBuild
      ? `
        <p style="margin:0 0 12px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Your Saved Build — Ready to Go</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 8px;">
          ${quoteItems.map((u: Record<string, unknown>, i: number) => `
            <tr>
              <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.5;">
                <span style="color:#facc15;font-weight:700;margin-right:8px;">${i + 1}.</span>${u.desc || `${u.cols}×${u.rows} Unit`}
              </td>
              <td style="padding:14px 0;border-bottom:1px solid #222;text-align:right;color:#ffffff;font-weight:700;font-size:14px;white-space:nowrap;">${u.price ? `$${Number(u.price).toLocaleString()}` : ""}</td>
            </tr>
          `).join("")}
          ${totalPrice > 0 ? `
            <tr>
              <td style="padding:18px 0 0;color:#a3a3a3;font-size:13px;font-weight:600;vertical-align:bottom;">Total Estimate</td>
              <td style="padding:18px 0 0;text-align:right;color:#facc15;font-size:22px;font-weight:900;">$${totalPrice.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding:8px 0 0;color:#a3a3a3;font-size:13px;">Secure Deposit (15%)</td>
              <td style="padding:8px 0 0;text-align:right;color:#ffffff;font-size:14px;font-weight:700;">$${depositAmount.toLocaleString()}</td>
            </tr>
          ` : ""}
        </table>
        <div style="border-top:1px solid #222;margin:24px 0 28px;"></div>
      `
      : "";

    const ctaText = hasSavedBuild ? "Complete My Order" : "Design My Storage System";
    const subjectLine = hasSavedBuild
      ? `${firstName}, your build is ready — an installer just joined your area`
      : `${firstName}, an installer is now in your area`;

    const emailHtml = masterEmailLayout(
      "Your Wait Is Over",
      `
      <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${firstName},</p>
      <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
        A vetted Storage Network installer is now live in <strong style="color:#facc15;">ZIP ${signal.zip}</strong>. <strong style="color:#ffffff;">${installerName}</strong> can build your Heavy-Duty Tote System and lock in your install date.${hasSavedBuild ? " Your saved Custom 3D Design is one click away from confirmation." : ""}
      </p>

      ${buildSummaryHtml}

      <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 28px;">
        <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">${ctaText}</p>
        <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;">${hasSavedBuild ? "Pick up right where you left off — your saved configuration loads instantly." : "Design your system in 30 seconds and lock in your install date."}</p>
        <a href="${designUrl}" style="display:inline-block;background-color:#facc15;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">${ctaText}</a>
      </div>

      <table style="width:100%;font-size:11px;color:#555;margin:0 0 24px;">
        <tr>
          <td style="text-align:center;padding:6px 8px;">🔒 Secure Checkout</td>
          <td style="text-align:center;padding:6px 8px;">💰 15% Deposit</td>
          <td style="text-align:center;padding:6px 8px;">✅ Pro-Installed</td>
        </tr>
      </table>

      <p style="margin:0;color:#555;font-size:12px;text-align:center;">
        You're receiving this because you joined the waitlist at storage-network.app.
      </p>
      `,
    );

    await sendTransactionalEmail({
      to: signal.customer_email,
      toName: signal.customer_name || undefined,
      subject: subjectLine,
      html: emailHtml,
    });

    return true;
  } catch (emailErr) {
    console.error("[DemandSignal] Email failed for signal:", signal.id, emailErr);
    return false;
  }
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

  let notifiedCount = 0;
  for (const signal of waitlistSignals) {
    const sent = await sendWaitlistActivationEmail(signal, installerName);
    if (sent) notifiedCount++;
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

/**
 * Sweep all unresolved waitlist signals and notify customers whose ZIP is
 * now covered by some installer's service_zips. This is the safety net for
 * coverage changes that bypass updateInstallerProfile() — for example, an
 * admin granting an installer a ZIP directly in SQL.
 *
 * Intended to be invoked by a daily cron route.
 */
export async function sweepUnresolvedWaitlistMatches(): Promise<{
  scanned: number;
  notified: number;
  resolvedAnonymous: number;
}> {
  // Pull every unresolved waitlist signal with a customer email
  const { data: signals, error } = await supabase
    .from("demand_signals")
    .select("id, customer_email, customer_name, zip, source_installer_id, quote_data")
    .eq("status", "unresolved")
    .eq("signal_type", "waitlist")
    .not("customer_email", "is", null);

  if (error) {
    console.error("[DemandSignal] Sweep query failed:", error);
    return { scanned: 0, notified: 0, resolvedAnonymous: 0 };
  }

  const list = signals ?? [];
  let notified = 0;

  for (const signal of list) {
    // Find any installer who covers this ZIP. Prefer the source installer
    // (the one who originally captured the lead) when they cover it.
    const { data: installers } = await supabase
      .from("profiles")
      .select("id, business_name, first_name, last_name")
      .contains("service_zips", [signal.zip])
      .limit(5);

    const candidates = installers ?? [];
    if (candidates.length === 0) continue;

    const match =
      candidates.find((p) => p.id === signal.source_installer_id) ??
      candidates[0];

    const installerName =
      (match.business_name as string | null) ||
      [match.first_name, match.last_name].filter(Boolean).join(" ") ||
      "A local installer";

    const sent = await sendWaitlistActivationEmail(signal, installerName);
    if (!sent) continue;

    await supabase
      .from("demand_signals")
      .update({
        status: "notified",
        resolved_by_installer_id: match.id,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", signal.id);

    notified++;
  }

  // Clean up anonymous signals whose ZIP is now covered (no email needed).
  const { data: anonSignals } = await supabase
    .from("demand_signals")
    .select("id, zip")
    .eq("status", "unresolved")
    .eq("signal_type", "anonymous");

  let resolvedAnonymous = 0;
  for (const anon of anonSignals ?? []) {
    const { data: cover } = await supabase
      .from("profiles")
      .select("id")
      .contains("service_zips", [anon.zip])
      .limit(1);
    if (!cover || cover.length === 0) continue;

    await supabase
      .from("demand_signals")
      .update({
        status: "notified",
        resolved_by_installer_id: cover[0].id,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", anon.id);
    resolvedAnonymous++;
  }

  console.log(
    `[DemandSignal] Sweep: scanned=${list.length} notified=${notified} anonymousResolved=${resolvedAnonymous}`,
  );
  return { scanned: list.length, notified, resolvedAnonymous };
}
