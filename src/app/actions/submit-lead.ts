"use server";

import { z } from "zod/v4";
import { calculateWeight } from "@/utils/scheduling";
import { validateServiceArea } from "@/app/actions/installer";
import { getDepositAmount } from "@/app/actions/fee-engine";
import { checkProTrial } from "@/app/actions/pro-trial";
import { getServiceClient } from "@/lib/supabase-server";
import { roundMoney, calculateBalanceDue } from "@/utils/mathHelpers";
import { sendTrialCapHotLead, sendTrialCapCustomerConfirmation } from "@/lib/email";
import {
  enforceActionRateLimit,
  RateLimitError,
} from "@/lib/server/action-rate-limit";

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
  addons?: Array<{
    type: string;
    target: number | "left" | "right" | "doors_on";
    row?: number;
    options?: Record<string, string>;
  }>;
  quantity?: number;
  /** When true, customer wants this item delivered inside the home */
  indoorDelivery?: boolean;
  /** The indoor delivery fee charged for this item (in dollars) */
  indoorDeliveryFee?: number;
}

export interface CleanoutServiceItem {
  type: "cleanout_service";
  serviceId: string;
  name: string;
  price: number;
}

export interface PaintItem {
  type: "paint";
  name: string;
  price: number;
}

export type QuoteItem = QuoteUnit | CleanoutServiceItem | PaintItem;

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
  source?: "platform" | "partner_link" | "facebook_referral";
  parent_lead_id?: string;
  scheduled_at?: string;
  /** When true, bypasses the trial cap block and creates the lead with
   *  status "waitlisted" instead of "pending_payment". Used when the
   *  installer has hit their 3-job trial limit — the lead is captured
   *  as a hostage to drive subscription conversion. */
  waitlisted?: boolean;
  build_snapshot_url?: string;
  /** Realtor referral program: code from `/refer/<code>` cookie or `?ref=`
   *  on the booking URL. Resolved server-side to referred_by_realtor_id;
   *  triggers the platform-fee waiver + 5-tote credit on deposit_paid. */
  realtor_referral_code?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Server Action
// ═══════════════════════════════════════════════════════════════════════════

const submitLeadSchema = z.object({
  customer_name: z.string().min(1, "Name is required").max(200),
  customer_email: z.email("Invalid email address"),
  customer_phone: z.string().max(30).optional().default(""),
  address: z.string().max(500).optional().default(""),
  address_line1: z.string().max(200).optional(),
  address_city: z.string().max(100).optional(),
  address_state: z.string().max(2).optional(),
  address_zip: z.string().regex(/^\d{5}$/, "Invalid ZIP code").optional(),
  delivery_address: z.string().max(500).optional(),
  quote_data: z.array(z.record(z.string(), z.unknown())).min(1, "At least one unit is required"),
  grand_total: z.number().positive("Total must be positive").max(1_000_000),
  installer_id: z.string().uuid("Invalid installer ID").optional(),
  referring_installer_id: z.string().uuid().optional(),
  source: z.enum(["platform", "partner_link", "facebook_referral"]).optional(),
  parent_lead_id: z.string().uuid().optional(),
  scheduled_at: z.string().max(30).optional(),
  waitlisted: z.boolean().optional(),
  build_snapshot_url: z.string().url().max(2000).optional(),
  realtor_referral_code: z.string().min(4).max(32).optional(),
});

