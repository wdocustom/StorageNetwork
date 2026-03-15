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
  replyTo?: string;
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
  const { to, subject, html, senderName, replyTo } = params;

  console.log("[Email] Attempting to send email to:", to, "| Subject:", subject);

  // Development safety trap — log instead of sending
  if (process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY) {
    console.log("[Email DEV] Would send:", { to, subject, replyTo });
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
      ...(replyTo && { reply_to: replyTo }),
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

export function emailShell(title: string, body: string): string {
  const logoUrl = `${getAppUrl()}/landing_page_logo.png`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#0f172a;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background-color:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
      <!-- Header with Logo -->
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%);padding:36px 32px;text-align:center;border-bottom:1px solid #334155;">
        <img src="${logoUrl}" alt="Storage Network" style="max-width:120px;max-height:120px;width:auto;height:auto;margin-bottom:16px;" />
        <h1 style="margin:0;color:#facc15;font-size:24px;font-weight:800;letter-spacing:-0.3px;">${title}</h1>
        <div style="margin:12px auto 0;width:60px;height:2px;background:linear-gradient(to right,#facc15,#f59e0b);border-radius:1px;"></div>
      </div>
      <!-- Body -->
      <div style="padding:32px;">
        ${body}
      </div>
      <!-- Footer bar -->
      <div style="border-top:1px solid #334155;padding:20px 32px;text-align:center;">
        <p style="margin:0;color:#475569;font-size:11px;">
          Sent by <a href="${getAppUrl()}" style="color:#94a3b8;text-decoration:none;font-weight:600;">Storage Network</a> &bull; storage-network.app
        </p>
      </div>
    </div>
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
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${customerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      Thanks for your order! We&rsquo;ve received your deposit of <strong style="color:#16a34a;">$${depositAmount.toLocaleString()}</strong>.
      Your installer will be in touch shortly to confirm your date: <strong style="color:#facc15;">${formattedDate}</strong>.
    </p>

    <!-- Installer Card -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <div style="margin-bottom:12px;">${avatarHtml}</div>
      <p style="margin:0 0 4px;color:#facc15;font-size:18px;font-weight:800;">${installerName}</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your Installer</p>
      ${phoneHtml}
    </div>

    <!-- Details -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;">Date</td><td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${formattedDate}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Location</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${address || "Address provided on arrival"}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Job</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${jobDescription}</td></tr>
        <tr style="border-top:1px solid #334155;"><td style="padding:12px 0 8px;color:#94a3b8;">Deposit Paid</td><td style="padding:12px 0 8px;font-weight:700;text-align:right;color:#16a34a;">$${depositAmount.toLocaleString()}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Balance Due at Install</td><td style="padding:8px 0;font-weight:800;text-align:right;font-size:18px;color:#facc15;">$${balanceDue.toLocaleString()}*</td></tr>
      </table>
      <p style="margin:12px 0 0;color:#94a3b8;font-size:11px;text-align:center;font-style:italic;">
        *Plus applicable sales tax, collected by your installer at installation.
      </p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${successUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View Order
      </a>
    </div>

    <!-- Cancellation Policy -->
    <div style="background-color:#422006;border:1px solid #92400e;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#92400e;font-size:12px;line-height:1.6;">
        <strong>Need to reschedule?</strong> Please contact your installer at least 48 hours before your appointment to avoid fees.
      </p>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Your installer will reach out to confirm. Questions? Reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: customerName,
    subject: `Order Confirmed: Tote Storage Installation — ${formattedDate}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: New Booking Alert (Installer)
// Trigger: New job booked with paid deposit
// ═══════════════════════════════════════════════════════════════════════════

export async function sendNewBookingAlert(
  installerEmail: string,
  city: string,
  leadDetails: {
    customerName: string;
    customerEmail?: string;
    address?: string;
    unitCount: number;
    totalPrice: number;
    leadId: string;
  }
): Promise<SendEmailResult> {
  console.log("[Email] sendNewBookingAlert triggered for:", installerEmail, "| Lead:", leadDetails.leadId);
  const jobUrl = `${getAppUrl()}/dashboard/leads/${leadDetails.leadId}`;
  const profitEstimate = Math.round(leadDetails.totalPrice * 0.85);

  const html = emailShell(
    "New Booking Alert!",
    `
    <!-- Action Required Banner -->
    <div style="background-color:#450a0a;border:1px solid #991b1b;border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;color:#dc2626;font-size:14px;font-weight:700;">
        Action Required: Contact customer within 24 hours
      </p>
    </div>

    <div style="background-color:#052e16;border:1px solid #166534;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;color:#16a34a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">New Job &mdash; ${city}</p>
      <p style="margin:0;color:#e2e8f0;font-size:28px;font-weight:800;">$${profitEstimate.toLocaleString()}</p>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">estimated profit</p>
    </div>
    <table style="width:100%;margin-bottom:24px;font-size:14px;color:#cbd5e1;">
      <tr><td style="padding:8px 0;color:#94a3b8;width:120px;">Customer</td><td style="padding:8px 0;font-weight:600;color:#cbd5e1;">${leadDetails.customerName}</td></tr>
      ${leadDetails.customerEmail ? `<tr><td style="padding:8px 0;color:#94a3b8;">Email</td><td style="padding:8px 0;font-weight:600;color:#cbd5e1;">${leadDetails.customerEmail}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#94a3b8;">Address</td><td style="padding:8px 0;font-weight:600;color:#cbd5e1;">${leadDetails.address || city}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;">Units</td><td style="padding:8px 0;font-weight:600;color:#cbd5e1;">${leadDetails.unitCount} shelving unit${leadDetails.unitCount !== 1 ? "s" : ""}</td></tr>
    </table>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${jobUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View Job Details
      </a>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      This lead has a paid deposit. Open your dashboard to view the full cut list.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    subject: `NEW BOOKING: ${leadDetails.customerName} in ${city} — $${profitEstimate.toLocaleString()}`,
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
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${data.customerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      Your installation is complete. Here is your receipt:
    </p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;">Service</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${data.jobDescription}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Installer</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${data.installerName}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Completed</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${formattedDate}</td></tr>
        <tr style="border-top:2px solid #334155;">
          <td style="padding:12px 0 8px;color:#94a3b8;">Total</td>
          <td style="padding:12px 0 8px;font-weight:800;text-align:right;font-size:20px;color:#facc15;">$${data.totalAmount.toLocaleString()}</td>
        </tr>
        <tr><td style="padding:4px 0;color:#94a3b8;font-size:13px;">Deposit</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#94a3b8;">-$${data.depositPaid.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;color:#94a3b8;font-size:13px;">Balance Collected</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#94a3b8;">$${data.balanceCollected.toLocaleString()}</td></tr>
      </table>
    </div>

    <div style="background-color:#052e16;border:1px solid #166534;border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
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
// Template: Payment Received Alert (Installer)
// Trigger: Customer pays final balance via Stripe
// ═══════════════════════════════════════════════════════════════════════════

export async function sendPaymentReceivedAlert(
  installerEmail: string,
  data: {
    installerName: string;
    customerName: string;
    amountReceived: number;
    jobTotal: number;
    leadId: string;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard/leads/${data.leadId}`;

  const html = emailShell(
    "Payment Received",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.installerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      Great news! <strong>${data.customerName}</strong> just paid the remaining balance for their installation.
    </p>

    <div style="background-color:#052e16;border:1px solid #166534;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;color:#16a34a;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Payment Received</p>
      <p style="margin:0;color:#16a34a;font-size:36px;font-weight:900;">$${data.amountReceived.toLocaleString()}</p>
    </div>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Customer</td><td style="padding:6px 0;font-weight:600;text-align:right;color:#cbd5e1;">${data.customerName}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Job Total</td><td style="padding:6px 0;font-weight:600;text-align:right;">$${data.jobTotal.toLocaleString()}</td></tr>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
        View Job Ticket
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Funds will transfer to your connected bank account per your Stripe payout schedule.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    toName: data.installerName,
    subject: `Payment Received — $${data.amountReceived.toLocaleString()} from ${data.customerName}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Installer Onboarding Drip Sequence — 4 Emails
//
// Email 1 (Day 0): "Get Paid" Hook — connect Stripe, activate profile
// Email 2 (Day 2): "Marketing Asset" — download QR code, share link
// Email 3 (Day 4): "First Sale Playbook" — copy-paste marketing template
// Email 4 (Day 7): "Scarcity Reminder" — 3-job trial countdown
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Email 1 — Day 0 (Instant)
 * Subject: Welcome to the Network. Let's get your first job booked.
 * Angle: Don't talk about features. Talk about money.
 */
export async function sendInstallerOnboardingEmail(
  email: string,
  data: {
    name: string;
    isPro?: boolean;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const profileUrl = `${getAppUrl()}/dashboard/profile`;

  const html = emailShell(
    "Let&rsquo;s Get Your First Job Booked",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Welcome to Storage Network, ${data.name}.</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      You now have a custom 3D configurator that makes you look like a top-tier professional.
      Your first 3 jobs are completely free to process.
    </p>

    <!-- Money Hook -->
    <div style="background-color:#052e16;border:1px solid #166534;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#16a34a;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">To Get Paid</p>
      <p style="margin:0;color:#e2e8f0;font-size:15px;line-height:1.7;">
        To actually receive the <strong style="color:#facc15;">15% upfront deposits</strong> from your customers,
        you must connect your bank account. Once connected, you can start sending quotes.
      </p>
    </div>

    <!-- What You Get -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:18px;">&#10003;</td>
          <td style="padding:8px 0;">3D configurator that closes sales for you</td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:18px;">&#10003;</td>
          <td style="padding:8px 0;">Auto-generated cut lists &amp; material lists</td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:18px;">&#10003;</td>
          <td style="padding:8px 0;">Automated deposit routing straight to your bank</td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#facc15;font-size:18px;font-weight:700;">$0</td>
          <td style="padding:8px 0;"><strong style="color:#facc15;">First 3 jobs — zero platform fees</strong></td>
        </tr>
      </table>
    </div>

    <!-- CTA: Connect Stripe -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${profileUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;">
        Connect Stripe &amp; Activate Profile
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Questions? Just reply to this email &mdash; we&rsquo;re here to help.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Welcome to the Network. Let's get your first job booked.",
    html,
  });
}

/**
 * Email 2 — Day 2
 * Subject: Your custom QR code is ready.
 * Angle: Get the software into the physical world.
 */
export async function sendOnboardingEmail2_QRCode(
  email: string,
  data: { name: string; slug?: string | null }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const portfolioUrl = data.slug
    ? `${getAppUrl()}/p/${data.slug}`
    : `${getAppUrl()}/dashboard/profile`;

  const html = emailShell(
    "Your Custom QR Code is Ready",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.name},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Your public portfolio page is live. Homeowners can now design their own units and book you directly.
    </p>

    ${data.slug ? `
    <!-- Live Link Preview -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Your Public Portfolio</p>
      <p style="margin:0;color:#facc15;font-size:16px;font-weight:700;word-break:break-all;">${portfolioUrl}</p>
    </div>
    ` : ""}

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Go to your dashboard and download your custom QR code.
    </p>

    <!-- Pro Tip -->
    <div style="background-color:#422006;border:1px solid #92400e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#facc15;font-size:14px;font-weight:700;">Pro Tip</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Put this QR code on your <strong>truck</strong>, your <strong>business cards</strong>,
        and the bottom of your <strong>invoices</strong>. Every scan is a potential booking.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;">
        View Your Public Link
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Questions? Just reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Your custom QR code is ready.",
    html,
  });
}

/**
 * Email 3 — Day 4
 * Subject: Copy & paste this to get your first custom storage lead.
 * Angle: Do the marketing work for them.
 */
export async function sendOnboardingEmail3_FirstSale(
  email: string,
  data: { name: string; slug?: string | null }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const portfolioUrl = data.slug
    ? `${getAppUrl()}/p/${data.slug}`
    : "[Your Link — set up in Dashboard]";

  const html = emailShell(
    "Your First Sale Playbook",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.name},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      The fastest way to get your first booking is Facebook Marketplace or Nextdoor.
      Copy this exact text and post it in your local community groups:
    </p>

    <!-- Copy-Paste Template -->
    <div style="background-color:#0f172a;border-left:4px solid #facc15;border-radius:0 12px 12px 0;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Copy &amp; Paste This</p>
      <p style="margin:0;color:#e2e8f0;font-size:15px;line-height:1.8;font-style:italic;">
        &ldquo;Hey neighbors, I&rsquo;m doing custom heavy-duty garage storage builds this month.
        They hold 1,000+ lbs and are built to fit your exact space.
        You can design your own unit and get instant pricing here: ${data.slug ? portfolioUrl : "[Your Link]"}&rdquo;
      </p>
    </div>

    <!-- Where to Post -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 16px;color:#facc15;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Where to Post</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Facebook Marketplace &mdash; &ldquo;Home Services&rdquo;</td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Nextdoor &mdash; your neighborhood group</td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Local Facebook groups (HOA, buy/sell, neighborhood)</td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Craigslist &mdash; &ldquo;Services Offered&rdquo;</td>
        </tr>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;">
        Go to Dashboard to Copy Link
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Questions? Just reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Copy & paste this to get your first custom storage lead.",
    html,
  });
}

/**
 * Email 4 — Day 7
 * Subject: Don't let your free jobs go to waste.
 * Angle: Remind them of the 3-Job Trial scarcity.
 */
export async function sendOnboardingEmail4_Scarcity(
  email: string,
  data: { name: string; jobsCompleted?: number }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const jobsLeft = Math.max(0, 3 - (data.jobsCompleted || 0));

  const html = emailShell(
    "Don&rsquo;t Let Your Free Jobs Go to Waste",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.name},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Just a reminder: your first 3 jobs on Storage Network are on us. You get the 3D tool,
      the automated cut lists, and the deposit routing with zero monthly fees.
    </p>

    <!-- Trial Status -->
    <div style="background:linear-gradient(135deg,#422006,#451a03);border:1px solid #92400e;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Trial Status</p>
      <p style="margin:0;color:#e2e8f0;font-size:36px;font-weight:900;">${jobsLeft}</p>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">free ${jobsLeft === 1 ? "job" : "jobs"} remaining</p>
    </div>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Have a quote you&rsquo;ve been working on? Build it in the dashboard and text the link
      to your customer today to lock it in.
    </p>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;">
        Open Dashboard
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Questions? Just reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Don't let your free jobs go to waste.",
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
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${name},</p>
    <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;">
      Your installer account is now <strong style="color:#16a34a;">active</strong>.
      Your bank is connected and you&rsquo;re ready to receive automated leads and payouts.
    </p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      Here&rsquo;s what happens next:
    </p>
    <ul style="margin:0 0 28px;padding-left:20px;color:#94a3b8;font-size:14px;">
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
// Template: Pro Subscription Confirmation
// Trigger: Installer subscribes to Pro plan
// ═══════════════════════════════════════════════════════════════════════════

export async function sendProWelcomeEmail(
  email: string,
  data: {
    name: string;
    slug: string;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const partnerLinkUrl = `${getAppUrl()}/p/${data.slug}`;

  const html = emailShell(
    "Welcome to Pro!",
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#facc15,#f59e0b);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#9733;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.name},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      You&rsquo;re now a <strong style="color:#facc15;">Pro Partner</strong>! Here&rsquo;s what you&rsquo;ve unlocked:
    </p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr>
          <td style="padding:10px 0;vertical-align:top;width:24px;color:#16a34a;font-size:18px;">&#10003;</td>
          <td style="padding:10px 0;"><strong>Low Fees</strong> — Only 3% maintenance fee on your direct leads</td>
        </tr>
        <tr>
          <td style="padding:10px 0;vertical-align:top;color:#16a34a;font-size:18px;">&#10003;</td>
          <td style="padding:10px 0;"><strong>Your Partner Link</strong> — Share your custom URL with customers</td>
        </tr>
        <tr>
          <td style="padding:10px 0;vertical-align:top;color:#16a34a;font-size:18px;">&#10003;</td>
          <td style="padding:10px 0;"><strong>White-Label Experience</strong> — Your branding, your customers</td>
        </tr>
      </table>
    </div>

    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Your Partner Link</p>
      <p style="margin:0;color:#facc15;font-size:16px;font-weight:700;word-break:break-all;">${partnerLinkUrl}</p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}/marketing" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
        View Marketing Tools
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Share your link with customers to start earning more on every job.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Welcome to Pro — Your Partner Link is Live!",
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Out-of-Area Waitlist Alert (Installer)
// Trigger: Customer outside service area requests to be waitlisted
// ═══════════════════════════════════════════════════════════════════════════

export async function sendWaitlistAlert(
  installerEmail: string,
  data: {
    installerName: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    customerZip: string;
    radiusMiles?: number;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard/settings`;

  const phoneLine = data.customerPhone
    ? `<tr><td style="padding:8px 0;color:#94a3b8;">Phone</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${data.customerPhone}</td></tr>`
    : "";

  const radiusLine = data.radiusMiles
    ? `outside your current <strong>${data.radiusMiles}-mile</strong> service radius`
    : `outside your current service area`;

  const html = emailShell(
    "Waitlist Request",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.installerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      A customer wants a tote rack build, but their ZIP code (<strong style="color:#facc15;">${data.customerZip}</strong>) is ${radiusLine}.
      They&rsquo;ve asked to be added to your waitlist in case you expand coverage.
    </p>

    <div style="background-color:#422006;border:1px solid #92400e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#92400e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Customer Details</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;width:100px;">Name</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${data.customerName}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Email</td><td style="padding:8px 0;font-weight:600;text-align:right;"><a href="mailto:${data.customerEmail}" style="color:#2563eb;text-decoration:none;">${data.customerEmail}</a></td></tr>
        ${phoneLine}
        <tr><td style="padding:8px 0;color:#94a3b8;">ZIP Code</td><td style="padding:8px 0;font-weight:800;text-align:right;color:#dc2626;">${data.customerZip}</td></tr>
      </table>
    </div>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.7;">
      If you&rsquo;d like to take this job, you can reach out to the customer directly
      or expand your service radius in your dashboard settings.
    </p>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="mailto:${data.customerEmail}?subject=Storage%20Network%20%E2%80%94%20Service%20Area%20Update" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin-right:8px;">
        Email Customer
      </a>
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#1e293b;color:#facc15;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;border:2px solid #facc15;">
        Update Service Area
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      This customer was not charged. No action is required if you don&rsquo;t service this area.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    toName: data.installerName,
    subject: `Waitlist: ${data.customerName} in ZIP ${data.customerZip} — Outside Service Area`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Waitlist Confirmation (Customer)
// Trigger: Installer sends a quote via /build to a ZIP with no coverage
// ═══════════════════════════════════════════════════════════════════════════

export async function sendWaitlistCustomerConfirmation(
  customerEmail: string,
  data: {
    customerName: string;
    installerBusinessName: string;
    zip: string;
    quoteData?: Array<{ desc?: string; cols?: number; rows?: number; price?: number }>;
  }
): Promise<SendEmailResult> {
  const firstName = (data.customerName || "").split(" ")[0] || "there";
  const hasQuote = data.quoteData && data.quoteData.length > 0;
  const totalPrice = hasQuote
    ? data.quoteData!.reduce((sum, u) => sum + (typeof u.price === "number" ? u.price : 0), 0)
    : 0;

  const buildSummaryHtml = hasQuote
    ? `
      <div style="background-color:#422006;border:1px solid #92400e;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your Saved Build</p>
        <table style="width:100%;border-collapse:collapse;">
          ${data.quoteData!.map((u, i) => `
            <tr>
              <td style="padding:6px 0;color:#cbd5e1;font-size:14px;font-weight:600;">${i + 1}. ${u.desc || `${u.cols}\u00d7${u.rows} Unit`}</td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;font-weight:700;text-align:right;">${u.price ? `$${Number(u.price).toLocaleString()}` : ""}</td>
            </tr>
          `).join("")}
          ${totalPrice > 0 ? `
            <tr style="border-top:1px solid #92400e;">
              <td style="padding:10px 0 0;color:#94a3b8;font-size:13px;">Total Estimate</td>
              <td style="padding:10px 0 0;color:#facc15;font-size:18px;font-weight:800;text-align:right;">$${totalPrice.toLocaleString()}</td>
            </tr>
          ` : ""}
        </table>
      </div>
    `
    : "";

  const html = emailShell(
    "You\u2019re on the Waitlist",
    `
    <!-- Clock Icon -->
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#facc15,#f59e0b);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;">
        &#128337;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.7;">
      <strong style="color:#e2e8f0;">${data.installerBusinessName}</strong> put together a custom storage quote for you, but we don&rsquo;t have a verified installer in your area (ZIP <strong style="color:#facc15;">${data.zip}</strong>) just yet.
    </p>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      <strong style="color:#e2e8f0;">You&rsquo;ve been added to our waitlist.</strong>
      As soon as a professional installer becomes available near you, we&rsquo;ll email you right away so you can pick up exactly where you left off &mdash; ${hasQuote ? "your build is saved and ready to go." : "no extra steps needed."}
    </p>

    ${buildSummaryHtml}

    <!-- What happens next -->
    <div style="background-color:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">What Happens Next</p>
      <table style="width:100%;font-size:14px;color:#94a3b8;">
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#facc15;font-weight:700;width:24px;">1.</td>
          <td style="padding:8px 0;">We&rsquo;re actively recruiting installers in your area</td>
        </tr>
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#facc15;font-weight:700;">2.</td>
          <td style="padding:8px 0;">The moment one is available, you&rsquo;ll get an email</td>
        </tr>
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#facc15;font-weight:700;">3.</td>
          <td style="padding:8px 0;">${hasQuote ? "Click through and your saved build will be ready to confirm" : "Design your system and book an installation"}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;text-align:center;">
      No payment has been charged. You&rsquo;re under no obligation.
    </p>
    <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
      You&rsquo;re receiving this because ${data.installerBusinessName} submitted a quote on your behalf at storage-network.app.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: data.customerName,
    subject: `${firstName}, you're on the waitlist — we'll notify you when an installer is available`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Customer Inquiry to Installer
// Trigger: Customer sends a message via "Email Installer" from /design or /pay
// ═══════════════════════════════════════════════════════════════════════════

export interface CustomerInquiryData {
  installerName: string;
  businessName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  message: string;
  quoteTotal?: number;
  leadId?: string;
  /** Full itemized quote from the configurator */
  quoteData?: unknown[];
}

export function buildCustomerInquiryTemplate(data: CustomerInquiryData): string {
  const { installerName, businessName, customerName, customerEmail, customerPhone, message, quoteTotal, quoteData } = data;

  const phoneLine = customerPhone
    ? `<tr><td style="padding:8px 0;color:#94a3b8;width:100px;">Phone</td><td style="padding:8px 0;font-weight:600;text-align:right;"><a href="tel:${customerPhone}" style="color:#2563eb;text-decoration:none;">${customerPhone}</a></td></tr>`
    : "";

  // Build itemized quote section if quote data is present
  const quoteItems = Array.isArray(quoteData) ? quoteData : [];
  const hasQuoteItems = quoteItems.length > 0;
  const computedTotal = hasQuoteItems
    ? quoteItems.reduce((sum: number, u: unknown) => {
        const item = u as Record<string, unknown>;
        return sum + (typeof item.price === "number" ? item.price : 0);
      }, 0)
    : quoteTotal || 0;

  let quoteSection = "";
  if (hasQuoteItems) {
    const itemRows = quoteItems
      .map((u: unknown, i: number) => {
        const item = u as Record<string, unknown>;
        const desc = item.desc || `${item.cols}\u00d7${item.rows} Unit`;
        const price = typeof item.price === "number" ? `$${item.price.toLocaleString()}` : "";

        // Build addons list
        const addons: string[] = [];
        if (item.hasTotes) {
          const toteType = item.toteType === "GM" ? "GM" : "HDX";
          const toteColor = item.toteColor === "clear" ? " (Clear)" : "";
          addons.push(`${toteType} Totes${toteColor}`);
        } else {
          addons.push("No Totes");
        }
        if (item.hasWheels) addons.push("Wheels");
        if (item.hasTop) addons.push("Plywood Top");
        const addonStr = addons.join(" &bull; ");

        return `
          <tr>
            <td style="padding:10px 0 2px;color:#e2e8f0;font-size:14px;font-weight:600;">Unit ${i + 1}: ${desc}</td>
            <td style="padding:10px 0 2px;color:#facc15;font-size:14px;font-weight:700;text-align:right;">${price}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:0 0 10px;color:#64748b;font-size:12px;border-bottom:1px solid #1e293b;">${addonStr}</td>
          </tr>`;
      })
      .join("");

    quoteSection = `
    <!-- Itemized Quote -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Quote at Time of Inquiry</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;border-collapse:collapse;">
        ${itemRows}
        <tr>
          <td style="padding:12px 0 0;color:#94a3b8;font-size:13px;font-weight:600;">Total Estimate</td>
          <td style="padding:12px 0 0;color:#facc15;font-size:18px;font-weight:800;text-align:right;">$${computedTotal.toLocaleString()}</td>
        </tr>
      </table>
      <p style="margin:12px 0 0;color:#475569;font-size:11px;font-style:italic;">
        Note: This was the customer&rsquo;s quote when they sent the message — they may be asking about something different.
      </p>
    </div>`;
  } else if (quoteTotal) {
    // Fallback: just show the total if no itemized data
    quoteSection = `
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="color:#94a3b8;">Quote Total</td><td style="font-weight:800;text-align:right;color:#facc15;">$${quoteTotal.toFixed(2)}</td></tr>
      </table>
    </div>`;
  }

  const dashboardUrl = getAppUrl() + "/dashboard";

  return emailShell(
    "New Customer Inquiry",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${installerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      A customer has reached out with a question about their storage build.
    </p>

    <!-- Customer Message -->
    <div style="background-color:#0f172a;border-left:4px solid #facc15;border-radius:0 12px 12px 0;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Message from ${customerName}</p>
      <p style="margin:0;color:#e2e8f0;font-size:15px;line-height:1.7;white-space:pre-wrap;">${message}</p>
    </div>

    <!-- Customer Details -->
    <div style="background-color:#1a2332;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Customer Details</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;width:100px;">Name</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${customerName}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Email</td><td style="padding:8px 0;font-weight:600;text-align:right;"><a href="mailto:${customerEmail}" style="color:#2563eb;text-decoration:none;">${customerEmail}</a></td></tr>
        ${phoneLine}
      </table>
    </div>

    ${quoteSection}

    <!-- CTA Buttons -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="mailto:${customerEmail}?subject=Re:%20Your%20Storage%20Build%20Inquiry%20%E2%80%94%20${encodeURIComponent(businessName)}" style="display:inline-block;background-color:#facc15;color:#0f172a;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;margin-right:8px;">
        Reply to ${customerName.split(" ")[0]}
      </a>
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#1e293b;color:#facc15;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;border:2px solid #facc15;">
        View Dashboard
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      You can reply directly to this email — it will go straight to the customer.
    </p>
    `
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Legacy Compat: Quote Email (used by existing quote flows)
// ═══════════════════════════════════════════════════════════════════════════

export interface QuoteEmailData {
  customerName: string;
  businessName: string;
  installerFirstName?: string;
  installerPhone?: string;
  quoteItems: Array<{ description: string; price: number }>;
  totalPrice: number;
  depositAmount: number;
  checkoutUrl: string;
  cleanoutServices?: Array<{ id: string; name: string; description: string; price: number }>;
}

export function buildQuoteEmailTemplate(data: QuoteEmailData): string {
  const { customerName, businessName, installerFirstName, installerPhone, quoteItems, totalPrice, depositAmount, checkoutUrl, cleanoutServices } = data;

  const firstName = customerName.split(" ")[0] || customerName;
  const sigName = installerFirstName || businessName;
  const phoneLine = installerPhone ? `<br/>${installerPhone}` : "";

  const itemsHtml = quoteItems
    .map(
      (item, i) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #334155;color:#e2e8f0;">${i + 1}. ${item.description}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #334155;text-align:right;font-weight:600;color:#e2e8f0;">$${item.price.toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return emailShell(
    `Your Quote from ${businessName}`,
    `
    <p style="margin:0 0 24px;color:#e2e8f0;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">I've put together the quote for your custom storage system.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #334155;border-radius:8px;overflow:hidden;">
      <thead><tr style="background-color:#0f172a;">
        <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Item</th>
        <th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Price</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div style="background-color:#0f172a;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #334155;">
      <table style="width:100%;">
        <tr><td style="color:#94a3b8;font-size:14px;">Total Estimate</td><td style="text-align:right;color:#facc15;font-size:24px;font-weight:800;">$${totalPrice.toFixed(2)}</td></tr>
        <tr><td style="color:#94a3b8;font-size:14px;padding-top:12px;border-top:1px dashed #475569;">Deposit Due (15%)</td><td style="text-align:right;color:#facc15;font-size:18px;font-weight:700;padding-top:12px;border-top:1px dashed #475569;">$${depositAmount.toFixed(2)}</td></tr>
      </table>
    </div>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">To officially get your project on my schedule, please click the secure link below to review your order details and place the initial deposit. Once that is locked in, I will reserve your spot on the calendar, prep your materials, and we will be ready for installation day!</p>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${checkoutUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Review Quote &amp; Secure Installation
      </a>
    </div>
    ${cleanoutServices && cleanoutServices.length > 0 ? `
    <!-- Cleanout Upsell -->
    <div style="background:linear-gradient(135deg,#0f172a,#1a2332);border:1px solid #22c55e40;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#22c55e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">&#10024; Add-On Service</p>
      <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;font-weight:700;">Want us to clean out your space first?</p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;">Get the most out of your new storage — we&rsquo;ll sort, organize, and haul away the clutter before your installation. Available as an add-on at checkout.</p>
      ${cleanoutServices.map((svc) => `
      <div style="background-color:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px;margin-bottom:8px;">
        <table style="width:100%;"><tr>
          <td style="vertical-align:top;">
            <p style="margin:0 0 2px;color:#e2e8f0;font-size:14px;font-weight:600;">${svc.name}</p>
            <p style="margin:0;color:#94a3b8;font-size:12px;">${svc.description}</p>
          </td>
          <td style="text-align:right;vertical-align:middle;white-space:nowrap;padding-left:16px;">
            <span style="color:#facc15;font-size:16px;font-weight:700;">$${svc.price}</span>
          </td>
        </tr></table>
      </div>`).join("")}
      <p style="margin:12px 0 0;color:#64748b;font-size:11px;text-align:center;">You can add cleanout service during checkout. 50% deposit, remainder at service.</p>
    </div>
    ` : ""}
    <p style="margin:0 0 24px;color:#e2e8f0;font-size:15px;">Looking forward to getting your space organized!</p>
    <p style="margin:0 0 24px;color:#e2e8f0;font-size:15px;">
      Best,<br/>${sigName}<br/>${businessName}${phoneLine}
    </p>

    <!-- Contact Installer Block -->
    <div style="background:linear-gradient(135deg,#0f172a,#1a2332);border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#facc15;font-size:13px;font-weight:700;">Have Questions?</p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;">Reach out directly — we&rsquo;re happy to help.</p>
      <div style="display:inline-block;">
        <a href="mailto:?subject=Re:%20My%20Storage%20Quote%20from%20${encodeURIComponent(businessName)}" style="display:inline-block;background-color:#1e293b;color:#e2e8f0;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #475569;margin:0 4px;">
          &#9993; Reply to This Email
        </a>
        ${installerPhone ? `<a href="tel:${installerPhone}" style="display:inline-block;background-color:#1e293b;color:#e2e8f0;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #475569;margin:0 4px;">
          &#9742; Call ${installerPhone}
        </a>` : ""}
      </div>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;font-style:italic;">
      *Sales tax (if applicable) will be collected by your installer at the time of installation.
    </p>
    `
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Abandoned Cart Recovery
// Trigger: Customer abandons checkout (30+ minutes without payment)
// ═══════════════════════════════════════════════════════════════════════════

export async function sendAbandonedCartEmail(
  email: string,
  data: {
    customerName: string;
    totalPrice: number;
    depositAmount: number;
    resumeUrl: string;
    installerName?: string | null;
  }
): Promise<SendEmailResult> {
  const installerLine = data.installerName
    ? `with <strong>${data.installerName}</strong>`
    : "for your custom storage system";

  const html = emailShell(
    "Complete Your Order",
    `
    <!-- Attention Grabber -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#422006;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#128722;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${data.customerName},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Looks like you didn&rsquo;t finish your order ${installerLine}.
      No worries &mdash; your custom configuration is saved and ready to go!
    </p>

    <!-- Order Summary Card -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 16px;color:#facc15;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Your Order Summary</p>
      <table style="width:100%;">
        <tr>
          <td style="color:#94a3b8;font-size:14px;padding:8px 0;">Total Estimate</td>
          <td style="text-align:right;color:#facc15;font-size:20px;font-weight:800;">$${data.totalPrice.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;font-size:14px;padding:8px 0;border-top:1px dashed #475569;">Deposit to Reserve (15%)</td>
          <td style="text-align:right;color:#f59e0b;font-size:18px;font-weight:700;padding-top:8px;border-top:1px dashed #475569;">$${data.depositAmount.toFixed(2)}</td>
        </tr>
      </table>
    </div>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:11px;text-align:center;font-style:italic;">
      *Sales tax (if applicable) will be collected by your installer at the time of installation.
    </p>

    <!-- Urgency Note -->
    <div style="background-color:#422006;border:1px solid #b45309;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
        <strong>&#9888; Heads up:</strong> Your order will expire in 7 days. Complete your purchase to lock in your spot on the schedule.
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${data.resumeUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 48px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(250,204,21,0.3);">
        Complete My Order
      </a>
    </div>

    <!-- Trust Signals -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;font-size:12px;color:#94a3b8;">
        <tr>
          <td style="padding:6px 8px;text-align:center;width:33%;">&#128274; Secure Checkout</td>
          <td style="padding:6px 8px;text-align:center;width:33%;">&#128176; 15% Deposit Only</td>
          <td style="padding:6px 8px;text-align:center;width:33%;">&#9989; Satisfaction Guaranteed</td>
        </tr>
      </table>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Changed your mind? No problem &mdash; just ignore this email. Your order will automatically expire.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.customerName,
    subject: "Don't forget your storage system! Complete your order",
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Referral Handoff Notification
// Trigger: A customer used Installer A's link but was out-of-area, and
// the system handed the lead off to a local installer. Installer A gets
// this email so they know a referral was created.
// ═══════════════════════════════════════════════════════════════════════════

export async function sendReferralHandoffEmail(
  email: string,
  data: {
    referrerName: string;
    customerCity?: string | null;
    customerState?: string | null;
    customerZip?: string | null;
    localInstallerName?: string | null;
    estimatedBounty?: number | null;
  }
): Promise<SendEmailResult> {
  const location = [data.customerCity, data.customerState].filter(Boolean).join(", ")
    || (data.customerZip ? `ZIP ${data.customerZip}` : "another area");

  const bountyDisplay = data.estimatedBounty
    ? `$${data.estimatedBounty.toFixed(2)}`
    : "30% of deposit";

  const html = emailShell(
    "New Network Referral",
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#422006;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#128279;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.referrerName},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Your link just generated a referral! A customer in <strong>${location}</strong> used your configurator link, but the installation address is outside your service area.
    </p>

    ${data.localInstallerName ? `
    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      We've connected them with <strong>${data.localInstallerName}</strong>, a partner installer in their area.
    </p>
    ` : ""}

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Estimated Network Bounty</p>
      <p style="margin:0;color:#f59e0b;font-size:28px;font-weight:900;">${bountyDisplay}</p>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:12px;">You earn 30% of the deposit when the customer books (min $15).</p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${getAppUrl()}/dashboard/referrals" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View My Referrals
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Keep sharing your link &mdash; you earn 30% of the deposit on every out-of-area booking.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.referrerName,
    subject: `Your link generated a referral in ${location}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Bounty Paid Notification
// Trigger: The bounty (30% of deposit, min $15) was transferred to the
// referring installer's Stripe account after the customer's deposit was
// captured.
// ═══════════════════════════════════════════════════════════════════════════

export async function sendBountyPaidEmail(
  email: string,
  data: {
    referrerName: string;
    customerCity?: string | null;
    customerState?: string | null;
    amount: number;
  }
): Promise<SendEmailResult> {
  const location = [data.customerCity, data.customerState].filter(Boolean).join(", ") || "a referred customer";

  const html = emailShell(
    "Bounty Paid!",
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#052e16;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#128176;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.referrerName},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Great news! A customer from <strong>${location}</strong> just booked through your referral. Your network bounty has been deposited.
    </p>

    <div style="background-color:#052e16;border:1px solid #166534;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#16a34a;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Deposited to Your Stripe Account</p>
      <p style="margin:0;color:#15803d;font-size:36px;font-weight:900;">$${data.amount.toFixed(2)}</p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${getAppUrl()}/dashboard/referrals" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View My Referrals
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Keep sharing your link &mdash; you earn 30% of the deposit on every out-of-area booking.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.referrerName,
    subject: `$${data.amount.toFixed(2)} bounty deposited — referral from ${location}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Demo Booking Confirmation
// ═══════════════════════════════════════════════════════════════════════════

export async function sendDemoConfirmationEmail(data: {
  name: string;
  email: string;
  date: string;
  time: string;
  calendarLink: string;
}) {
  const [year, month, day] = data.date.split("-");
  const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Convert 24h to 12h
  const [h, m] = data.time.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const formattedTime = `${hour12}:${m} ${ampm} CT`;

  const body = `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${data.name.split(" ")[0]},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      Your demo call is confirmed! We&rsquo;ll walk you through how the platform works
      and how it puts money in your pocket.
    </p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Date</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Time</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#facc15;">${formattedTime}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Duration</td>
          <td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">~30 minutes</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Format</td>
          <td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">Video / Phone Call</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${data.calendarLink}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Add to Google Calendar
      </a>
    </div>

    <p style="margin:0 0 16px;color:#facc15;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">What We&rsquo;ll Cover</p>
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#e2e8f0;font-size:13px;">&#10003; How pre-sold leads flow directly to you</p>
      <p style="margin:0 0 8px;color:#e2e8f0;font-size:13px;">&#10003; The 3D configurator that closes sales for you</p>
      <p style="margin:0 0 8px;color:#e2e8f0;font-size:13px;">&#10003; Auto-generated cut lists &amp; material planning</p>
      <p style="margin:0 0 8px;color:#e2e8f0;font-size:13px;">&#10003; Payment processing &amp; instant payouts</p>
      <p style="margin:0;color:#e2e8f0;font-size:13px;">&#10003; Marketing tools &amp; community access</p>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:13px;">
      We&rsquo;ll reach out at the scheduled time. If you need to reschedule, just reply to this email.
    </p>
  `;

  const html = emailShell("Demo Call Confirmed", body);

  await sendTransactionalEmail({
    to: data.email,
    toName: data.name,
    subject: `Demo confirmed — ${formattedDate} at ${formattedTime}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Demo Booking — Owner Notification (sent to info@wdocustom.com)
// ═══════════════════════════════════════════════════════════════════════════

export async function sendDemoOwnerNotification(data: {
  prospectName: string;
  prospectEmail: string;
  prospectPhone: string | null;
  date: string;
  time: string;
  calendarLink: string;
  toolExperience?: string | null;
  buildsCurrently?: string | null;
}) {
  const [year, month, day] = data.date.split("-");
  const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const [h, m] = data.time.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const formattedTime = `${hour12}:${m} ${ampm} CT`;

  const body = `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">New demo booking!</p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Name</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${data.prospectName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Email</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">
            <a href="mailto:${data.prospectEmail}" style="color:#facc15;text-decoration:none;">${data.prospectEmail}</a>
          </td>
        </tr>
        ${data.prospectPhone ? `<tr>
          <td style="padding:8px 0;color:#94a3b8;">Phone</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">
            <a href="tel:${data.prospectPhone}" style="color:#facc15;text-decoration:none;">${data.prospectPhone}</a>
          </td>
        </tr>` : ""}
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Date</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Time</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#facc15;">${formattedTime}</td>
        </tr>
        ${data.toolExperience ? `<tr>
          <td style="padding:8px 0;color:#94a3b8;">Tool Experience</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${data.toolExperience}</td>
        </tr>` : ""}
        ${data.buildsCurrently ? `<tr>
          <td style="padding:8px 0;color:#94a3b8;">Builds Currently?</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${data.buildsCurrently}</td>
        </tr>` : ""}
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${data.calendarLink}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Add to Google Calendar
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:13px;">
      The prospect has been sent a confirmation email. Reach out before the call if possible.
    </p>
  `;

  const html = emailShell("New Demo Booking", body);

  await sendTransactionalEmail({
    to: "info@wdocustom.com",
    toName: "Storage Network",
    subject: `New demo booking — ${data.prospectName} on ${formattedDate} at ${formattedTime}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Cleanout Upsell Email (Customer)
// Trigger: 3 days before scheduled install — automated upsell
//
// Presents the installer's cleanout/add-on services as buttons.
// Customer can add a service and pay the 50% deposit immediately.
// ═══════════════════════════════════════════════════════════════════════════

export interface CleanoutUpsellEmailData {
  customerName: string;
  customerEmail: string;
  installerName: string;
  installerPhone?: string;
  installerAvatarUrl?: string;
  scheduledDate: string;
  address?: string;
  leadId: string;
  services: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
  }>;
}

export async function sendCleanoutUpsellEmail(
  data: CleanoutUpsellEmailData
): Promise<SendEmailResult> {
  const {
    customerName,
    customerEmail,
    installerName,
    installerPhone,
    installerAvatarUrl,
    scheduledDate,
    address,
    leadId,
    services,
  } = data;

  const firstName = customerName.split(" ")[0] || "there";

  // Format date
  let formattedDate = scheduledDate || "TBD";
  if (scheduledDate && scheduledDate !== "TBD") {
    const parsed = new Date(scheduledDate + (scheduledDate.includes("T") ? "" : "T12:00:00"));
    if (!isNaN(parsed.getTime())) {
      formattedDate = parsed.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }
  }

  const avatarHtml = installerAvatarUrl
    ? `<img src="${installerAvatarUrl}" alt="${installerName}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #facc15;" />`
    : `<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#facc15,#f59e0b);display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#1e293b;">${installerName.charAt(0).toUpperCase()}</div>`;

  // Build service buttons
  const serviceButtonsHtml = services
    .map((s) => {
      const depositAmount = Math.round(s.price * 0.50);
      const upsellUrl = `${getAppUrl()}/upsell/${leadId}?service=${s.id}`;
      return `
      <div style="background:linear-gradient(135deg,#0f172a,#1a2332);border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <p style="margin:0 0 4px;color:#e2e8f0;font-size:16px;font-weight:700;">${s.name}</p>
            <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">${s.description}</p>
            <p style="margin:0;color:#64748b;font-size:12px;">50% deposit today: <strong style="color:#16a34a;">$${depositAmount}</strong> &bull; Remaining at service</p>
          </div>
          <div style="text-align:right;white-space:nowrap;margin-left:16px;">
            <p style="margin:0 0 8px;color:#facc15;font-size:22px;font-weight:900;">$${s.price}</p>
          </div>
        </div>
        <div style="text-align:center;margin-top:16px;">
          <a href="${upsellUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
            Add to My Service &rarr;
          </a>
        </div>
      </div>`;
    })
    .join("");

  const phoneHtml = installerPhone
    ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">${installerPhone}</p>`
    : "";

  const html = emailShell(
    "Prepare for Your Installation",
    `
    <!-- Warm Greeting -->
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Your installation with <strong style="color:#e2e8f0;">${installerName}</strong> is coming up on
      <strong style="color:#facc15;">${formattedDate}</strong>! Here are a few tips to get the most out of your appointment:
    </p>

    <!-- Preparation Tips -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Getting Ready</p>
      <table style="width:100%;font-size:14px;color:#94a3b8;">
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Clear the area where your new unit will be installed</td>
        </tr>
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Ensure your installer has access to the space</td>
        </tr>
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Have your totes or bins nearby if you plan to load them right away</td>
        </tr>
        ${address ? `<tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Confirm your install address: <strong style="color:#e2e8f0;">${address}</strong></td>
        </tr>` : ""}
      </table>
    </div>

    <!-- Installer Card -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <div style="margin-bottom:8px;">${avatarHtml}</div>
      <p style="margin:0 0 2px;color:#facc15;font-size:16px;font-weight:800;">${installerName}</p>
      <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your Installer</p>
      ${phoneHtml}
    </div>

    <!-- Upsell Section -->
    <div style="background-color:#422006;border:1px solid #92400e;border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;color:#facc15;font-size:16px;font-weight:800;">Want to Maximize Your Space?</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6;">
        ${installerName} also offers professional organizing and cleanout services.
        Add one to your appointment and let them handle the heavy lifting &mdash; just pick a service below!
      </p>
    </div>

    <!-- Service Buttons -->
    ${serviceButtonsHtml}

    <p style="margin:16px 0 0;color:#64748b;font-size:12px;text-align:center;line-height:1.5;">
      No obligation &mdash; if you&rsquo;d rather skip the add-on, your install is already confirmed and on the calendar.
      Simply ignore this section and we&rsquo;ll see you on ${formattedDate}!
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: customerName,
    subject: `${firstName}, your installation is in 3 days — get the most out of your appointment`,
    html,
    senderName: installerName,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Cleanout Upsell Installer Alert
// Trigger: Customer adds a cleanout service via the upsell flow
// ═══════════════════════════════════════════════════════════════════════════

export async function sendCleanoutUpsellInstallerAlert(
  installerEmail: string,
  data: {
    installerName: string;
    customerName: string;
    serviceName: string;
    servicePrice: number;
    depositCollected: number;
    remainingBalance: number;
    scheduledDate?: string;
    leadId: string;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard/leads/${data.leadId}`;

  let dateHtml = "";
  if (data.scheduledDate) {
    const parsed = new Date(data.scheduledDate + (data.scheduledDate.includes("T") ? "" : "T12:00:00"));
    if (!isNaN(parsed.getTime())) {
      const formatted = parsed.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      dateHtml = `<tr><td style="padding:8px 0;color:#94a3b8;">Scheduled</td><td style="padding:8px 0;font-weight:700;text-align:right;color:#facc15;">${formatted}</td></tr>`;
    }
  }

  const html = emailShell(
    "Add-On Service Booked!",
    `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:#052e16;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#127881;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.installerName},</p>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Great news! <strong style="color:#e2e8f0;">${data.customerName}</strong> just added a service to their upcoming appointment.
    </p>

    <!-- Service Details -->
    <div style="background-color:#052e16;border:1px solid #166534;border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#16a34a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Add-On Service Booked</p>
      <p style="margin:0 0 16px;color:#e2e8f0;font-size:20px;font-weight:800;">${data.serviceName}</p>

      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Service Price</td><td style="padding:6px 0;font-weight:700;text-align:right;color:#e2e8f0;">$${data.servicePrice.toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Deposit Collected (50%)</td><td style="padding:6px 0;font-weight:700;text-align:right;color:#16a34a;">$${data.depositCollected.toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Your Payout (40%)</td><td style="padding:6px 0;font-weight:700;text-align:right;color:#facc15;">$${Math.round(data.servicePrice * 0.40).toLocaleString()}</td></tr>
        <tr style="border-top:1px solid #166534;"><td style="padding:10px 0 0;color:#94a3b8;">Remaining at Service</td><td style="padding:10px 0 0;font-weight:800;text-align:right;font-size:18px;color:#facc15;">$${data.remainingBalance.toLocaleString()}</td></tr>
      </table>
    </div>

    <!-- Job Details -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;">Customer</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#e2e8f0;">${data.customerName}</td></tr>
        ${dateHtml}
      </table>
    </div>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
      This service has been added to the job ticket. The add-on remaining balance of
      <strong style="color:#facc15;">$${data.remainingBalance.toLocaleString()}</strong> has been included
      in the total balance due at service time.
    </p>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View Job Ticket
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      The 40% payout has been transferred to your connected Stripe account.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    toName: data.installerName,
    subject: `Add-On Booked: ${data.serviceName} — $${data.servicePrice.toLocaleString()} from ${data.customerName}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Cleanout Upsell Confirmation (Customer)
// Trigger: After successful cleanout upsell payment
//
// Comprehensive confirmation with ALL services, dates, and pricing.
// If no date is scheduled, no date verbiage is included.
// ═══════════════════════════════════════════════════════════════════════════

export interface CleanoutUpsellConfirmationData {
  customerName: string;
  customerEmail: string;
  installerName: string;
  installerPhone?: string;
  scheduledDate?: string;
  address?: string;
  existingServices: Array<{ name: string; price: number }>;
  upsellService: {
    name: string;
    price: number;
    depositPaid: number;
    remaining: number;
  };
  totalPrice: number;
  totalDeposit: number;
  totalBalance: number;
  leadId: string;
}

export async function sendCleanoutUpsellConfirmation(
  data: CleanoutUpsellConfirmationData
): Promise<SendEmailResult> {
  const {
    customerName,
    customerEmail,
    installerName,
    installerPhone,
    scheduledDate,
    address,
    existingServices,
    upsellService,
    totalPrice,
    totalDeposit,
    totalBalance,
    leadId,
  } = data;

  const firstName = customerName.split(" ")[0] || "there";
  const orderUrl = `${getAppUrl()}/success?jobId=${leadId}`;

  // Format date only if available
  let dateSection = "";
  if (scheduledDate && scheduledDate !== "TBD") {
    const parsed = new Date(scheduledDate + (scheduledDate.includes("T") ? "" : "T12:00:00"));
    if (!isNaN(parsed.getTime())) {
      const formattedDate = parsed.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      dateSection = `
        <tr><td style="padding:8px 0;color:#94a3b8;">Appointment Date</td><td style="padding:8px 0;font-weight:700;text-align:right;color:#facc15;">${formattedDate}</td></tr>
      `;
    }
  }

  // Build services list
  const existingServicesHtml = existingServices
    .map(
      (s) => `
      <tr>
        <td style="padding:6px 0;color:#cbd5e1;font-size:14px;">${s.name}</td>
        <td style="padding:6px 0;font-weight:600;text-align:right;color:#e2e8f0;">$${s.price.toLocaleString()}</td>
      </tr>`
    )
    .join("");

  const phoneHtml = installerPhone
    ? `<a href="tel:${installerPhone}" style="display:inline-block;margin-top:8px;background-color:#1e293b;color:#facc15;padding:8px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #facc15;">Call ${installerPhone}</a>`
    : "";

  const addressRow = address
    ? `<tr><td style="padding:8px 0;color:#94a3b8;">Location</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${address}</td></tr>`
    : "";

  const html = emailShell(
    "Your Updated Order Confirmation",
    `
    <!-- Success Badge -->
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:#052e16;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#10003;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Your add-on service has been confirmed! Here&rsquo;s a complete summary of everything
      that will be taken care of during your appointment with <strong style="color:#e2e8f0;">${installerName}</strong>.
    </p>

    <!-- All Services -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Services to Be Performed</p>
      <table style="width:100%;border-collapse:collapse;">
        ${existingServicesHtml}
        <tr style="border-top:1px solid #334155;">
          <td style="padding:10px 0 6px;color:#16a34a;font-size:14px;font-weight:700;">&#10003; ${upsellService.name} <span style="color:#94a3b8;font-weight:400;font-size:12px;">(just added)</span></td>
          <td style="padding:10px 0 6px;font-weight:700;text-align:right;color:#16a34a;">$${upsellService.price.toLocaleString()}</td>
        </tr>
        <tr style="border-top:2px solid #334155;">
          <td style="padding:12px 0 0;color:#94a3b8;font-size:14px;font-weight:700;">Grand Total</td>
          <td style="padding:12px 0 0;font-weight:900;text-align:right;font-size:22px;color:#facc15;">$${totalPrice.toLocaleString()}</td>
        </tr>
      </table>
    </div>

    <!-- Payment Summary -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Payment Summary</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Deposits Paid</td><td style="padding:6px 0;font-weight:700;text-align:right;color:#16a34a;">$${totalDeposit.toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Add-on deposit (${upsellService.name})</td><td style="padding:6px 0;font-weight:600;text-align:right;color:#16a34a;">$${upsellService.depositPaid.toLocaleString()}</td></tr>
        <tr style="border-top:1px solid #334155;">
          <td style="padding:10px 0 0;color:#94a3b8;font-weight:700;">Remaining Balance</td>
          <td style="padding:10px 0 0;font-weight:800;text-align:right;font-size:20px;color:#facc15;">$${totalBalance.toLocaleString()}*</td>
        </tr>
      </table>
      <p style="margin:12px 0 0;color:#94a3b8;font-size:11px;text-align:center;font-style:italic;">
        *Plus applicable sales tax, collected by your installer at service time.
      </p>
    </div>

    <!-- Appointment Details -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Appointment Details</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;">Installer</td><td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${installerName}</td></tr>
        ${dateSection}
        ${addressRow}
      </table>
      ${phoneHtml ? `<div style="text-align:center;margin-top:12px;">${phoneHtml}</div>` : ""}
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${orderUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View Full Order
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Questions? Reply to this email or contact your installer directly. We&rsquo;re here to help!
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: customerName,
    subject: `Order Updated — ${upsellService.name} added to your appointment with ${installerName}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Feature Announcement — March 2026 Platform Update
// Trigger: One-time cron to all installers
// ═══════════════════════════════════════════════════════════════════════════

export interface FeatureAnnouncementData {
  installerName: string;
  dashboardUrl: string;
  guidesUrl: string;
}

export async function sendFeatureAnnouncement(
  email: string,
  data: FeatureAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, dashboardUrl, guidesUrl } = data;

  const html = emailShell(
    "New Platform Features",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      We&rsquo;ve been building. Here&rsquo;s a quick rundown of everything new on your Storage Network platform &mdash;
      all designed to help you close more jobs and deliver a better experience to your customers.
    </p>

    <!-- Feature 1: Open Shelving -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">New &mdash; Open Shelving Units</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Your customers can now add <strong>standalone open shelving units</strong> directly in the 3D configurator.
        Available in 4&rsquo;, 5&rsquo;, and 6&rsquo; widths with short and tall height options &mdash; same 30&quot; depth
        as tote organizers so they sit flush on the wall. Plywood top and shelves included in every unit.
      </p>
    </div>

    <!-- Feature 2: Organizer Customization -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">New &mdash; Organizer Customization</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Customers can now customize individual tote organizer bays with <strong>plywood shelves</strong>,
        <strong>plywood doors</strong> with concealed Blum hinges, <strong>side panels</strong>, and
        <strong>rail removal</strong> &mdash; all priced per-addon. Plus a full <strong>paint system</strong>
        for frames, doors, and panels. Every addon flows through to the shopping list and cut plans.
      </p>
    </div>

    <!-- Feature 3: Toggle Controls -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Full Control &mdash; Your Settings</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Every new feature can be <strong>toggled on or off</strong> from your Profile &amp; Settings page.
        Don&rsquo;t want to offer open shelving? Disable it. Want to set your own addon pricing? Override
        every line item. You control exactly what your customers see on your branded design page.
      </p>
      <div style="margin-top:16px;">
        <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">
          Open Settings &rarr;
        </a>
      </div>
    </div>

    <!-- Feature 4: Tutorial Videos -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Guides &amp; Training Videos</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
        The <strong>Guides page</strong> now has step-by-step tutorial videos, installation checklists,
        and a social media playbook to help you market your builds. Whether you&rsquo;re a first-time
        installer or scaling your crew, everything you need is in one place.
      </p>
      <div style="margin-top:16px;">
        <a href="${guidesUrl}" style="display:inline-block;background-color:transparent;color:#facc15;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;border:1px solid #facc15;">
          View Guides &rarr;
        </a>
      </div>
    </div>

    <!-- Coming Soon: Auto-Marketing -->
    <div style="background:linear-gradient(135deg,#0f172a,#1a1a2e);border-radius:12px;padding:20px 24px;margin-bottom:24px;border:1px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">&#9889; Coming Soon &mdash; Pro Subscribers</p>
      <p style="margin:0 0 8px;color:#e2e8f0;font-size:16px;font-weight:700;">Auto-Marketing Agent</p>
      <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.7;">
        We&rsquo;re rolling out a <strong style="color:#e2e8f0;">state-of-the-art AI marketing agent</strong> exclusively
        for Pro subscribers. This system will automatically generate informative pages showcasing your
        portfolio, services, and service area &mdash; complete with SEO optimization and rich content.
        No effort on your end. The agent handles everything, creating professional marketing pages that
        drive traffic and leads directly to your profile. Stay tuned.
      </p>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:14px;">
      Thanks for being part of the network. We&rsquo;re building this for you.
    </p>
    <p style="margin:12px 0 0;color:#64748b;font-size:13px;">
      &mdash; The Storage Network Team
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "New Features: Open Shelving, Organizer Customization & More",
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Bounty System Announcement
// Trigger: One-time cron blast educating installers about the passive
//          income referral/bounty system.
// Called by /api/cron/bounty-announcement
// ═══════════════════════════════════════════════════════════════════════════

export interface BountyAnnouncementData {
  installerName: string;
  dashboardUrl: string;
  referralsUrl: string;
}

export async function sendBountyAnnouncementEmail(
  email: string,
  data: BountyAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, dashboardUrl, referralsUrl } = data;

  const html = emailShell(
    "Earn Money While You Sleep",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Did you know you can <strong style="color:#facc15;">earn passive income</strong> just by sharing your
      Storage Network link? Every installer on the platform has a built-in referral system that pays you
      real money &mdash; even when the customer is nowhere near your service area.
    </p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Here&rsquo;s the short version: <strong style="color:#e2e8f0;">share your link, and if someone outside
      your area books a job, you get paid.</strong> That&rsquo;s it. Zero extra work on your end.
    </p>

    <!-- How It Works -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 12px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">How It Works &mdash; 3 Simple Steps</p>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;padding:8px 12px 8px 0;width:32px;">
            <div style="background:#422006;color:#facc15;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:800;">1</div>
          </td>
          <td style="vertical-align:top;padding:8px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;font-weight:700;">Share your link anywhere</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
              Post it on Facebook, TikTok, Instagram, your website, even text it to friends. Your link
              works <strong>nationwide</strong> &mdash; not just in your service area. Think of it like
              dropping a fishing line that covers the whole country.
            </p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:8px 12px 8px 0;width:32px;">
            <div style="background:#422006;color:#facc15;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:800;">2</div>
          </td>
          <td style="vertical-align:top;padding:8px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;font-weight:700;">Customer configures &amp; books</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
              Someone clicks your link and designs their garage storage. If they&rsquo;re outside your
              area, we automatically connect them with a local installer near them. You don&rsquo;t
              have to do anything &mdash; the handoff is instant and seamless.
            </p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:8px 12px 8px 0;width:32px;">
            <div style="background:#422006;color:#facc15;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:800;">3</div>
          </td>
          <td style="vertical-align:top;padding:8px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;font-weight:700;">You get paid automatically</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
              When the customer pays their deposit, <strong style="color:#facc15;">30% of that deposit
              goes straight to your Stripe account</strong>. Minimum payout is $15 per referral.
              No invoicing, no chasing payments &mdash; it just shows up in your account.
            </p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Sample Earnings -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 12px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">What Could You Earn?</p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;line-height:1.6;">
        Here&rsquo;s what real referral bounties look like. These are based on typical deposit amounts:
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr style="border-bottom:1px solid #334155;">
          <td style="padding:10px 8px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Job Type</td>
          <td style="padding:10px 8px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:center;">Deposit</td>
          <td style="padding:10px 8px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Your Bounty</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">Small build</td>
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;text-align:center;">$50</td>
          <td style="padding:10px 8px;color:#16a34a;font-size:14px;font-weight:800;text-align:right;">$15.00</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">Mid-size garage</td>
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;text-align:center;">$150</td>
          <td style="padding:10px 8px;color:#16a34a;font-size:14px;font-weight:800;text-align:right;">$45.00</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">Full garage build</td>
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;text-align:center;">$300</td>
          <td style="padding:10px 8px;color:#16a34a;font-size:14px;font-weight:800;text-align:right;">$90.00</td>
        </tr>
        <tr>
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">Premium custom job</td>
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;text-align:center;">$500</td>
          <td style="padding:10px 8px;color:#facc15;font-size:14px;font-weight:800;text-align:right;">$150.00</td>
        </tr>
      </table>

      <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
        Just <strong>5 referrals a month</strong> at an average deposit of $200 = <strong style="color:#facc15;">$300/month in passive income</strong>.
        That&rsquo;s money you earn while you&rsquo;re on the job, eating dinner, or sleeping.
      </p>
    </div>

    <!-- Dashboard Snapshot -->
    <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:16px;">
      <div style="background:#0f172a;padding:12px 16px;border-bottom:1px solid #334155;">
        <p style="margin:0;color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">&#128200; Your Referral Dashboard</p>
      </div>
      <div style="padding:16px;">
        <!-- Stats row -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr>
            <td style="text-align:center;padding:8px;background:#1e293b;border-radius:8px;border:1px solid #334155;width:33%;">
              <p style="margin:0;color:#facc15;font-size:20px;font-weight:900;">$360</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Earned</p>
            </td>
            <td style="width:8px;"></td>
            <td style="text-align:center;padding:8px;background:#1e293b;border-radius:8px;border:1px solid #334155;width:33%;">
              <p style="margin:0;color:#10b981;font-size:20px;font-weight:900;">6</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Paid</p>
            </td>
            <td style="width:8px;"></td>
            <td style="text-align:center;padding:8px;background:#1e293b;border-radius:8px;border:1px solid #334155;width:33%;">
              <p style="margin:0;color:#f59e0b;font-size:20px;font-weight:900;">2</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Pending</p>
            </td>
          </tr>
        </table>
        <!-- Sample referral rows -->
        <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 12px;margin-bottom:6px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <p style="margin:0;color:#e2e8f0;font-size:12px;font-weight:600;">Austin, TX</p>
                <p style="margin:2px 0 0;color:#64748b;font-size:10px;">Mar 8 &bull; $1,200 job</p>
              </td>
              <td style="text-align:right;vertical-align:middle;">
                <span style="background:#052e16;color:#10b981;font-size:10px;font-weight:800;padding:3px 8px;border-radius:10px;">&#10003; +$45</span>
              </td>
            </tr>
          </table>
        </div>
        <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 12px;margin-bottom:6px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <p style="margin:0;color:#e2e8f0;font-size:12px;font-weight:600;">Denver, CO</p>
                <p style="margin:2px 0 0;color:#64748b;font-size:10px;">Mar 6 &bull; $2,400 job</p>
              </td>
              <td style="text-align:right;vertical-align:middle;">
                <span style="background:#052e16;color:#10b981;font-size:10px;font-weight:800;padding:3px 8px;border-radius:10px;">&#10003; +$90</span>
              </td>
            </tr>
          </table>
        </div>
        <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 12px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <p style="margin:0;color:#e2e8f0;font-size:12px;font-weight:600;">Phoenix, AZ</p>
                <p style="margin:2px 0 0;color:#64748b;font-size:10px;">Mar 10 &bull; $1,800 job</p>
              </td>
              <td style="text-align:right;vertical-align:middle;">
                <span style="background:#422006;color:#f59e0b;font-size:10px;font-weight:800;padding:3px 8px;border-radius:10px;">&#9719; ~$54</span>
              </td>
            </tr>
          </table>
        </div>
      </div>
      <div style="background:#0f172a;padding:8px 16px;border-top:1px solid #334155;text-align:center;">
        <p style="margin:0;color:#64748b;font-size:9px;font-style:italic;">Sample data &mdash; this is what your referral dashboard looks like</p>
      </div>
    </div>

    <!-- The Real Value -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 12px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Why This Matters</p>
      <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Between jobs, during slow weeks, or even on vacation &mdash; your link is always working for you.
        Every post you make, every video you upload, every link you share has the potential to earn you money
        from anywhere in the country.
      </p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
        You&rsquo;re already an expert at garage storage. Now that expertise pays you twice &mdash;
        once for your own jobs, and again for every customer your content reaches nationwide.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${referralsUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View My Referrals &rarr;
      </a>
    </div>

    <!-- Auto-Marketing Teaser -->
    <div style="background:linear-gradient(135deg,#0f172a,#1a1a2e);border-radius:12px;padding:20px 24px;margin-bottom:24px;border:1px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">&#9889; Coming Soon &mdash; Auto-Marketing Agent</p>
      <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.7;">
        We&rsquo;re building an <strong style="color:#e2e8f0;">AI-powered marketing system</strong> exclusively for
        Pro subscribers. It will automatically create SEO-optimized pages showcasing your portfolio,
        services, and service area &mdash; driving traffic and leads to your profile with zero effort
        on your end. Pair that with the referral system and your passive income potential goes through the roof.
        More details coming soon.
      </p>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:14px;">
      Start sharing your link today. The more people who see it, the more you earn.
    </p>
    <p style="margin:12px 0 0;color:#64748b;font-size:13px;">
      &mdash; The Storage Network Team
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "You're Leaving Money on the Table — Here's How Referrals Pay You",
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: Overhead Storage Launch Announcement
// Trigger: One-time cron blast educating installers about the new overhead
//          ceiling storage system — maximize profit per customer by upselling
//          overhead + open shelving on top of tote racks.
// Called by /api/cron/overhead-announcement
// ═══════════════════════════════════════════════════════════════════════════

export interface OverheadAnnouncementData {
  installerName: string;
  dashboardUrl: string;
  marketingUrl: string;
  configuratorSlug?: string;
}

export async function sendOverheadAnnouncementEmail(
  email: string,
  data: OverheadAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, dashboardUrl, marketingUrl, configuratorSlug } = data;
  const baseUrl = getAppUrl();
  const img1 = `${baseUrl}/images/Overhead-Storage-1.png`;
  const img2 = `${baseUrl}/images/Overhead-Storage-2.png`;
  const configuratorUrl = configuratorSlug ? `${baseUrl}/design/${configuratorSlug}` : dashboardUrl;

  const html = emailShell(
    "Overhead Ceiling Storage Is Live",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 8px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Quick question &mdash; when you&rsquo;re in a customer&rsquo;s garage, do you ever look up and think
      <strong style="color:#e2e8f0;">&ldquo;that&rsquo;s a lot of wasted space&rdquo;</strong>?
    </p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Your customers are thinking the same thing. Now you can capitalize on it.
    </p>

    <!-- Hero: Overhead Storage -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Now Live &mdash; Overhead Ceiling Storage</p>
      <p style="margin:0 0 16px;color:#e2e8f0;font-size:18px;font-weight:700;line-height:1.4;">
        Turn dead ceiling space into organized, accessible storage.
      </p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.7;">
        The overhead system is a <strong style="color:#e2e8f0;">3-layer build</strong> that lags directly to ceiling joists:
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="vertical-align:top;padding:6px 12px 6px 0;width:28px;">
            <div style="background:#422006;color:#facc15;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;">1</div>
          </td>
          <td style="vertical-align:top;padding:6px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;"><strong>2&times;4 Nailers</strong> &mdash; lag-screwed to joists with washers</p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:6px 12px 6px 0;width:28px;">
            <div style="background:#422006;color:#facc15;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;">2</div>
          </td>
          <td style="vertical-align:top;padding:6px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;"><strong>Plywood rail strips</strong> &mdash; screwed to the nailers</p>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding:6px 12px 6px 0;width:28px;">
            <div style="background:#422006;color:#facc15;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;">3</div>
          </td>
          <td style="vertical-align:top;padding:6px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:14px;"><strong>Slide-in tote trays</strong> &mdash; same 27-gallon HDX totes your customers already know</p>
          </td>
        </tr>
      </table>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
        It&rsquo;s a dead-simple build. Lumber, plywood, lag bolts. No fancy hardware, no expensive brackets.
        If you can build the tote racks, you can build this. The material cost is low and the perceived
        value to the customer is <strong style="color:#e2e8f0;">massive</strong> &mdash; they&rsquo;re literally
        getting storage space that didn&rsquo;t exist before.
      </p>
    </div>

    <!-- 3D Snapshots -->
    <div style="margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:49%;padding:0 4px 0 0;">
            <img src="${img1}" alt="Overhead storage 3D view" style="width:100%;border-radius:10px;border:1px solid #334155;display:block;" />
          </td>
          <td style="width:49%;padding:0 0 0 4px;">
            <img src="${img2}" alt="Overhead storage installed view" style="width:100%;border-radius:10px;border:1px solid #334155;display:block;" />
          </td>
        </tr>
      </table>
      <p style="margin:8px 0 0;color:#64748b;font-size:11px;text-align:center;font-style:italic;">
        3D configurator previews &mdash; customers can design their overhead system in seconds
      </p>
    </div>

    <!-- Maximize Profit -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #10b981;">
      <p style="margin:0 0 6px;color:#10b981;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Maximize Profit Per Customer</p>
      <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Every customer who books tote racks is a warm lead for overhead storage. You&rsquo;re already
        in the garage. You already have the tools. One conversation turns a $500 job into a $800&ndash;$1,200 job.
      </p>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #334155;">
          <td style="padding:10px 8px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Build</td>
          <td style="padding:10px 8px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Typical Add-On Revenue</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">Tote racks only</td>
          <td style="padding:10px 8px;color:#94a3b8;font-size:14px;text-align:right;">&mdash;</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">+ Overhead ceiling storage</td>
          <td style="padding:10px 8px;color:#10b981;font-size:14px;font-weight:800;text-align:right;">+$200&ndash;$500</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 8px;color:#e2e8f0;font-size:14px;">+ Open shelving unit</td>
          <td style="padding:10px 8px;color:#10b981;font-size:14px;font-weight:800;text-align:right;">+$150&ndash;$350</td>
        </tr>
        <tr>
          <td style="padding:10px 8px;color:#facc15;font-size:14px;font-weight:700;">Complete garage system</td>
          <td style="padding:10px 8px;color:#facc15;font-size:14px;font-weight:800;text-align:right;">+$350&ndash;$850</td>
        </tr>
      </table>
      <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
        That&rsquo;s real money from the same customer, the same appointment, and the same
        trip. The complete garage approach &mdash; walls, ceiling, and shelving &mdash; is your
        highest-margin upsell.
      </p>
    </div>

    <!-- The Complete Garage Pitch -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">The &ldquo;Complete Garage&rdquo; Pitch</p>
      <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Here&rsquo;s the play: <strong>start simple.</strong> You can be production-ready with just
        the tote rack offerings &mdash; that&rsquo;s the bread and butter, and it&rsquo;s all most
        customers need to get started.
      </p>
      <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.7;">
        But when a customer wants the full custom treatment &mdash; walls, ceiling, and shelving &mdash;
        you&rsquo;re now <strong>fully equipped to handle it.</strong> One installer, one visit, total
        garage transformation. That&rsquo;s the value proposition that sets you apart from every
        big-box shelving kit on the market.
      </p>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
        The configurator handles all the pricing and material lists automatically. Your customer
        designs their system, sees the price, and books &mdash; whether it&rsquo;s one tote rack
        or a floor-to-ceiling buildout.
      </p>
    </div>

    <!-- AI Script Generator Update -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Updated &mdash; AI Script Generator</p>
      <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Your <strong>Marketing tab</strong> is updated. The AI script generator now knows about
        all three product lines &mdash; tote racks, overhead ceiling storage, and open shelving.
      </p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.7;">
        New topic presets let you generate targeted posts in one tap:
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="padding:6px 8px;vertical-align:middle;">
            <span style="display:inline-block;background:#422006;color:#facc15;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">Overhead Storage</span>
          </td>
          <td style="padding:6px 8px;color:#94a3b8;font-size:13px;">&ldquo;Look up &mdash; that ceiling space is going to waste&rdquo;</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;vertical-align:middle;">
            <span style="display:inline-block;background:#422006;color:#facc15;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">Open Shelving</span>
          </td>
          <td style="padding:6px 8px;color:#94a3b8;font-size:13px;">&ldquo;Not everything fits in a tote&rdquo;</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;vertical-align:middle;">
            <span style="display:inline-block;background:#422006;color:#facc15;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">Full Garage System</span>
          </td>
          <td style="padding:6px 8px;color:#94a3b8;font-size:13px;">&ldquo;Walls + ceiling + shelving. One visit.&rdquo;</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;vertical-align:middle;">
            <span style="display:inline-block;background:#422006;color:#facc15;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">Holiday Prep</span>
          </td>
          <td style="padding:6px 8px;color:#94a3b8;font-size:13px;">&ldquo;Get decorations organized with overhead storage&rdquo;</td>
        </tr>
      </table>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;line-height:1.6;">
        Quick post templates for overhead and shelving are ready to copy &amp; paste, too. No AI needed &mdash;
        just tap, copy, and post.
      </p>
      <div style="text-align:center;">
        <a href="${marketingUrl}" style="display:inline-block;background-color:transparent;color:#facc15;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;border:1px solid #facc15;">
          Open Marketing Tab &rarr;
        </a>
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:24px 0;">
      <a href="${configuratorUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Open My Configurator &rarr;
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:14px;">
      Every garage has a ceiling. Start looking up &mdash; that&rsquo;s where the money is.
    </p>
    <p style="margin:12px 0 0;color:#64748b;font-size:13px;">
      &mdash; The Storage Network Team
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "Look Up \u2014 Overhead Ceiling Storage Is Live (Maximize Every Job)",
    html,
  });
}
