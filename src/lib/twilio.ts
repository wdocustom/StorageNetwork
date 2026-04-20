"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Twilio SMS Utility — Platform Notification Engine
//
// Mirrors the email.ts pattern: lazy singleton, dev-safe logging,
// environment-gated sending.
//
// Env vars:
//   TWILIO_ACCOUNT_SID     — Twilio Account SID
//   TWILIO_AUTH_TOKEN       — Twilio Auth Token
//   TWILIO_PHONE_NUMBER    — Platform sending number (e.g., +1234567890)
// ═══════════════════════════════════════════════════════════════════════════

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

interface SmsResult {
  success: boolean;
  sid?: string;
  error?: string;
}

/**
 * Normalize a US phone number to E.164 format (+1XXXXXXXXXX).
 * Handles: (555) 123-4567, 555-123-4567, 5551234567, +15551234567
 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  // Already includes country code
  if (raw.startsWith("+") && digits.length >= 11) {
    return `+${digits}`;
  }

  return null; // Unrecognizable format
}

/**
 * Send an SMS via Twilio REST API (no SDK dependency).
 * Uses fetch() directly against the Twilio Messages endpoint.
 */
export async function sendSms(
  to: string,
  body: string
): Promise<SmsResult> {
  // Normalize the recipient phone number
  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) {
    console.error("[SMS] Invalid phone number format:", to);
    return { success: false, error: `Invalid phone number: ${to}` };
  }

  // Dev safety — log instead of sending if Twilio isn't configured
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.log("[SMS] Twilio not configured — logging instead:");
    console.log(`  TO: ${normalizedTo}`);
    console.log(`  BODY: ${body}`);
    return { success: true, sid: "dev-mode-no-send" };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: normalizedTo,
        From: TWILIO_FROM,
        Body: body,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[SMS] Twilio API error:", data);
      return {
        success: false,
        error: data.message || `Twilio error: ${response.status}`,
      };
    }

    console.log("[SMS] Sent successfully:", data.sid, "→", normalizedTo);
    return { success: true, sid: data.sid };
  } catch (err) {
    console.error("[SMS] Send failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "SMS send failed",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: New Booking Alert (Installer SMS)
// Trigger: Deposit paid — mirrors sendNewBookingAlert email
// ═══════════════════════════════════════════════════════════════════════════

export async function smsNewBookingAlert(
  installerPhone: string,
  customerZip: string,
  profitEstimate: number
): Promise<SmsResult> {
  const body = [
    `Storage Network Alert: New Job Confirmed!`,
    `A new build has been booked in ${customerZip || "your area"}.`,
    `Estimated profit: $${profitEstimate.toLocaleString()}.`,
    `Log in to your dashboard to view details and accept.`,
  ].join(" ");

  return sendSms(installerPhone, body);
}

// ═══════════════════════════════════════════════════════════════════════════
// Template: En Route / Start Trip (Customer SMS)
// Trigger: Installer taps "Start Trip & Notify Customer"
// ═══════════════════════════════════════════════════════════════════════════

export async function smsCustomerEnRoute(
  customerPhone: string,
  customerName: string,
  installerFirstName: string,
  remainingBalance: string,
  etaWindow: string = "approx. 60 minutes"
): Promise<SmsResult> {
  const body = [
    `Hi ${customerName}, this is ${installerFirstName} with Storage Network.`,
    `I am en route to your location for your installation!`,
    `\nPlease ensure the path to the garage and the install wall are clear.`,
    `\nYour remaining balance due upon completion is: ${remainingBalance}.`,
    `\nEstimated Arrival: Within ${etaWindow}. See you soon!`,
  ].join(" ");

  return sendSms(customerPhone, body);
}
