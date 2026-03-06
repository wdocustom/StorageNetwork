"use server";

import { calculateWeight } from "@/utils/scheduling";
import { validateServiceArea } from "@/app/actions/installer";
import { getDepositAmount } from "@/app/actions/fee-engine";
import { getServiceClient } from "@/lib/supabase-server";

// Uses the SERVICE ROLE key so we can insert without a logged-in user.
const supabase = getServiceClient();

// ═══════════════════════════════════════════════════════════════════════════
// Types — matches the UnitConfig shape from page.tsx
// ═══════════════════════════════════════════════════════════════════════════

export interface QuoteUnit {
  cols: number;
  rows: number;
  toteType: string;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price: number;
  totalW: number;
  totalH: number;
  desc: string;
}

export interface CleanoutServiceItem {
  type: "cleanout_service";
  serviceId: string;
  name: string;
  price: number;
}

export type QuoteItem = QuoteUnit | CleanoutServiceItem;

export interface SubmitQuoteInput {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address: string;
  address_line1?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  delivery_address?: string;
  quote_data: QuoteItem[];
  grand_total: number;
  installer_id?: string;
  referring_installer_id?: string; // Network Bounty: original installer who drove the traffic
  source?: "platform" | "partner_link";
  scheduled_at?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Server Action
// ═══════════════════════════════════════════════════════════════════════════

export async function submitNetworkLead(input: SubmitQuoteInput): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  console.log("🚀 Starting Lead Submission...");

