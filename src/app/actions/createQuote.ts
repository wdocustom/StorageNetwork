"use server";

import { createClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Create Quote — Manual quote engine with Brevo email
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BREVO_API_KEY = process.env.BREVO_API_KEY;
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
}

export interface CreateQuoteResult {
  success: boolean;
  lead_id?: string;
  customer_id?: string;
  error?: string;
}

/**
 * Create a quote and send it via email (Brevo).
 * This creates a customer record, a lead record, and sends an email.
 */
export async function createQuote(
  input: CreateQuoteInput
): Promise<CreateQuoteResult> {
  const {
    installer_id,
    installer_business_name,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    quote_data,
    grand_total,
  } = input;

  try {
    // 1. Create or find customer
    let customerId: string;
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("email", customer_email)
      .eq("installer_id", installer_id)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Update customer info
      await supabase
        .from("customers")
        .update({
          name: customer_name,
          phone: customer_phone || null,
          address: customer_address || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);
    } else {
      // Create new customer
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: customer_name,
          email: customer_email,
          phone: customer_phone || null,
          address: customer_address || null,
          installer_id,
          source: "quote",
        })
        .select("id")
        .single();

      if (customerError || !newCustomer) {
        console.error("Customer create error:", customerError);
        return { success: false, error: "Failed to create customer record." };
      }
      customerId = newCustomer.id;
    }

    // 2. Calculate deposit
    const depositAmount = Math.round(grand_total * DEPOSIT_RATE * 100) / 100;
    const balanceDue = Math.round((grand_total - depositAmount) * 100) / 100;

    // 3. Create lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        installer_id,
        customer_id: customerId,
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        address: customer_address || null,
        quote_data,
        estimated_price: grand_total,
        deposit_amount: depositAmount,
        balance_due: balanceDue,
        source: "installer_manual",
        status: "new",
      })
      .select("id")
      .single();

    if (leadError || !lead) {
      console.error("Lead create error:", leadError);
      return { success: false, error: "Failed to create lead record." };
    }

    // 4. Send email via Brevo (if configured)
    if (BREVO_API_KEY) {
      const baseUrl = siteConfig.baseUrl;
      const checkoutUrl = `${baseUrl}/checkout?lead_id=${lead.id}`;

      // Build email content (no hardcoded brand names)
      const emailHtml = buildQuoteEmailHtml({
        customerName: customer_name,
        installerBusinessName: installer_business_name,
        quoteData: quote_data,
        grandTotal: grand_total,
        depositAmount: depositAmount,
        checkoutUrl,
      });

      try {
        await sendBrevoEmail({
          to: customer_email,
          toName: customer_name,
          subject: `Your Quote from ${installer_business_name}`,
          htmlContent: emailHtml,
        });
      } catch (emailError) {
        console.error("Email send error:", emailError);
        // Don't fail the whole operation if email fails
      }
    }

    return {
      success: true,
      lead_id: lead.id,
      customer_id: customerId,
    };
  } catch (err) {
    console.error("Create quote error:", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Email Helpers
// ═══════════════════════════════════════════════════════════════════════════

interface QuoteEmailData {
  customerName: string;
  installerBusinessName: string;
  quoteData: QuoteUnit[];
  grandTotal: number;
  depositAmount: number;
  checkoutUrl: string;
}

function buildQuoteEmailHtml(data: QuoteEmailData): string {
  const {
    customerName,
    installerBusinessName,
    quoteData,
    grandTotal,
    depositAmount,
    checkoutUrl,
  } = data;

  const unitsList = quoteData
    .map(
      (unit, i) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">Unit ${i + 1}: ${unit.desc}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${unit.price.toLocaleString()}</td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <!-- Header -->
      <div style="background-color: #1e293b; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #facc15; font-size: 24px; font-weight: bold;">Your Quote</h1>
        <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">from ${installerBusinessName}</p>
      </div>

      <!-- Content -->
      <div style="padding: 32px;">
        <p style="margin: 0 0 24px 0; color: #334155; font-size: 16px;">Hi ${customerName},</p>

        <p style="margin: 0 0 24px 0; color: #334155; font-size: 16px;">
          Thank you for your interest! Here is your custom quote for your storage solution:
        </p>

        <!-- Quote Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Item</th>
              <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${unitsList}
          </tbody>
        </table>

        <!-- Total -->
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b; font-size: 14px;">Total</span>
            <span style="color: #1e293b; font-size: 20px; font-weight: bold;">$${grandTotal.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b; font-size: 14px;">Deposit Due (15%)</span>
            <span style="color: #facc15; font-size: 16px; font-weight: bold;">$${depositAmount.toLocaleString()}</span>
          </div>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${checkoutUrl}" style="display: inline-block; background-color: #facc15; color: #1e293b; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; text-transform: uppercase;">
            Confirm & Pay Deposit
          </a>
        </div>

        <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
          Questions? Reply to this email to contact ${installerBusinessName}.
        </p>
      </div>
    </div>

    <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 11px; text-align: center;">
      This quote was generated by ${installerBusinessName}.
    </p>
  </div>
</body>
</html>
  `.trim();
}

interface BrevoEmailParams {
  to: string;
  toName: string;
  subject: string;
  htmlContent: string;
}

async function sendBrevoEmail(params: BrevoEmailParams): Promise<void> {
  if (!BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY not configured");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        name: siteConfig.name,
        email: siteConfig.supportEmail,
      },
      to: [
        {
          email: params.to,
          name: params.toName,
        },
      ],
      subject: params.subject,
      htmlContent: params.htmlContent,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo API error: ${error}`);
  }
}