export async function submitNetworkLead(input: SubmitQuoteInput): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  console.log("🚀 Starting Lead Submission...");

  // SECURITY (H-3): public, anonymous endpoint — strict per-IP limit so a
  // bot cannot spam the leads table or trigger trial-cap email blasts.
  try {
    await enforceActionRateLimit({
      action: "submit-lead",
      limit: 3,
      window: "1 h",
      identify: "ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  // 1. Validate Stripe Key
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("CRITICAL: STRIPE_SECRET_KEY is missing");
    return { success: false, error: "Payment system not configured." };
  }

  // 2. Validate inputs with Zod
  const parsed = submitLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input." };
  }

  // Re-assign validated input (downstream code uses input.*)
  const validatedInput = { ...input, ...parsed.data };

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

  // 4. Trial Job Cap — block new bookings when installer's 3-job trial limit reached
  // Customer-facing message is intentionally vague — they don't need to know about trial internals.
  // Skip this check when `waitlisted` is true — the lead is being captured intentionally
  // as a hostage to drive the installer's subscription conversion.
  if (input.installer_id && !input.waitlisted) {
    const trialStatus = await checkProTrial(input.installer_id);
    if (trialStatus.softLocked || (trialStatus.jobCapReached && trialStatus.onTrial)) {
      return { success: false, error: "This installer is not accepting new bookings right now. Please contact them directly." };
    }
  }

  try {
    // Realtor referral attribution: resolve the inbound code to a realtor
    // profile here so the lead row carries `referred_by_realtor_id` from
    // the start. Unknown / inactive codes attribute to nobody (silent —
    // we already validated at /refer/<code> landing; this guard catches
    // suspensions or profile deletions that happened after the cookie
    // was set). Self-referrals (realtor === local installer) are blocked.
    let referredByRealtorId: string | null = null;
    if (input.realtor_referral_code) {
      const normalizedCode = input.realtor_referral_code.trim().toUpperCase();
      const { data: realtor } = await supabase
        .from("profiles")
        .select("id, is_realtor, is_suspended")
        .eq("realtor_referral_code", normalizedCode)
        .maybeSingle();
      if (
        realtor &&
        realtor.is_realtor === true &&
        realtor.is_suspended !== true &&
        realtor.id !== input.installer_id
      ) {
        referredByRealtorId = realtor.id as string;
      }
    }

    // Referral bounty eligibility: must have a referring installer who
    // isn't soft-locked (trial expired with active jobs in grace period).
    // Soft-locked installers can finish existing jobs but shouldn't earn
    // new bounties — that's a paid-subscriber benefit.
    let referralEligible = !!input.referring_installer_id;
    if (referralEligible && input.referring_installer_id) {
      const { data: refProfile } = await supabase
        .from("profiles")
        .select("pro_trial_ends_at, stripe_subscription_id")
        .eq("id", input.referring_installer_id)
        .maybeSingle();
      if (refProfile?.pro_trial_ends_at && !refProfile.stripe_subscription_id) {
        const trialEnd = new Date(refProfile.pro_trial_ends_at);
        if (new Date() >= trialEnd) {
          referralEligible = false;
        }
      }
    }

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
      ...(input.build_snapshot_url ? { build_snapshot_url: input.build_snapshot_url } : {}),
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
    const balanceDue = calculateBalanceDue(input.grand_total, depositAmount);

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
        parent_lead_id: input.parent_lead_id || null,
        status: input.waitlisted ? "waitlisted" : "pending_payment",
        scheduled_at: input.scheduled_at || null,
        // Network Referral Bounty: track the original installer who drove traffic
        // Bounty is only eligible if the referring installer is a Pro subscriber
        referring_installer_id: input.referring_installer_id || null,
        bounty_status: input.referring_installer_id && referralEligible ? "pending" : "none",
        // Realtor referral program: see migration 119 for the credit flow.
        referred_by_realtor_id: referredByRealtorId,
        realtor_referral_code_snapshot: referredByRealtorId
          ? input.realtor_referral_code!.trim().toUpperCase()
          : null,
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

    // Waitlisted leads: send trial cap emails immediately (no deposit to wait for).
    // Installer gets a "hostage" email with the dollar amount; customer gets confirmation.
    if (input.waitlisted && input.installer_id) {
      (async () => {
        try {
          const { data: installer } = await supabase
            .from("profiles")
            .select("email, business_name, first_name")
            .eq("id", input.installer_id!)
            .single();

          const installerName = installer?.business_name || installer?.first_name || "Installer";
          const quoteDataForEmail = unitItems.map((u) => ({
            desc: u.desc,
            cols: u.cols,
            rows: u.rows,
            price: u.price,
          }));

          if (installer?.email) {
            sendTrialCapHotLead(installer.email, {
              installerName,
              customerName: input.customer_name.trim(),
              customerEmail: input.customer_email.trim(),
              customerPhone: input.customer_phone?.trim(),
              grandTotal: input.grand_total,
              quoteData: quoteDataForEmail,
            }).catch((err) => console.error("[TrialCap] Installer email failed:", err));
          }

          sendTrialCapCustomerConfirmation(input.customer_email.trim(), {
            customerName: input.customer_name.trim(),
            installerBusinessName: installerName,
            grandTotal: input.grand_total,
            quoteData: quoteDataForEmail,
          }).catch((err) => console.error("[TrialCap] Customer email failed:", err));
        } catch (err) {
          console.error("[TrialCap] Email flow error:", err);
        }
      })();
    }

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
            const estimatedBounty = Math.max(roundMoney(depositAmount * 0.30), 15);

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
