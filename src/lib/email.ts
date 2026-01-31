// ═══════════════════════════════════════════════════════════════════════════
// Black Box Email Engine — Brevo (Sendinblue) Integration
// Server-side only. API key never exposed to client.
// This module is only imported by server actions, keeping secrets safe.
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

// ═══════════════════════════════════════════════════════════════════════════
// Transactional Email Templates — Pilot Program
// ═══════════════════════════════════════════════════════════════════════════

/** Shared email wrapper — dark header with gold accent, white body */
function emailShell(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f8fafc;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background-color:#ffffff;border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:28px 32px;text-align:center;">
        <h1 style="margin:0;color:#facc15;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${title}</h1>
      </div>
      <div style="padding:32px;">
        ${body}
      </div>
    </div>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:11px;text-align:center;">
      ${siteConfig.name} &mdash; ${siteConfig.tagline}
    </p>
  </div>
</body>
</html>`.trim();
}

/**
 * Welcome email sent to new installer after Stripe onboarding completes.
 */
export async function sendInstallerWelcome(
  name: string,
  email: string
): Promise<SendEmailResult> {
  const dashboardUrl = `${siteConfig.baseUrl}/dashboard`;
  const html = emailShell(
    "Welcome to the Partner Network",
    `
    <p style="margin:0 0 16px;color:#334155;font-size:16px;">Hi ${name},</p>
    <p style="margin:0 0 16px;color:#64748b;font-size:15px;">
      Your installer account is now <strong style="color:#16a34a;">active</strong>.
      Your bank is connected and you&rsquo;re ready to receive automated leads and payouts.
    </p>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
      Here&rsquo;s what happens next:
    </p>
    <ul style="margin:0 0 28px;padding-left:20px;color:#64748b;font-size:14px;">
      <li style="margin-bottom:8px;">Leads with <strong>paid deposits</strong> land in your dashboard automatically.</li>
      <li style="margin-bottom:8px;">Each job includes a <strong>cut list</strong>, material list, and assembly guide.</li>
      <li style="margin-bottom:8px;">Collect the balance on-site with one tap &mdash; funds go straight to your bank.</li>
    </ul>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Open Dashboard
      </a>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">
      Questions? Reply to this email anytime.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: name,
    subject: "Welcome to the Partner Network — You're Live!",
    html,
  });
}

/**
 * Alert email sent to installer when a new lead with a paid deposit comes in.
 */
