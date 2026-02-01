// ═══════════════════════════════════════════════════════════════════════════
// Black Box Email Engine — Resend Integration
// Server-side only. API key never exposed to client.
// This module is only imported by server actions, keeping secrets safe.
// ═══════════════════════════════════════════════════════════════════════════

import { Resend } from "resend";
import { getAppUrl } from "@/lib/url-helper";

// Lazy singleton — only instantiated when actually sending
let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

// ── Types ────────────────────────────────────────────────────────────────

export interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  senderName?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ── Core Sender ──────────────────────────────────────────────────────────

const SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || "orders@storage-network.app";
const SENDER_NAME = process.env.RESEND_SENDER_NAME || "Storage Network";

export async function sendTransactionalEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const { to, subject, html, senderName } = params;

  console.log("[Email] Attempting to send email to:", to, "| Subject:", subject);

  // Development safety trap — log instead of sending
  if (process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY) {
    console.log("[Email DEV] Would send:", { to, subject });
    return { success: true, messageId: "dev-" + Date.now() };
  }

  const resend = getResend();
  if (!resend) {
    console.error("[Email] RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `${senderName || SENDER_NAME} <${SENDER_EMAIL}>`,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[Email] Send error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Master Email Template — Brand-consistent shell with logo
// ═══════════════════════════════════════════════════════════════════════════

function emailShell(title: string, body: string): string {
  const logoUrl = `${getAppUrl()}/logo-storage-network.png`;

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
      <!-- Header with Logo -->
      <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:28px 32px;text-align:center;">
        <img src="${logoUrl}" alt="Storage Network" width="64" height="64" style="border-radius:50%;margin-bottom:12px;" />
        <h1 style="margin:0;color:#facc15;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${title}</h1>
      </div>
      <!-- Body -->
      <div style="padding:32px;">
        ${body}
      </div>
    </div>
    <!-- Footer -->
    <p style="margin:24px 0 0;color:#94a3b8;font-size:11px;text-align:center;">
      Sent by Storage Network &bull; <a href="${getAppUrl()}" style="color:#94a3b8;">storage-network.app</a>
    </p>
  </div>
</body>
</html>`.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Booking Confirmation (Customer)
// Trigger: Customer pays deposit
// ═══════════════════════════════════════════════════════════════════════════

export interface BookingConfirmationData {
  customerName: string;
  customerEmail: string;
  installerName: string;
  installerPhone?: string;
  installerAvatarUrl?: string;
  scheduledDate: string;
  address: string;
  depositAmount: number;
  totalPrice: number;
  jobDescription: string;
  leadId: string;
}

export async function sendBookingConfirmation(
  data: BookingConfirmationData
): Promise<SendEmailResult> {
  console.log("[Email] sendBookingConfirmation triggered for:", data.customerEmail, "| Lead:", data.leadId);
  const {
    customerName,
    customerEmail,
    installerName,
    installerPhone,
    installerAvatarUrl,
    scheduledDate,
    address,
    depositAmount,
    totalPrice,
    jobDescription,
    leadId,
  } = data;

  // Safe date parse — avoid Invalid Date crash if scheduledDate is "TBD" or empty
  let formattedDate = scheduledDate || "TBD";
  if (scheduledDate && scheduledDate !== "TBD") {
    const parsed = new Date(scheduledDate + (scheduledDate.includes("T") ? "" : "T12:00:00"));
    if (!isNaN(parsed.getTime())) {
      formattedDate = parsed.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  }

  const balanceDue = totalPrice - depositAmount;
  const successUrl = `${getAppUrl()}/success?jobId=${leadId}`;

  const avatarHtml = installerAvatarUrl
    ? `<img src="${installerAvatarUrl}" alt="${installerName}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #facc15;" />`
    : `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#facc15,#f59e0b);display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#1e293b;">${installerName.charAt(0).toUpperCase()}</div>`;

  const phoneHtml = installerPhone
    ? `<a href="tel:${installerPhone}" style="display:inline-block;margin-top:8px;background-color:#facc15;color:#1e293b;padding:8px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">Call ${installerPhone}</a>`
    : "";

  const html = emailShell(
    "Your Installation is Confirmed",
    `
    <p style="margin:0 0 16px;color:#334155;font-size:16px;">Hi ${customerName},</p>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
      Your installation is confirmed for <strong style="color:#1e293b;">${formattedDate}</strong>.
    </p>

    <!-- Installer Card -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <div style="margin-bottom:12px;">${avatarHtml}</div>
      <p style="margin:0 0 4px;color:#facc15;font-size:18px;font-weight:800;">${installerName}</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your Installer</p>
      ${phoneHtml}
    </div>

    <!-- Details -->
    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#334155;">
        <tr><td style="padding:8px 0;color:#64748b;">Date</td><td style="padding:8px 0;font-weight:700;text-align:right;">${formattedDate}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Location</td><td style="padding:8px 0;font-weight:600;text-align:right;">${address || "Address provided on arrival"}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Job</td><td style="padding:8px 0;font-weight:600;text-align:right;">${jobDescription}</td></tr>
        <tr style="border-top:1px solid #e2e8f0;"><td style="padding:12px 0 8px;color:#64748b;">Deposit Paid</td><td style="padding:12px 0 8px;font-weight:700;text-align:right;color:#16a34a;">$${depositAmount.toLocaleString()}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Balance Due</td><td style="padding:8px 0;font-weight:800;text-align:right;font-size:18px;color:#1e293b;">$${balanceDue.toLocaleString()}</td></tr>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${successUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View Order
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Your installer will reach out to confirm. Questions? Reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: customerName,
    subject: `Installation Confirmed — ${formattedDate} with ${installerName}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: New Lead Alert (Installer)
// Trigger: New job created in installer's ZIP
// ═══════════════════════════════════════════════════════════════════════════

export async function sendNewLeadAlert(
  installerEmail: string,
  city: string,
  leadDetails: {
    customerName: string;
    unitCount: number;
    totalPrice: number;
    leadId: string;
  }
): Promise<SendEmailResult> {
  console.log("[Email] sendNewLeadAlert triggered for:", installerEmail, "| Lead:", leadDetails.leadId);
  const jobUrl = `${getAppUrl()}/dashboard/leads/${leadDetails.leadId}`;
  const profitEstimate = Math.round(leadDetails.totalPrice * 0.85);

  const html = emailShell(
    "NEW LEAD: Deposit Paid",
    `
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;color:#16a34a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">New Job &mdash; ${city}</p>
      <p style="margin:0;color:#1e293b;font-size:28px;font-weight:800;">$${profitEstimate.toLocaleString()}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:12px;">estimated profit</p>
    </div>
    <table style="width:100%;margin-bottom:24px;font-size:14px;color:#334155;">
      <tr><td style="padding:8px 0;color:#64748b;width:120px;">Customer</td><td style="padding:8px 0;font-weight:600;">${leadDetails.customerName}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Location</td><td style="padding:8px 0;font-weight:600;">${city}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Units</td><td style="padding:8px 0;font-weight:600;">${leadDetails.unitCount} shelving unit${leadDetails.unitCount !== 1 ? "s" : ""}</td></tr>
    </table>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${jobUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Claim Job
      </a>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      This lead has a paid deposit. Open your dashboard to view the full cut list.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    subject: `NEW LEAD: ${leadDetails.customerName} in ${city} — $${profitEstimate.toLocaleString()}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Job Receipt (Customer)
// Trigger: Installer marks job "Complete"
// ═══════════════════════════════════════════════════════════════════════════

export async function sendJobReceipt(
  customerEmail: string,
  data: {
    customerName: string;
    installerName: string;
    totalAmount: number;
    depositPaid: number;
    balanceCollected: number;
    jobDescription: string;
    completedDate: string;
  }
): Promise<SendEmailResult> {
  const formattedDate = new Date(data.completedDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = emailShell(
    "Receipt for Service",
    `
    <p style="margin:0 0 16px;color:#334155;font-size:16px;">Hi ${data.customerName},</p>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
      Your installation is complete. Here is your receipt:
    </p>

    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#334155;">
        <tr><td style="padding:8px 0;color:#64748b;">Service</td><td style="padding:8px 0;font-weight:600;text-align:right;">${data.jobDescription}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Installer</td><td style="padding:8px 0;font-weight:600;text-align:right;">${data.installerName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Completed</td><td style="padding:8px 0;font-weight:600;text-align:right;">${formattedDate}</td></tr>
        <tr style="border-top:2px solid #e2e8f0;">
          <td style="padding:12px 0 8px;color:#64748b;">Total</td>
          <td style="padding:12px 0 8px;font-weight:800;text-align:right;font-size:20px;color:#1e293b;">$${data.totalAmount.toLocaleString()}</td>
        </tr>
        <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Deposit</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#64748b;">-$${data.depositPaid.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Balance Collected</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#64748b;">$${data.balanceCollected.toLocaleString()}</td></tr>
      </table>
    </div>

    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;color:#16a34a;font-size:14px;font-weight:700;">
        &#10003; Installation Complete &mdash; 30-Day Warranty Active
      </p>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Thank you for choosing Storage Network! Questions? Reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: data.customerName,
    subject: `Receipt — Installation by ${data.installerName} on ${formattedDate}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Installer Welcome
// Trigger: Stripe onboarding complete
// ═══════════════════════════════════════════════════════════════════════════

export async function sendInstallerWelcome(
  name: string,
  email: string
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
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
    subject: "Welcome to the Storage Network Partner Program — You're Live!",
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Legacy Compat: Quote Email (used by existing quote flows)
// ═══════════════════════════════════════════════════════════════════════════

export interface QuoteEmailData {
  customerName: string;
  businessName: string;
  quoteItems: Array<{ description: string; price: number }>;
  totalPrice: number;
  depositAmount: number;
  checkoutUrl: string;
}

export function buildQuoteEmailTemplate(data: QuoteEmailData): string {
  const { customerName, businessName, quoteItems, totalPrice, depositAmount, checkoutUrl } = data;

  const itemsHtml = quoteItems
    .map(
      (item, i) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#334155;">${i + 1}. ${item.description}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#1e293b;">$${item.price.toLocaleString()}</td>
      </tr>`
    )
    .join("");

  return emailShell(
    `Your Quote from ${businessName}`,
    `
    <p style="margin:0 0 24px;color:#334155;font-size:16px;">Hi ${customerName},</p>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Thank you for your interest! Here is your custom quote:</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead><tr style="background-color:#f1f5f9;">
        <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Item</th>
        <th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Price</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div style="background-color:#f8fafc;border-radius:12px;padding:20px;margin-bottom:28px;border:1px solid #e2e8f0;">
      <table style="width:100%;">
        <tr><td style="color:#64748b;font-size:14px;">Total Estimate</td><td style="text-align:right;color:#1e293b;font-size:24px;font-weight:800;">$${totalPrice.toLocaleString()}</td></tr>
        <tr><td style="color:#64748b;font-size:14px;padding-top:12px;border-top:1px dashed #cbd5e1;">Deposit Due (15%)</td><td style="text-align:right;color:#facc15;font-size:18px;font-weight:700;padding-top:12px;border-top:1px dashed #cbd5e1;">$${depositAmount.toLocaleString()}</td></tr>
      </table>
    </div>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${checkoutUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Confirm &amp; Pay Deposit
      </a>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">
      Questions? Simply reply to this email to contact ${businessName}.
    </p>
    `
  );
}
