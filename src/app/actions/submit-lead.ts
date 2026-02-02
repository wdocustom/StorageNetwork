"use server";

import { createClient } from "@supabase/supabase-js";
import { calculateWeight } from "@/utils/scheduling";

// Uses the SERVICE ROLE key so we can insert without a logged-in user.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export interface SubmitQuoteInput {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address: string;
  address_line1?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  quote_data: QuoteUnit[];
  grand_total: number;
  installer_id?: string;
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

  try {
    // Build a human-readable summary for the dimensions field (backward compat)
    const dimensionsSummary = {
      unit_count: input.quote_data.length,
      grand_total: input.grand_total,
      units: input.quote_data.map((u, i) => ({
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

      const maxCols = Math.max(...input.quote_data.map((u) => u.cols));
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

    // 3. Create lead in database
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
        deposit_amount: Math.round(input.grand_total * 0.15 * 100) / 100,
        deposit_paid: false,
        balance_due: Math.round(input.grand_total * 0.85 * 100) / 100,
        source: input.source || (input.installer_id ? "partner_link" : "platform"),
        status: "pending_payment",
        scheduled_at: input.scheduled_at || null,
        notes: `${input.quote_data.length} unit(s) — Grand Total: $${input.grand_total.toLocaleString()}`,
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

    // Fire new lead alert email to installer (non-blocking)
    if (input.installer_id) {
      console.log("[SubmitLead] Firing new lead alert for installer:", input.installer_id);
      import("@/lib/email").then(async ({ sendNewLeadAlert }) => {
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(input.installer_id!);
          const email = authUser?.user?.email;
          console.log("[SubmitLead] Installer email resolved:", email || "NOT FOUND");
          if (email) {
            const result = await sendNewLeadAlert(email, input.address || "Unknown", {
              customerName: input.customer_name,
              unitCount: input.quote_data.length,
              totalPrice: input.grand_total,
              leadId,
            });
            console.log("[SubmitLead] New lead alert result:", result);
          }
        } catch (err) {
          console.error("[SubmitLead] New lead alert error:", err);
        }
      }).catch((err) => console.error("[SubmitLead] Email import failed:", err));
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