export async function sendNewJobAlert(
  installerEmail: string,
  city: string,
  leadDetails: { customerName: string; unitCount: number; totalPrice: number; leadId: string }
): Promise<SendEmailResult> {
  const jobUrl = `${siteConfig.baseUrl}/dashboard/leads/${leadDetails.leadId}`;
  const html = emailShell(
    "NEW LEAD: Deposit Paid",
    `
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;color:#16a34a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">New Job Received</p>
      <p style="margin:0;color:#1e293b;font-size:28px;font-weight:800;">$${leadDetails.totalPrice.toLocaleString()}</p>
    </div>
    <table style="width:100%;margin-bottom:24px;font-size:14px;color:#334155;">
      <tr>
        <td style="padding:8px 0;color:#64748b;width:120px;">Customer</td>
        <td style="padding:8px 0;font-weight:600;">${leadDetails.customerName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#64748b;">Location</td>
        <td style="padding:8px 0;font-weight:600;">${city}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#64748b;">Units</td>
        <td style="padding:8px 0;font-weight:600;">${leadDetails.unitCount} shelving unit${leadDetails.unitCount !== 1 ? "s" : ""}</td>
      </tr>
    </table>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${jobUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View Cut List &amp; Details
      </a>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      This lead has a paid deposit. Contact the customer to schedule installation.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    subject: `NEW LEAD: ${leadDetails.customerName} in ${city} — Deposit Paid`,
    html,
  });
}

/**
 * Receipt email sent to the customer after their deposit payment succeeds.
 */
export async function sendCustomerReceipt(
  customerEmail: string,
  amount: number,
  installerName: string
): Promise<SendEmailResult> {
  const html = emailShell(
    "Order Confirmed",
    `
    <p style="margin:0 0 16px;color:#334155;font-size:16px;">Thank you for your order!</p>
    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#334155;">
        <tr>
          <td style="padding:8px 0;color:#64748b;">Amount Paid</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;font-size:20px;color:#1e293b;">$${amount.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;">Your Installer</td>
          <td style="padding:8px 0;font-weight:600;text-align:right;">${installerName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;">Status</td>
          <td style="padding:8px 0;text-align:right;"><span style="background-color:#dcfce7;color:#16a34a;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">CONFIRMED</span></td>
        </tr>
      </table>
    </div>
    <p style="margin:0 0 16px;color:#64748b;font-size:15px;">
      Your installer has been notified and will reach out to schedule your installation.
    </p>
    <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">
      Questions? Reply to this email anytime.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    subject: "Order Confirmed — Your installer has been notified",
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Baseball Card Receipt — Rich receipt with installer profile card
// ═══════════════════════════════════════════════════════════════════════════

export interface BaseballCardData {
  customerName: string;
  customerEmail: string;
  depositAmount: number;
  totalPrice: number;
  scheduledDate: string;
  address: string;
  installerName: string;
  installerPhone?: string;
  installerAvatarUrl?: string;
  jobDescription: string;
}

/**
 * Baseball Card receipt — includes installer avatar, phone, and scheduled date.
 * Sent to customer after successful deposit payment + booking.
 */
export async function sendBaseballCardReceipt(
  data: BaseballCardData
): Promise<SendEmailResult> {
  const {
    customerName,
    customerEmail,
    depositAmount,
    totalPrice,
    scheduledDate,
    address,
    installerName,
    installerPhone,
    installerAvatarUrl,
    jobDescription,
  } = data;

  const formattedDate = new Date(scheduledDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const balanceDue = totalPrice - depositAmount;

  const avatarHtml = installerAvatarUrl
    ? `<img src="${installerAvatarUrl}" alt="${installerName}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #facc15;" />`
    : `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#facc15,#f59e0b);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#1e293b;">${installerName.charAt(0).toUpperCase()}</div>`;

  const phoneHtml = installerPhone
    ? `<a href="tel:${installerPhone}" style="display:inline-block;margin-top:8px;background-color:#facc15;color:#1e293b;padding:8px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">Call ${installerPhone}</a>`
    : "";

  const html = emailShell(
    "Booking Confirmed",
    `
    <p style="margin:0 0 16px;color:#334155;font-size:16px;">Hi ${customerName},</p>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
      Your installation is booked! Here are the details:
    </p>

    <!-- Installer Baseball Card -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <div style="margin-bottom:12px;">
        ${avatarHtml}
      </div>
      <p style="margin:0 0 4px;color:#facc15;font-size:18px;font-weight:800;">${installerName}</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your Installer</p>
      ${phoneHtml}
    </div>

    <!-- Booking Details -->
    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#334155;">
        <tr>
          <td style="padding:8px 0;color:#64748b;">Date</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;">Location</td>
          <td style="padding:8px 0;font-weight:600;text-align:right;max-width:200px;">${address}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;">Job</td>
          <td style="padding:8px 0;font-weight:600;text-align:right;">${jobDescription}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:12px 0 8px;color:#64748b;">Deposit Paid</td>
          <td style="padding:12px 0 8px;font-weight:700;text-align:right;color:#16a34a;">$${depositAmount.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;">Balance Due at Install</td>
          <td style="padding:8px 0;font-weight:800;text-align:right;font-size:18px;color:#1e293b;">$${balanceDue.toLocaleString()}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 16px;color:#64748b;font-size:14px;">
      Your installer will reach out to confirm the details. If you need to reschedule,
      ${installerPhone ? `call or text <strong>${installerPhone}</strong>` : "reply to this email"}.
    </p>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Thank you for choosing ${installerName}!
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: customerName,
    subject: `Booking Confirmed — ${formattedDate} with ${installerName}`,
    html,
  });
}
