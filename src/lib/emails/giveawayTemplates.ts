import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { escapeHtml } from "./giftTemplates";
import { getAppUrl } from "@/lib/url-helper";
import { REFUND_GIVEAWAY, formatGiveawayDate } from "@/lib/refund-giveaway";

// ═══════════════════════════════════════════════════════════════════════════
// Holiday Full Refund Giveaway: the winner's email, sent when their prize is
// issued (the rules promise notice at the time of the refund).
//   • refund: their order was refunded; they keep the plans
//   • plans_account: a free-entry winner with no purchase gets lifetime plans
// Plain and specific (amount, day, where the money goes), one button.
// ═══════════════════════════════════════════════════════════════════════════

export interface GiveawayWinnerEmail {
  to: string;
  name: string | null;
  prize: "refund" | "plans_account";
  drawDate: string;
  amountCents: number | null;
  accessToken: string | null;
}

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

function firstName(name: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? escapeHtml(first) : "there";
}

export function giveawayWinnerEmailContent(p: GiveawayWinnerEmail): { subject: string; html: string } {
  const appUrl = getAppUrl();
  const day = formatGiveawayDate(p.drawDate);
  const libraryUrl = p.accessToken ? `${appUrl}/plans/library?token=${p.accessToken}` : null;
  const rulesUrl = `${appUrl}${REFUND_GIVEAWAY.rulesPath}`;
  const contact = REFUND_GIVEAWAY.contactEmail ?? REFUND_GIVEAWAY.entryEmail;
  const refund = p.prize === "refund";
  const amount = p.amountCents != null ? money(p.amountCents) : "your purchase";

  const headline = refund ? `You won! Your ${amount} is on its way back.` : "You won lifetime DIY tote rack plans!";
  const lead = refund
    ? `Your plans order was drawn in the ${escapeHtml(REFUND_GIVEAWAY.name)} for ${escapeHtml(day)}. We&rsquo;ve refunded
       <strong style="color:#fff;">${escapeHtml(amount)}</strong> to your original payment method. Your bank or card issuer may
       take a few business days to show it. You keep your plans: nothing else changes.`
    : `Your free entry was drawn in the ${escapeHtml(REFUND_GIVEAWAY.name)} for ${escapeHtml(day)}. Your prize is a lifetime DIY
       plans account: design a tote rack sized to your own wall, then build it with the 3D guide and a printable cut list.
       Every size you design is included.`;

  const button = libraryUrl
    ? `
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${libraryUrl}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;">
        ${refund ? "Open my plans" : "Open my plans account"} &rarr;
      </a>
      <p style="margin:12px 0 0;color:#666;font-size:12px;">This link is yours, so keep this email.</p>
    </div>`
    : "";

  const preview = refund ? `Your ${amount} plans purchase has been refunded. You keep the plans.` : "Your free lifetime plans account is ready.";

  const body = `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(preview)}</div>
    <div style="background:#111;border-radius:12px;padding:28px 24px;margin-bottom:20px;border:1px solid #222;">
      <p style="margin:0 0 6px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">${escapeHtml(REFUND_GIVEAWAY.name)}</p>
      <h2 style="margin:0 0 10px;color:#fff;font-size:21px;font-weight:800;line-height:1.3;">Hi ${firstName(p.name)}. ${escapeHtml(headline)}</h2>
      <p style="margin:0;color:#aaa;font-size:14px;line-height:1.6;">${lead}</p>
    </div>
    ${button}
    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px 20px;">
      <p style="margin:0;color:#777;font-size:12px;line-height:1.6;">
        Questions? Just reply, or email <a href="mailto:${contact}" style="color:#facc15;text-decoration:none;">${contact}</a>.
        <a href="${rulesUrl}" style="color:#888;">Official Rules</a>
      </p>
    </div>
  `;

  return {
    subject: refund ? `You won: your ${amount} plans purchase is refunded` : "You won lifetime DIY tote rack plans",
    html: masterEmailLayout("You won!", body),
  };
}

export async function sendGiveawayWinnerEmail(p: GiveawayWinnerEmail): Promise<SendEmailResult> {
  const { subject, html } = giveawayWinnerEmailContent(p);
  return sendTransactionalEmail({
    to: p.to,
    toName: p.name ?? undefined,
    subject,
    html,
    replyTo: REFUND_GIVEAWAY.contactEmail ?? REFUND_GIVEAWAY.entryEmail,
  });
}
