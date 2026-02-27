"use server";

import { createClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";
import {
  sendTransactionalEmail,
  buildQuoteEmailTemplate,
} from "@/lib/email";

// ═══════════════════════════════════════════════════════════════════════════
// Create Quote — Black Box Server Action
// Saves lead, calculates price server-side, sends email via Brevo
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export interface DeliveryAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface CreateQuoteInput {
  installer_id: string;
  installer_business_name: string;
  installer_first_name?: string;
  installer_phone?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  quote_data: QuoteUnit[];
  grand_total: number;
  project_title?: string;
  discount_code?: string;
  delivery_address?: DeliveryAddress;
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
 * All pricing validated server-side, email sent via Brevo.
 */
export async function createQuote(
  input: CreateQuoteInput
): Promise<CreateQuoteResult> {
  const {
    installer_id,
    installer_business_name,
    installer_first_name,
    installer_phone,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    quote_data,
    grand_total,
    project_title,
    discount_code,
    delivery_address,
  } = input;

  // ── Validation ──────────────────────────────────────────────────────────
  if (!customer_name?.trim()) {
    return { success: false, error: "Customer name is required." };
  }

  const normalizedEmail = customer_email?.trim().toLowerCase() || null;

  if (!quote_data?.length) {
    return { success: false, error: "Quote must contain at least one item." };
  }

  if (!installer_id) {
    return { success: false, error: "Installer ID is required." };
  }

  try {
    // ── 1. Create or Find Customer ────────────────────────────────────────
    let customerId: string;

    // If email provided, try to find existing customer by email + installer
    let existingCustomer = null;
    if (normalizedEmail) {
      const { data } = await supabase
        .from("customers")
        .select("id")
        .eq("email", normalizedEmail)
        .eq("installer_id", installer_id)
        .single();
      existingCustomer = data;
    }

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
          email: normalizedEmail,
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
        customer_email: normalizedEmail,
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
        // Delivery / installation address (entered by installer at quote time)
        delivery_address_line1: delivery_address?.line1 || null,
        delivery_address_line2: delivery_address?.line2 || null,
        delivery_address_city: delivery_address?.city || null,
        delivery_address_state: delivery_address?.state || null,
        delivery_address_zip: delivery_address?.zip || null,
      })
      .select("id")
      .single();

    if (leadError || !lead) {
      console.error("[Quote] Lead create error:", JSON.stringify(leadError));
      const detail = leadError?.message || leadError?.code || "Unknown DB error";
      return { success: false, error: `Failed to create quote: ${detail}` };
    }

    // ── 4. Send Email via Brevo (only if email provided) ──────────────────
    let emailSent = false;

    if (normalizedEmail) {
      const baseUrl = siteConfig.baseUrl;
      const checkoutUrl = `${baseUrl}/pay/${lead.id}`;

      // Build quote items for email
      const quoteItems = quote_data.map((unit) => ({
        description: unit.desc || `${unit.cols}×${unit.rows} Storage Unit`,
        price: unit.price,
      }));

      // Generate email HTML (white-label: uses businessName, no hardcoded brands)
      const emailHtml = await buildQuoteEmailTemplate({
        customerName: customer_name.trim(),
        businessName: installer_business_name || siteConfig.name,
        installerFirstName: installer_first_name || undefined,
        installerPhone: installer_phone || undefined,
        quoteItems,
        totalPrice: finalTotal,
        depositAmount,
        checkoutUrl,
      });

      // Build subject line
      const bizName = installer_business_name || siteConfig.name;
      const subjectTitle = project_title
        ? `Quote for ${customer_name.trim()} - ${project_title}`
        : `Your Custom Storage Design & Quote from ${bizName}`;

      // Send email with installer's business name as sender
      const emailResult = await sendTransactionalEmail({
        to: normalizedEmail,
        toName: customer_name.trim(),
        subject: subjectTitle,
        html: emailHtml,
        senderName: installer_business_name || undefined, // White-label: use installer name
      });

      if (!emailResult.success) {
        console.error("[Quote] Email send failed:", emailResult.error);
        // Don't fail the whole operation — quote was saved
      }
      emailSent = emailResult.success;
    }

    return {
      success: true,
      lead_id: lead.id,
      customer_id: customerId,
      email_sent: emailSent,
    };
  } catch (err) {
    console.error("[Quote] Unexpected error:", err);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
