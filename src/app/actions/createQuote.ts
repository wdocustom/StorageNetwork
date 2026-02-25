"use server";

import { createClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";
import {
  sendTransactionalEmail,
  buildQuoteEmailTemplate,
} from "@/lib/email";

// ═══════════════════════════════════════════════════════════════════════════
// Create Quote — Black Box Server Action
// Saves lead, calculates price server-side, sends email via Resend
// ═══════════════════════════════════════════════════════════════════════════

// Lazy Supabase client — avoids module-level crash if env vars are missing
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

const DEPOSIT_RATE = 0.15; // 15%

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

export interface CreateQuoteInput {
  installer_id: string;
  installer_business_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_address?: string;
  quote_data: QuoteUnit[];
  grand_total: number;
  project_title?: string;
  discount_code?: string;
  skip_email?: boolean;
}

export interface CreateQuoteResult {
  success: boolean;
  lead_id?: string;
  customer_id?: string;
  email_sent?: boolean;
  error?: string;
}

/**
 * Create a quote and send it via email.
 * All pricing validated server-side, email sent via Resend.
 */
export async function createQuote(
  input: CreateQuoteInput
): Promise<CreateQuoteResult> {
  try {
    const {
      installer_id,
      installer_business_name,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      quote_data,
      grand_total,
      project_title,
      discount_code,
      skip_email,
    } = input;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!customer_name?.trim() || !customer_email?.trim()) {
      return { success: false, error: "Customer name and email are required." };
    }

    if (!quote_data?.length) {
      return { success: false, error: "Quote must contain at least one item." };
    }

    if (!installer_id) {
      return { success: false, error: "Installer ID is required." };
    }

    const supabase = getSupabase();

    // ── 1. Create or Find Customer ────────────────────────────────────────
    let customerId: string;
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("email", customer_email.toLowerCase().trim())
      .eq("installer_id", installer_id)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Update customer info
      await supabase
        .from("customers")
        .update({
          name: customer_name.trim(),
          phone: customer_phone?.trim() || null,
          address: customer_address?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);
    } else {
      // Create new customer
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: customer_name.trim(),
          email: customer_email.toLowerCase().trim(),
          phone: customer_phone?.trim() || null,
          address: customer_address?.trim() || null,
          installer_id,
          source: "quote",
        })
        .select("id")
        .single();

      if (customerError || !newCustomer) {
        console.error("[Quote] Customer create error:", customerError);
        return { success: false, error: "Failed to create customer record." };
      }
      customerId = newCustomer.id;
    }

    // ── 2. Calculate Totals Server-Side ─────────────────────────────────
    // Re-validate the grand total on server (don't trust client-provided total)
    const serverTotal = quote_data.reduce((sum, unit) => sum + unit.price, 0);
    const finalTotal = serverTotal > 0 ? serverTotal : grand_total;

    const depositAmount = Math.round(finalTotal * DEPOSIT_RATE * 100) / 100;
    const balanceDue = Math.round((finalTotal - depositAmount) * 100) / 100;

    // ── 3. Create Lead Record ─────────────────────────────────────────────
    // status: "pending_payment" allows the /pay page to find and process the lead
    // deposit_paid: false ensures this doesn't appear in installer dashboard
    // until the customer pays the deposit (which sets deposit_paid: true, status: "open")
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        installer_id,
        customer_id: customerId,
        customer_name: customer_name.trim(),
        customer_email: customer_email.toLowerCase().trim(),
        customer_phone: customer_phone?.trim() || null,
        address: customer_address?.trim() || null,
        quote_data,
        estimated_price: finalTotal,
        deposit_amount: depositAmount,
        balance_due: balanceDue,
        source: "installer_manual",
        status: "pending_payment",
        deposit_paid: false,
        discount_code: discount_code?.toUpperCase() || null,
      })
      .select("id")
      .single();

    if (leadError || !lead) {
      console.error("[Quote] Lead create error:", JSON.stringify(leadError));
      // Surface the actual DB error so we can debug
      const detail = leadError?.message || leadError?.code || "Unknown DB error";
      return { success: false, error: `Failed to create quote: ${detail}` };
    }

    // ── 4. Send Email (unless skip_email) ────────────────────────────────
    if (skip_email) {
      return {
        success: true,
        lead_id: lead.id,
        customer_id: customerId,
        email_sent: false,
      };
    }

    const baseUrl = siteConfig.baseUrl;
    const checkoutUrl = `${baseUrl}/pay/${lead.id}`;

    // Build quote items for email
    const quoteItems = quote_data.map((unit) => ({
      description: unit.desc || `${unit.cols}×${unit.rows} Storage Unit`,
      price: unit.price,
    }));

    // Generate email HTML (white-label: uses businessName, no hardcoded brands)
    const emailHtml = buildQuoteEmailTemplate({
      customerName: customer_name.trim(),
      businessName: installer_business_name || siteConfig.name,
      quoteItems,
      totalPrice: finalTotal,
      depositAmount,
      checkoutUrl,
    });

    // Build subject line
    const subjectTitle = project_title
      ? `Quote for ${customer_name.trim()} - ${project_title}`
      : `Your Quote from ${installer_business_name || siteConfig.name}`;

    // Send email with installer's business name as sender
    const emailResult = await sendTransactionalEmail({
      to: customer_email.toLowerCase().trim(),
      toName: customer_name.trim(),
      subject: subjectTitle,
      html: emailHtml,
      senderName: installer_business_name || undefined, // White-label: use installer name
    });

    if (!emailResult.success) {
      console.error("[Quote] Email send failed:", emailResult.error);
      // Don't fail the whole operation — quote was saved
    }

    return {
      success: true,
      lead_id: lead.id,
      customer_id: customerId,
      email_sent: emailResult.success,
    };
  } catch (err) {
    console.error("[Quote] Unexpected error:", err);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
