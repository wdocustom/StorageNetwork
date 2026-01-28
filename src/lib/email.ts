"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Black Box Email Engine — Brevo (Sendinblue) Integration
// Server-side only. API key never exposed to client.
// ═══════════════════════════════════════════════════════════════════════════

import { siteConfig } from "@/config/site";

// Environment Variables (set in Vercel):
// BREVO_API_KEY - The xkeysib-... secret key
// BREVO_SENDER_EMAIL - Verified sender address
// BREVO_SENDER_NAME - Default platform name

export interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  senderName?: string; // Optional: Override sender name (e.g., Installer's business)
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a transactional email via Brevo API.
 * This is a server-only function — API key never reaches the client.
 */
export async function sendTransactionalEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const { to, toName, subject, html, senderName } = params;

  // Check for API key
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("[Email] BREVO_API_KEY not configured");
    return {
      success: false,
      error: "Email service not configured",
    };
  }

  // Determine sender info
  const senderEmail = process.env.BREVO_SENDER_EMAIL || siteConfig.supportEmail;
  const finalSenderName =
    senderName || process.env.BREVO_SENDER_NAME || siteConfig.name;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: finalSenderName,
          email: senderEmail,
        },
        to: [
          {
            email: to,
            name: toName || to,
          },
        ],
        subject,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Email] Brevo API error:", response.status, errorText);
      return {
        success: false,
        error: `Email delivery failed: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (err) {
    console.error("[Email] Send error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Email Templates — White Label Ready (no hardcoded brand names)
// ═══════════════════════════════════════════════════════════════════════════

export interface QuoteEmailData {
  customerName: string;
  businessName: string;
  quoteItems: Array<{ description: string; price: number }>;
  totalPrice: number;
  depositAmount: number;
  checkoutUrl: string;
}

/**
 * Generate quote email HTML — White Label ready.
 * Uses businessName for personalization, no hardcoded brand names.
 */
export function buildQuoteEmailTemplate(data: QuoteEmailData): string {
  const {
    customerName,
    businessName,
    quoteItems,
    totalPrice,
    depositAmount,
    checkoutUrl,
  } = data;

  const itemsHtml = quoteItems
    .map(
      (item, i) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #334155;">
          ${i + 1}. ${item.description}
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #1e293b;">
          $${item.price.toLocaleString()}
        </td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Quote from ${businessName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; line-height: 1.5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Main Card -->
    <div style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">

      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px; text-align: center;">
        <h1 style="margin: 0; color: #facc15; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
          Your Quote
        </h1>
        <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">
          from ${businessName}
        </p>
      </div>

      <!-- Content -->
      <div style="padding: 32px;">

        <!-- Greeting -->
        <p style="margin: 0 0 24px 0; color: #334155; font-size: 16px;">
          Hi ${customerName},
        </p>

        <p style="margin: 0 0 24px 0; color: #64748b; font-size: 15px;">
          Thank you for your interest! Here is your custom quote:
        </p>

        <!-- Quote Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                Item
              </th>
              <th style="padding: 12px 16px; text-align: right; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                Price
              </th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Totals Box -->
        <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 28px; border: 1px solid #e2e8f0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="color: #64748b; font-size: 14px;">Total Estimate</span>
            <span style="color: #1e293b; font-size: 24px; font-weight: 800;">$${totalPrice.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
            <span style="color: #64748b; font-size: 14px;">Deposit Due (15%)</span>
            <span style="color: #facc15; font-size: 18px; font-weight: 700;">$${depositAmount.toLocaleString()}</span>
          </div>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 28px;">
          <a href="${checkoutUrl}" style="display: inline-block; background-color: #facc15; color: #1e293b; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 6px -1px rgba(250, 204, 21, 0.3);">
            Confirm & Pay Deposit
          </a>
        </div>

        <!-- Footer Note -->
        <p style="margin: 0; color: #94a3b8; font-size: 13px; text-align: center;">
          Questions? Simply reply to this email to contact ${businessName}.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 11px; text-align: center;">
      This quote was generated by ${businessName}
    </p>
  </div>
</body>
</html>
  `.trim();
}
