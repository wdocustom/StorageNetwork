import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor email templates — Phase A1 (welcome only).
//
// Tone: realtors are credibility-driven, relationship-driven, status-driven.
// The pitch is "the smartest closing gift on the market" — totes are the
// hook; the long-term value is the buyer remembering YOU when they need
// anything else for the home (storage, organization, contractors).
// ═══════════════════════════════════════════════════════════════════════════

function eyebrow(text: string): string {
  return `<p style="margin:0 0 12px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${text}</p>`;
}

function ctaButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background-color:#facc15;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">${label}</a>`;
}

export async function sendRealtorWelcomeEmail(
  email: string,
  data: { name: string; brokerage: string }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/realtors/dashboard`;

  const html = masterEmailLayout(
    "Welcome to Storage Network",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Welcome, ${data.name}.</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      You just unlocked the smartest closing gift on the market &mdash;
      reusable moving totes, delivered to your buyer or seller, picked up
      after they're settled. No cardboard. No mess. And every tote arrives
      with <strong style="color:#ffffff;">your name on the box</strong>.
    </p>

    ${eyebrow("How it works")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">1.</span>Pick a tote package &mdash; 20, 30, 40, or 50 totes &mdash; for the size of the move.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">2.</span>Send the gift link to your buyer or seller. Your name, your brokerage, your message.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">3.</span>A local pro delivers and picks up. You look like a hero. Done.</td></tr>
    </table>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">${data.brokerage}</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;line-height:1.6;">Your dashboard is live. Set up your branding, then send your first gift &mdash; takes about 90 seconds.</p>
      ${ctaButton(dashboardUrl, "Open Realtor Dashboard")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Questions? Reply to this email &mdash; we read every one.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Welcome to Storage Network — your closing-gift toolkit is live",
    html,
  });
}
