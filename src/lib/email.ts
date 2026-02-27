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
      <p style="margin:0;color:#e2e8f0;font-size:18px;font-weight:700;">Welcome aboard, ${data.name}!</p>
    </div>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      You&rsquo;ve just joined a growing network of skilled installers building custom tote storage systems
      for customers across the country. Here&rsquo;s everything you need to know to get started.
    </p>

    <!-- How It Works -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 16px;color:#facc15;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">How It Works</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
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
    <p style="margin:0 0 16px;color:#facc15;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Simple, Transparent Pricing</p>

    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:separate;border-spacing:12px 0;">
        <tr>
          <!-- Free Plan -->
          <td style="width:50%;vertical-align:top;background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;">
            <div style="text-align:center;margin-bottom:16px;">
              <span style="display:inline-block;background-color:#94a3b8;color:#fff;font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:1px;">Free</span>
            </div>
            <p style="margin:0 0 4px;text-align:center;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Platform Fee</p>
            <p style="margin:0 0 16px;text-align:center;color:#e2e8f0;font-size:28px;font-weight:900;">15%</p>
            <div style="border-top:1px solid #334155;padding-top:16px;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;">&#10003; Automated leads in your ZIP</p>
              <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;">&#10003; Cut lists &amp; material guides</p>
              <p style="margin:0;color:#94a3b8;font-size:12px;">&#10003; Direct bank payouts</p>
            </div>
          </td>

          <!-- Pro Plan -->
          <td style="width:50%;vertical-align:top;background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px;position:relative;">
            <div style="position:absolute;top:-8px;right:12px;background:linear-gradient(135deg,#facc15,#f59e0b);color:#1e293b;font-size:9px;font-weight:900;padding:4px 10px;border-radius:12px;text-transform:uppercase;letter-spacing:0.5px;">Recommended</div>
            <div style="text-align:center;margin-bottom:16px;">
              <span style="display:inline-block;background:linear-gradient(135deg,#facc15,#f59e0b);color:#1e293b;font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:1px;">Pro</span>
            </div>
            <p style="margin:0 0 4px;text-align:center;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Platform Fee</p>
            <p style="margin:0;text-align:center;color:#facc15;font-size:28px;font-weight:900;">3%</p>
            <p style="margin:0 0 16px;text-align:center;color:#94a3b8;font-size:11px;">on your direct leads</p>
            <div style="border-top:1px solid #475569;padding-top:16px;">
              <p style="margin:0 0 8px;color:#e2e8f0;font-size:12px;">&#10003; Everything in Free, plus:</p>
              <p style="margin:0 0 8px;color:#facc15;font-size:12px;font-weight:600;">&#9733; Only 3% on partner link leads</p>
              <p style="margin:0 0 8px;color:#e2e8f0;font-size:12px;">&#10003; Custom branded partner link</p>
              <p style="margin:0 0 8px;color:#e2e8f0;font-size:12px;">&#10003; Priority lead routing</p>
              <p style="margin:0;color:#e2e8f0;font-size:12px;">&#10003; Marketing tools</p>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Savings Example -->
    <div style="background-color:#052e16;border:1px solid #166534;border-radius:12px;padding:16px;margin-bottom:24px;">
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
    <div style="text-align:center;padding:20px;background:linear-gradient(135deg,#422006,#451a03);border-radius:12px;margin-bottom:16px;">
      <p style="margin:0;color:#facc15;font-size:16px;font-weight:700;">
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
          <td style="padding:10px 0;"><strong>Lower Fees</strong> — Only 3% platform fee on direct link leads (vs 15%)</td>
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
}

export function buildQuoteEmailTemplate(data: QuoteEmailData): string {
  const { customerName, businessName, installerFirstName, installerPhone, quoteItems, totalPrice, depositAmount, checkoutUrl } = data;

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
    <p style="margin:0 0 24px;color:#e2e8f0;font-size:15px;">Looking forward to getting your space organized!</p>
    <p style="margin:0 0 24px;color:#e2e8f0;font-size:15px;">
      Best,<br/>${sigName}<br/>${businessName}${phoneLine}
    </p>
    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;font-style:italic;">
      *Sales tax (if applicable) will be collected by your installer at the time of installation. Questions? Simply reply to this email.
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
