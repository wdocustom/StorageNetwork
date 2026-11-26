import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Referral partner emails (migration 168):
//   portal invite      → partner, when the installer turns portal access on
//   client referral    → someone the partner thinks needs storage, sent from
//                        the partner's portal (reply-to is the partner)
//   commission earned  → partner, when a referred customer's deposit is paid
// ═══════════════════════════════════════════════════════════════════════════

function eyebrow(text: string): string {
  return `<p style="margin:0 0 12px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${text}</p>`;
}
function ctaButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background-color:#facc15;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">${label}</a>`;
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const money = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

export async function sendPartnerPortalInviteEmail(
  email: string,
  data: {
    partnerName: string;
    installerName: string;
    cutText: string;
    /** One-time set-password link for a new login; null when they already have a Storage Network login. */
    setPasswordUrl: string | null;
  },
): Promise<SendEmailResult> {
  const loginUrl = `${getAppUrl()}/partners/login`;
  const html = masterEmailLayout(
    "Your partner dashboard",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${escapeHtml(data.partnerName)},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      ${escapeHtml(data.installerName)} set you up as a referral partner on Storage Network. Your dashboard shows
      everyone you've referred, what you've earned (${escapeHtml(data.cutText)}), and when it's paid. You can also
      email your link to clients from there and connect Stripe to get paid automatically.
    </p>
    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:28px;text-align:center;margin:0 0 24px;">
      ${
        data.setPasswordUrl
          ? `<p style="margin:0 0 18px;color:#a3a3a3;font-size:13px;line-height:1.6;">Your account is ready. Set a password to get in. This link works once and expires in 7 days.</p>
             ${ctaButton(data.setPasswordUrl, "Set your password")}`
          : `<p style="margin:0 0 18px;color:#a3a3a3;font-size:13px;line-height:1.6;">Log in with your existing Storage Network email and password.</p>
             ${ctaButton(loginUrl, "Open your dashboard")}`
      }
    </div>
    <p style="margin:0;color:#555;font-size:12px;text-align:center;">Later on, log in anytime at ${escapeHtml(loginUrl)}</p>
    `,
  );
  return sendTransactionalEmail({
    to: email,
    subject: `${data.installerName} added you as a referral partner`,
    html,
  });
}

export async function sendClientReferralEmail(
  to: string,
  data: {
    clientName: string | null;
    partnerName: string;
    partnerEmail: string | null;
    installerName: string;
    discountText: string | null;
    linkUrl: string;
    note: string | null;
  },
): Promise<SendEmailResult> {
  const greeting = data.clientName ? `Hi ${escapeHtml(data.clientName)},` : "Hi,";
  const html = masterEmailLayout(
    "A recommendation for you",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 20px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      ${escapeHtml(data.partnerName)} thought you'd want to know about ${escapeHtml(data.installerName)}: custom
      tote storage racks, built and installed in your garage, so the move-in boxes finally have a home.
    </p>
    ${
      data.note
        ? `<div style="border-left:3px solid #facc15;padding:4px 0 4px 14px;margin:0 0 20px;color:#e5e5e5;font-size:14px;line-height:1.6;white-space:pre-line;">${escapeHtml(data.note)}<br><span style="color:#777;font-size:12px;">— ${escapeHtml(data.partnerName)}</span></div>`
        : ""
    }
    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:28px;text-align:center;margin:0 0 20px;">
      ${data.discountText ? eyebrow(`${escapeHtml(data.discountText)} through this link`) : ""}
      <p style="margin:0 0 18px;color:#a3a3a3;font-size:13px;line-height:1.6;">Design your rack, see the price and book online.</p>
      ${ctaButton(data.linkUrl, "See your options")}
    </div>
    <p style="margin:0;color:#555;font-size:12px;text-align:center;line-height:1.6;">
      ${escapeHtml(data.partnerName)} sent this to you through Storage Network. Reply to reach them directly.
      You won't get more emails from us unless you book.
    </p>
    `,
  );
  return sendTransactionalEmail({
    to,
    subject: data.discountText
      ? `${data.partnerName} sent you ${data.discountText} on garage storage`
      : `${data.partnerName} recommends ${data.installerName}`,
    html,
    senderName: `${data.partnerName} via Storage Network`,
    ...(data.partnerEmail ? { replyTo: data.partnerEmail } : {}),
  });
}

export async function sendPartnerCommissionEmail(
  email: string,
  data: {
    partnerName: string;
    installerName: string;
    amountCents: number;
    customerName: string | null;
    /** true: collected from the deposit (paid to Stripe); false: the installer pays it directly. */
    collected: boolean;
    hasLogin: boolean;
  },
): Promise<SendEmailResult> {
  const portalUrl = `${getAppUrl()}/partners`;
  const who = data.customerName?.trim().split(/\s+/)[0];
  const html = masterEmailLayout(
    "You earned a referral",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Nice one, ${escapeHtml(data.partnerName)}.</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      ${who ? escapeHtml(who) : "A customer you referred"} just paid their deposit with ${escapeHtml(data.installerName)}.
      You earned <strong style="color:#facc15;">${money(data.amountCents)}</strong>.
      ${
        data.collected
          ? "It's sent to your connected Stripe account. If you haven't connected Stripe yet, it's waiting for you in your dashboard."
          : `${escapeHtml(data.installerName)} pays this to you directly.`
      }
    </p>
    ${data.hasLogin ? `<div style="text-align:center;margin:0 0 8px;">${ctaButton(portalUrl, "Open your dashboard")}</div>` : ""}
    `,
  );
  return sendTransactionalEmail({
    to: email,
    subject: `You earned ${money(data.amountCents)} for a referral`,
    html,
  });
}
