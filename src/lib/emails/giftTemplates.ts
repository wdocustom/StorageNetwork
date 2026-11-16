import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import { CONTACT_EMAIL } from "@/lib/plan-library";
import { TOTE_PLAN_ALL_ACCESS } from "@/lib/tote-plans";
import {
  GIFT_SENDER_ADDRESS,
  firstNameOf,
  giftManagePath,
  giftOpenPath,
  giftOrderRef,
  giftPriceLabel,
} from "@/lib/plan-gifts";

// ═══════════════════════════════════════════════════════════════════════════
// Gift DIY plans: the recipient's email and the gifter's receipt
//
// Deliverability matters more than usual here: the recipient isn't
// expecting mail from us. So each recipient gets their own message (never
// a shared To/CC), the From name and subject carry the gifter's name (the
// one thing they'll recognise), replies go to the gifter, and the copy is
// plain: no prices, no "FREE", no urgency, one button.
// Everything the gifter typed is HTML-escaped.
// ═══════════════════════════════════════════════════════════════════════════

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped, with the gifter's line breaks kept. */
function messageHtml(message: string): string {
  return escapeHtml(message).replace(/\n/g, "<br>");
}

/** Inbox preview line (hidden in the body). */
function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(text)}</div>`;
}

/** What the recipient gets, in gift terms (no prices, nothing about paying). */
const GIFT_INCLUDES = [
  "A plan for every tote rack you design, any size, for life",
  "Interactive 3D build guide: rotate, zoom and step through each cut",
  "Printable PDF with the shopping list, cut diagrams and every step",
  "Sized for 27-gallon HDX (Home Depot) or Greenmade (Costco) totes",
];

export interface GiftRecipientEmail {
  to: string;
  recipientName: string;
  gifterName: string;
  gifterEmail: string;
  message: string | null;
  accessToken: string;
}

export function giftRecipientEmailContent(p: GiftRecipientEmail): { subject: string; html: string; senderName: string } {
  const appUrl = getAppUrl();
  const openUrl = `${appUrl}${giftOpenPath(p.accessToken)}`;
  const libraryUrl = `${appUrl}/plans/library?token=${p.accessToken}`;
  const recipientFirst = escapeHtml(firstNameOf(p.recipientName) || "there");
  const gifter = escapeHtml(p.gifterName);
  const gifterFirst = firstNameOf(p.gifterName) || p.gifterName;

  const note = p.message
    ? `
    <div style="background:#111;border-left:3px solid #facc15;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;color:#888;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">A note from ${gifter}</p>
      <p style="margin:0;color:#e5e5e5;font-size:15px;line-height:1.6;">${messageHtml(p.message)}</p>
    </div>`
    : "";

  const body = `
    ${preheader(`${p.gifterName} gave you lifetime access to DIY tote rack build plans.`)}
    <div style="background:#111;border-radius:12px;padding:28px 24px;margin-bottom:20px;border:1px solid #222;">
      <p style="margin:0 0 6px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">A gift from ${gifter}</p>
      <h2 style="margin:0 0 10px;color:#fff;font-size:21px;font-weight:800;line-height:1.3;">Hi ${recipientFirst}, ${gifter} gave you DIY tote rack plans.</h2>
      <p style="margin:0;color:#aaa;font-size:14px;line-height:1.6;">
        It&rsquo;s ${escapeHtml(TOTE_PLAN_ALL_ACCESS.name)}, yours for life: design a tote rack sized to your own wall, then build it
        with a step-by-step 3D guide and a printable cut list. Every size you design is included.
      </p>
    </div>

    ${note}

    <div style="text-align:center;margin-bottom:26px;">
      <a href="${openUrl}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
        Open my gift &rarr;
      </a>
      <p style="margin:12px 0 0;color:#666;font-size:12px;">Nothing to pay and no account to make. This link is yours, so keep this email.</p>
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 10px;color:#666;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">What you get</p>
      ${GIFT_INCLUDES
        .map(
          (item) => `
        <div style="margin-bottom:8px;">
          <span style="color:#facc15;font-size:12px;">&#10003;</span>
          <span style="color:#ccc;font-size:13px;margin-left:6px;">${escapeHtml(item)}</span>
        </div>`
        )
        .join("")}
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px 20px;margin-bottom:8px;">
      <p style="margin:0;color:#777;font-size:12px;line-height:1.6;">
        All your plans live in <a href="${libraryUrl}" style="color:#facc15;text-decoration:none;">My Builds</a>.
        Opening them on a new phone or computer? We&rsquo;ll email a quick code to this address to confirm it&rsquo;s you.
        Questions about the gift? Just reply and it goes to ${gifter}.
      </p>
    </div>
  `;

  return {
    subject: `${gifterFirst} sent you DIY tote rack plans`,
    // A From display name must not carry address punctuation.
    senderName: `${gifterFirst.replace(/[,;:()[\]]/g, "").trim() || "A friend"} via Storage Network`,
    html: masterEmailLayout("A gift for you", body),
  };
}

export async function sendGiftRecipientEmail(p: GiftRecipientEmail): Promise<SendEmailResult> {
  const { subject, html, senderName } = giftRecipientEmailContent(p);
  return sendTransactionalEmail({
    to: p.to,
    toName: p.recipientName,
    subject,
    html,
    senderName,
    replyTo: p.gifterEmail,
  });
}

export interface GiftReceiptEmail {
  to: string;
  gifterName: string;
  orderId: string;
  manageToken: string;
  amountCents: number;
  recipients: { name: string; email: string; sent: boolean }[];
}

export function giftReceiptEmailContent(p: GiftReceiptEmail): { subject: string; html: string } {
  const appUrl = getAppUrl();
  const manageUrl = `${appUrl}${giftManagePath(p.manageToken)}`;
  const count = p.recipients.length;
  const failed = p.recipients.filter((r) => !r.sent).length;
  const plural = count === 1 ? "gift" : "gifts";

  const rows = p.recipients
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 0;border-top:1px solid #1e1e1e;">
          <p style="margin:0;color:#fff;font-size:14px;font-weight:700;">${escapeHtml(r.name)}</p>
          <p style="margin:2px 0 0;color:#888;font-size:12px;">${escapeHtml(r.email)}</p>
        </td>
        <td style="padding:10px 0;border-top:1px solid #1e1e1e;text-align:right;white-space:nowrap;">
          ${
            r.sent
              ? `<span style="color:#6ee7b7;font-size:12px;font-weight:700;">Emailed</span>`
              : `<span style="color:#fca5a5;font-size:12px;font-weight:700;">Not delivered yet</span>`
          }
        </td>
      </tr>`
    )
    .join("");

  const failedNote = failed
    ? `
    <div style="background:#2a0f0f;border:1px solid #7f1d1d;border-radius:8px;padding:14px 20px;margin-bottom:20px;">
      <p style="margin:0;color:#fecaca;font-size:13px;line-height:1.6;">
        ${failed === 1 ? "One email" : `${failed} emails`} didn&rsquo;t go out. Open your gift page to check the address, resend it,
        or copy their link and text it to them.
      </p>
    </div>`
    : "";

  const body = `
    ${preheader(`Your ${plural} ${count === 1 ? "is" : "are"} on the way. Here's how to make sure ${count === 1 ? "it lands" : "they land"}.`)}
    <div style="background:#111;border-radius:12px;padding:24px;margin-bottom:20px;border:1px solid #222;">
      <p style="margin:0 0 6px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Thank you, ${escapeHtml(firstNameOf(p.gifterName) || p.gifterName)}</p>
      <h2 style="margin:0 0 4px;color:#fff;font-size:20px;font-weight:800;">${failed ? `${count} DIY plan ${plural}` : `${count} DIY plan ${plural} sent`}</h2>
      <p style="margin:0 0 14px;color:#888;font-size:12px;">Order ${giftOrderRef(p.orderId)} &middot; ${giftPriceLabel(p.amountCents)} paid</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    </div>

    ${failedNote}

    <div style="background:#1f1a05;border:1px solid #4d3f0a;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 8px;color:#facc15;font-size:14px;font-weight:800;">Please give them a heads-up</p>
      <p style="margin:0 0 8px;color:#e5e5e5;font-size:13px;line-height:1.6;">
        They aren&rsquo;t expecting an email from us, so it can land in spam or Promotions, or simply go unread.
        Send a quick text or call so they know to look for it:
      </p>
      <p style="margin:0 0 8px;color:#fff;font-size:13px;line-height:1.6;background:#0a0a0a;border-radius:6px;padding:10px 12px;">
        &ldquo;I got you DIY tote rack plans! Look for an email from <strong>${GIFT_SENDER_ADDRESS}</strong> (check spam/Promotions).&rdquo;
      </p>
      <p style="margin:0;color:#aaa;font-size:12px;line-height:1.6;">
        Haven&rsquo;t heard back in a day or two? Follow up. From your gift page you can resend their email, fix a mistyped
        address (before they open it), or copy their personal link to text it directly.
      </p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${manageUrl}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:10px;">
        Manage my gifts &rarr;
      </a>
      <p style="margin:10px 0 0;color:#666;font-size:11px;">Keep this email: the button is your way back to the gift page.</p>
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px 20px;">
      <p style="margin:0;color:#666;font-size:12px;line-height:1.6;">
        Digital plans are delivered the moment payment is confirmed, so <strong style="color:#999;">all sales are final</strong>.
        If an email bounces or the address was wrong, we&rsquo;ll help you get the gift to the right person.
        Just reply to this email.
      </p>
    </div>
  `;

  return {
    subject: `Your DIY plan ${plural} ${count === 1 ? "is" : "are"} on the way (${giftOrderRef(p.orderId)})`,
    html: masterEmailLayout(`${count === 1 ? "Gift" : "Gifts"} sent`, body),
  };
}

export async function sendGiftReceiptEmail(p: GiftReceiptEmail): Promise<SendEmailResult> {
  const { subject, html } = giftReceiptEmailContent(p);
  // Replies (wrong address, bounce) go to support, not the no-reply sender.
  return sendTransactionalEmail({ to: p.to, toName: p.gifterName, subject, html, replyTo: CONTACT_EMAIL });
}
