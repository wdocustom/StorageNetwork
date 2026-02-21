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

function emailShell(title: string, body: string): string {
  const logoUrl = `${getAppUrl()}/landing_page_logo.png`;

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
        <img src="${logoUrl}" alt="Storage Network" style="max-width:64px;max-height:64px;width:auto;height:auto;margin-bottom:12px;" />
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
      Thanks for your order! We&rsquo;ve received your deposit of <strong style="color:#16a34a;">$${depositAmount.toLocaleString()}</strong>.
      Your installer will be in touch shortly to confirm your date: <strong style="color:#1e293b;">${formattedDate}</strong>.
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
        <tr><td style="padding:8px 0;color:#64748b;">Balance Due at Install</td><td style="padding:8px 0;font-weight:800;text-align:right;font-size:18px;color:#1e293b;">$${balanceDue.toLocaleString()}*</td></tr>
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
    <div style="background-color:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:24px;">
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
    <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;color:#dc2626;font-size:14px;font-weight:700;">
        Action Required: Contact customer within 24 hours
      </p>
    </div>

    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;color:#16a34a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">New Job &mdash; ${city}</p>
      <p style="margin:0;color:#1e293b;font-size:28px;font-weight:800;">$${profitEstimate.toLocaleString()}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:12px;">estimated profit</p>
    </div>
    <table style="width:100%;margin-bottom:24px;font-size:14px;color:#334155;">
      <tr><td style="padding:8px 0;color:#64748b;width:120px;">Customer</td><td style="padding:8px 0;font-weight:600;">${leadDetails.customerName}</td></tr>
      ${leadDetails.customerEmail ? `<tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;font-weight:600;">${leadDetails.customerEmail}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#64748b;">Address</td><td style="padding:8px 0;font-weight:600;">${leadDetails.address || city}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Units</td><td style="padding:8px 0;font-weight:600;">${leadDetails.unitCount} shelving unit${leadDetails.unitCount !== 1 ? "s" : ""}</td></tr>
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
    <p style="margin:0 0 16px;color:#334155;font-size:16px;">Hey ${data.installerName},</p>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
      Great news! <strong>${data.customerName}</strong> just paid the remaining balance for their installation.
    </p>

    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;color:#16a34a;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Payment Received</p>
      <p style="margin:0;color:#16a34a;font-size:36px;font-weight:900;">$${data.amountReceived.toLocaleString()}</p>
    </div>

    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#334155;">
        <tr><td style="padding:6px 0;color:#64748b;">Customer</td><td style="padding:6px 0;font-weight:600;text-align:right;">${data.customerName}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Job Total</td><td style="padding:6px 0;font-weight:600;text-align:right;">$${data.jobTotal.toLocaleString()}</td></tr>
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
// Template: Installer Onboarding Welcome
// Trigger: New installer signs up / completes registration
// ═══════════════════════════════════════════════════════════════════════════

export async function sendInstallerOnboardingEmail(
  email: string,
  data: {
    name: string;
    isPro?: boolean;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const upgradeUrl = `${getAppUrl()}/upgrade`;

  const html = emailShell(
    "Welcome to Storage Network",
    `
    <!-- Hero Welcome -->
    <div style="text-align:center;margin-bottom:28px;">
      <p style="margin:0 0 8px;font-size:32px;">&#128075;</p>
      <p style="margin:0;color:#334155;font-size:18px;font-weight:700;">Welcome aboard, ${data.name}!</p>
    </div>

    <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.7;">
      You&rsquo;ve just joined a growing network of skilled installers building custom tote storage systems
      for customers across the country. Here&rsquo;s everything you need to know to get started.
    </p>

    <!-- How It Works -->
    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 16px;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">How It Works</p>
      <table style="width:100%;font-size:14px;color:#334155;">
        <tr>
          <td style="padding:10px 0;vertical-align:top;width:32px;font-size:20px;">1&#65039;&#8419;</td>
          <td style="padding:10px 0;"><strong>Leads come to you</strong> — Customers design their system and pay a deposit. You get notified instantly.</td>
        </tr>
        <tr>
          <td style="padding:10px 0;vertical-align:top;font-size:20px;">2&#65039;&#8419;</td>
          <td style="padding:10px 0;"><strong>Everything&rsquo;s ready</strong> — Each job includes a cut list and materials list so you know exactly what to build.</td>
        </tr>
        <tr>
          <td style="padding:10px 0;vertical-align:top;font-size:20px;">3&#65039;&#8419;</td>
          <td style="padding:10px 0;"><strong>Flexible payments</strong> — Collect the balance on-site however works best: Venmo, cash, check, or process cards through Stripe.</td>
        </tr>
      </table>
    </div>

    <!-- Fee Structure Comparison -->
    <p style="margin:0 0 16px;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Simple, Transparent Pricing</p>

    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:separate;border-spacing:12px 0;">
        <tr>
          <!-- Free Plan -->
          <td style="width:50%;vertical-align:top;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
            <div style="text-align:center;margin-bottom:16px;">
              <span style="display:inline-block;background-color:#64748b;color:#fff;font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:1px;">Free</span>
            </div>
            <p style="margin:0 0 4px;text-align:center;color:#1e293b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Platform Fee</p>
            <p style="margin:0 0 16px;text-align:center;color:#334155;font-size:28px;font-weight:900;">15%</p>
            <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
              <p style="margin:0 0 8px;color:#64748b;font-size:12px;">&#10003; Automated leads in your ZIP</p>
              <p style="margin:0 0 8px;color:#64748b;font-size:12px;">&#10003; Cut lists &amp; material guides</p>
              <p style="margin:0;color:#64748b;font-size:12px;">&#10003; Direct bank payouts</p>
            </div>
          </td>

          <!-- Pro Plan -->
          <td style="width:50%;vertical-align:top;background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px;position:relative;">
            <div style="position:absolute;top:-8px;right:12px;background:linear-gradient(135deg,#facc15,#f59e0b);color:#1e293b;font-size:9px;font-weight:900;padding:4px 10px;border-radius:12px;text-transform:uppercase;letter-spacing:0.5px;">Recommended</div>
            <div style="text-align:center;margin-bottom:16px;">
              <span style="display:inline-block;background:linear-gradient(135deg,#facc15,#f59e0b);color:#1e293b;font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:1px;">Pro</span>
            </div>
            <p style="margin:0 0 4px;text-align:center;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Platform Fee</p>
            <p style="margin:0;text-align:center;color:#facc15;font-size:28px;font-weight:900;">5%</p>
            <p style="margin:0 0 16px;text-align:center;color:#94a3b8;font-size:11px;">on your direct leads</p>
            <div style="border-top:1px solid #475569;padding-top:16px;">
              <p style="margin:0 0 8px;color:#e2e8f0;font-size:12px;">&#10003; Everything in Free, plus:</p>
              <p style="margin:0 0 8px;color:#facc15;font-size:12px;font-weight:600;">&#9733; Only 5% on partner link leads</p>
              <p style="margin:0 0 8px;color:#e2e8f0;font-size:12px;">&#10003; Custom branded partner link</p>
              <p style="margin:0 0 8px;color:#e2e8f0;font-size:12px;">&#10003; Priority lead routing</p>
              <p style="margin:0;color:#e2e8f0;font-size:12px;">&#10003; Marketing tools</p>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Savings Example -->
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#16a34a;font-size:13px;line-height:1.6;">
        <strong>&#128176; Pro Math:</strong> On a $1,500 job from your own customer, Free takes $225 in fees.
        Pro takes just $75 &mdash; that&rsquo;s <strong>$150 more in your pocket</strong>.
      </p>
    </div>

    <!-- CTA Buttons -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin-right:8px;">
        Open Dashboard
      </a>
      ${!data.isPro ? `<a href="${upgradeUrl}" style="display:inline-block;background-color:#1e293b;color:#facc15;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;border:2px solid #facc15;">
        Upgrade to Pro
      </a>` : ""}
    </div>

    <!-- Closing -->
    <div style="text-align:center;padding:20px;background:linear-gradient(135deg,#fefce8,#fef9c3);border-radius:12px;margin-bottom:16px;">
      <p style="margin:0;color:#1e293b;font-size:16px;font-weight:700;">
        We look forward to building with you! &#128170;
      </p>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Questions? Just reply to this email &mdash; we&rsquo;re here to help.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Welcome to Storage Network — Let's Build!",
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

    <p style="margin:0 0 16px;color:#334155;font-size:16px;">Hey ${data.name},</p>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
      You&rsquo;re now a <strong style="color:#facc15;">Pro Partner</strong>! Here&rsquo;s what you&rsquo;ve unlocked:
    </p>

    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#334155;">
        <tr>
          <td style="padding:10px 0;vertical-align:top;width:24px;color:#16a34a;font-size:18px;">&#10003;</td>
          <td style="padding:10px 0;"><strong>Lower Fees</strong> — Only 5% platform fee on direct link leads (vs 15%)</td>
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
    ? `<tr><td style="padding:8px 0;color:#64748b;">Phone</td><td style="padding:8px 0;font-weight:600;text-align:right;">${data.customerPhone}</td></tr>`
    : "";

  const radiusLine = data.radiusMiles
    ? `outside your current <strong>${data.radiusMiles}-mile</strong> service radius`
    : `outside your current service area`;

  const html = emailShell(
    "Waitlist Request",
    `
    <p style="margin:0 0 16px;color:#334155;font-size:16px;">Hey ${data.installerName},</p>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
      A customer wants a tote rack build, but their ZIP code (<strong style="color:#1e293b;">${data.customerZip}</strong>) is ${radiusLine}.
      They&rsquo;ve asked to be added to your waitlist in case you expand coverage.
    </p>

    <div style="background-color:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#92400e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Customer Details</p>
      <table style="width:100%;font-size:14px;color:#334155;">
        <tr><td style="padding:8px 0;color:#64748b;width:100px;">Name</td><td style="padding:8px 0;font-weight:600;text-align:right;">${data.customerName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;font-weight:600;text-align:right;"><a href="mailto:${data.customerEmail}" style="color:#2563eb;text-decoration:none;">${data.customerEmail}</a></td></tr>
        ${phoneLine}
        <tr><td style="padding:8px 0;color:#64748b;">ZIP Code</td><td style="padding:8px 0;font-weight:800;text-align:right;color:#dc2626;">${data.customerZip}</td></tr>
      </table>
    </div>

    <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.7;">
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
        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#1e293b;">$${item.price.toFixed(2)}</td>
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
    <div style="background-color:#f8fafc;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
      <table style="width:100%;">
        <tr><td style="color:#64748b;font-size:14px;">Total Estimate</td><td style="text-align:right;color:#1e293b;font-size:24px;font-weight:800;">$${totalPrice.toFixed(2)}</td></tr>
        <tr><td style="color:#64748b;font-size:14px;padding-top:12px;border-top:1px dashed #cbd5e1;">Deposit Due (15%)</td><td style="text-align:right;color:#facc15;font-size:18px;font-weight:700;padding-top:12px;border-top:1px dashed #cbd5e1;">$${depositAmount.toFixed(2)}</td></tr>
      </table>
    </div>
    <p style="margin:0 0 28px;color:#94a3b8;font-size:12px;text-align:center;font-style:italic;">
      *Sales tax (if applicable) will be collected by your installer at the time of installation.
    </p>
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
      <div style="display:inline-block;background:#fef3c7;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#128722;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#334155;font-size:16px;">Hi ${data.customerName},</p>

    <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.7;">
      Looks like you didn&rsquo;t finish your order ${installerLine}.
      No worries &mdash; your custom configuration is saved and ready to go!
    </p>

    <!-- Order Summary Card -->
    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 16px;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Your Order Summary</p>
      <table style="width:100%;">
        <tr>
          <td style="color:#64748b;font-size:14px;padding:8px 0;">Total Estimate</td>
          <td style="text-align:right;color:#1e293b;font-size:20px;font-weight:800;">$${data.totalPrice.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="color:#64748b;font-size:14px;padding:8px 0;border-top:1px dashed #e2e8f0;">Deposit to Reserve (15%)</td>
          <td style="text-align:right;color:#f59e0b;font-size:18px;font-weight:700;padding-top:8px;border-top:1px dashed #e2e8f0;">$${data.depositAmount.toFixed(2)}</td>
        </tr>
      </table>
    </div>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:11px;text-align:center;font-style:italic;">
      *Sales tax (if applicable) will be collected by your installer at the time of installation.
    </p>

    <!-- Urgency Note -->
    <div style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px;margin-bottom:24px;">
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
    <div style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:12px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;font-size:12px;color:#64748b;">
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
  }
): Promise<SendEmailResult> {
  const location = [data.customerCity, data.customerState].filter(Boolean).join(", ")
    || (data.customerZip ? `ZIP ${data.customerZip}` : "another area");

  const html = emailShell(
    "New Network Referral",
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#fef3c7;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#128279;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#334155;font-size:16px;">Hey ${data.referrerName},</p>

    <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.7;">
      Your link just generated a referral! A customer in <strong>${location}</strong> used your configurator link, but the installation address is outside your service area.
    </p>

    ${data.localInstallerName ? `
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.7;">
      We've connected them with <strong>${data.localInstallerName}</strong>, a partner installer in their area.
    </p>
    ` : ""}

    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Network Bounty</p>
      <p style="margin:0;color:#f59e0b;font-size:28px;font-weight:900;">$15.00</p>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:12px;">You'll earn this when the customer books and pays their deposit.</p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${getAppUrl()}/dashboard/referrals" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View My Referrals
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Keep sharing your link &mdash; every out-of-area booking earns you $15.
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
// Trigger: The $15 bounty was transferred to the referring installer's
// Stripe account after the customer's deposit was captured.
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
      <div style="display:inline-block;background:#d1fae5;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#128176;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#334155;font-size:16px;">Hey ${data.referrerName},</p>

    <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.7;">
      Great news! A customer from <strong>${location}</strong> just booked through your referral. Your network bounty has been deposited.
    </p>

    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#16a34a;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Deposited to Your Stripe Account</p>
      <p style="margin:0;color:#15803d;font-size:36px;font-weight:900;">$${data.amount.toFixed(2)}</p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${getAppUrl()}/dashboard/referrals" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View My Referrals
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Keep sharing your link &mdash; every out-of-area booking earns you $15.
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