  // 1. Validate Stripe Key
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("CRITICAL: STRIPE_SECRET_KEY is missing");
    return { success: false, error: "Payment system not configured." };
  }

  // 2. Validate inputs
  if (!input.customer_name?.trim()) {
    return { success: false, error: "Name is required." };
  }
  if (!input.customer_email?.trim()) {
    return { success: false, error: "Email is required." };
  }
  if (!input.quote_data || input.quote_data.length === 0) {
    return { success: false, error: "At least one unit is required in the quote." };
  }

  // 3. Service Area Validation — reject leads outside installer's coverage
  if (input.installer_id && input.address_zip) {
    const areaCheck = await validateServiceArea(input.installer_id, input.address_zip);
    if (!areaCheck.inArea) {
      const msg = areaCheck.error
        ? areaCheck.error
        : areaCheck.radiusMiles
          ? `This address (ZIP ${input.address_zip.trim()}) is outside the installer's ${areaCheck.radiusMiles}-mile service area. Please verify the installation ZIP code or contact the installer directly.`
          : `This address (ZIP ${input.address_zip.trim()}) is outside the installer's service area. Please verify the installation ZIP code.`;
      return { success: false, error: msg };
    }
  }

  try {
    // All installers are eligible for referral bounties
    const referralEligible = !!input.referring_installer_id;

    // Separate organizer units from service add-ons (e.g. cleanout)
    const unitItems = input.quote_data.filter((u): u is QuoteUnit => !("type" in u));
    const serviceItems = input.quote_data.filter((u): u is CleanoutServiceItem => "type" in u && u.type === "cleanout_service");

    // Build a human-readable summary for the dimensions field (backward compat)
    const dimensionsSummary = {
      unit_count: unitItems.length,
      grand_total: input.grand_total,
      units: unitItems.map((u, i) => ({
        unit: i + 1,
        cols: u.cols,
        rows: u.rows,
        tote_type: u.toteType,
        includes_totes: u.hasTotes,
        includes_wheels: u.hasWheels,
        includes_top: u.hasTop,
        width_inches: u.totalW,
        height_inches: u.totalH,
        unit_price: u.price,
      })),
      ...(serviceItems.length > 0 ? {
        services: serviceItems.map((s) => ({ name: s.name, price: s.price })),
      } : {}),
    };

    // ── Scheduling Guard: blackout dates + 3 points/day max ─────────────
    if (input.scheduled_at && input.installer_id) {
      // Check blackout dates
      const { data: blackout } = await supabase
        .from("installer_blackout_dates")
        .select("id")
        .eq("installer_id", input.installer_id)
        .lte("start_date", input.scheduled_at)
        .gte("end_date", input.scheduled_at)
        .limit(1);

      if (blackout && blackout.length > 0) {
        return {
          success: false,
          error: "This installer is unavailable on the selected date. Please choose another date.",
        };
      }

      const maxCols = Math.max(...unitItems.map((u) => u.cols), 1);
      const newJobWeight = calculateWeight(maxCols);

      const { data: existingJobs } = await supabase
        .from("leads")
        .select("scheduled_at, quote_data")
        .eq("installer_id", input.installer_id)
        .eq("scheduled_at", input.scheduled_at)
        .not("status", "in", '("cancelled","archived")');

      let currentWeight = 0;
      if (existingJobs) {
        for (const job of existingJobs) {
          const jobCols = Array.isArray(job.quote_data)
            ? Math.max(...(job.quote_data as any[]).map((u: any) => u.cols || 4))
            : 4;
          currentWeight += calculateWeight(jobCols);
        }
      }

      if (currentWeight + newJobWeight > 3) {
        return {
          success: false,
          error: `This date is fully booked (${currentWeight}/3 points used). Please select another date.`,
        };
      }
    }

    // 3. Compute deposit using the installer's custom config (respects 15% floor)
    const depositAmount = await getDepositAmount(input.grand_total, input.installer_id);
    const balanceDue = Math.round((input.grand_total - depositAmount) * 100) / 100;

    // 4. Create lead in database
    const { data, error } = await supabase
      .from("leads")
      .insert({
        installer_id: input.installer_id || null,
        is_network_lead: true,
        customer_name: input.customer_name.trim(),
        customer_email: input.customer_email.trim(),
        customer_phone: input.customer_phone?.trim() || null,
        address: input.address?.trim() || null,
        address_line1: input.address_line1?.trim() || null,
        address_city: input.address_city?.trim() || null,
        address_state: input.address_state?.trim() || null,
        address_zip: input.address_zip?.trim() || null,
        dimensions: dimensionsSummary,
        quote_data: input.quote_data,
        estimated_price: input.grand_total,
        deposit_amount: depositAmount,
        deposit_paid: false,
        balance_due: balanceDue,
        source: input.source || (input.installer_id ? "partner_link" : "platform"),
        status: "pending_payment",
        scheduled_at: input.scheduled_at || null,
        // Network Referral Bounty: track the original installer who drove traffic
        // Bounty is only eligible if the referring installer is a Pro subscriber
        referring_installer_id: input.referring_installer_id || null,
        bounty_status: input.referring_installer_id && referralEligible ? "pending" : "none",
        notes: `${unitItems.length} unit(s)${serviceItems.length > 0 ? ` + ${serviceItems.map((s) => s.name).join(", ")}` : ""} — Grand Total: $${input.grand_total.toLocaleString()}${input.delivery_address ? `\n📍 Installation Address: ${input.delivery_address}` : ""}`,
      })
      .select("id")
      .single();

    if (error) {
      console.error("❌ SUPABASE INSERT FAILED:", error);
      return { success: false, error: "Failed to submit quote request. Please try again." };
    }

    // Extract the plain string ID before any async work
    const leadId: string = data.id;
    console.log("✅ Lead Created:", leadId);

    // NOTE: New booking alert email is sent from the Stripe webhook AFTER deposit is paid.
    // This prevents double-emailing the installer (one at lead creation, one at payment).

    // Network Referral Bounty: notify the referring installer about the handoff
    if (input.referring_installer_id) {
      (async () => {
        try {
          const { data: referrer } = await supabase
            .from("profiles")
            .select("email, business_name, first_name")
            .eq("id", input.referring_installer_id!)
            .single();

          if (referrer?.email) {
            // Fetch the local installer name for the email
            let localInstallerName: string | null = null;
            if (input.installer_id) {
              const { data: localInstaller } = await supabase
                .from("profiles")
                .select("business_name")
                .eq("id", input.installer_id)
                .single();
              localInstallerName = localInstaller?.business_name || null;
            }

            // Estimate the bounty: 30% of actual deposit, min $15
            const estimatedBounty = Math.max(Math.round(depositAmount * 0.30 * 100) / 100, 15);

            const { sendReferralHandoffEmail } = await import("@/lib/email");
            await sendReferralHandoffEmail(referrer.email, {
              referrerName: referrer.business_name || referrer.first_name || "Installer",
              customerCity: input.address_city || null,
              customerState: input.address_state || null,
              customerZip: input.address_zip || null,
              localInstallerName,
              estimatedBounty,
            });
          }
        } catch (emailErr) {
          console.error("[Referral] Handoff email failed (non-fatal):", emailErr);
        }
      })();
    }

    // 4. CRITICAL: Return only plain JSON — no Date objects, no DB rows
    return { success: true, id: leadId };

  } catch (error: any) {
    // 5. Log the REAL error for server-side debugging
    console.error("❌ SUBMISSION FAILED — FULL ERROR:", error);
    return {
      success: false,
      error: error.message || "Failed to submit quote.",
    };
  }
}
