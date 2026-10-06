import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import { escapeHtml } from "@/utils/escapeHtml";

// ═══════════════════════════════════════════════════════════════════════════
// Platform marketing emails (promotional, sent by Storage Network itself).
//
// Unlike transactional email, these carry an unsubscribe link scoped to
// PROMOTIONAL email only (customer_marketing_optouts) — opting out never
// touches receipts, scheduling, tracking or balance emails for any order.
// ═══════════════════════════════════════════════════════════════════════════

export interface RepeatOrderEmailInput {
  customerName: string | null;
  installerName: string;
  installerId: string;
  /** marketing_email_sends.id — attribution token + unsubscribe token. */
  sendId: string;
}

export function repeatOrderUrls(input: Pick<RepeatOrderEmailInput, "installerId" | "sendId">) {
  const base = getAppUrl();
  return {
    bookUrl: `${base}/book/${input.installerId}?mc=${input.sendId}`,
    unsubUrl: `${base}/api/unsubscribe-marketing?token=${input.sendId}`,
  };
}

export function buildRepeatOrderEmail(input: RepeatOrderEmailInput): {
  subject: string;
  html: string;
} {
  const { bookUrl, unsubUrl } = repeatOrderUrls(input);
  const firstName = input.customerName?.trim().split(/\s+/)[0] || "there";
  const installer = escapeHtml(input.installerName);

  const html = masterEmailLayout(
    "Room for another rack?",
    `
    <p style="margin:0 0 16px;color:#ffffff;font-size:16px;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Thanks again for ordering your storage rack through Storage Network.
      If there&rsquo;s another garage, basement or closet that could use the same
      treatment, ${installer} &mdash; the installer who built your first one &mdash;
      can do it again.
    </p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Design your next rack in a few minutes, see your price up front, and
      reserve your install date with a deposit.
    </p>
    <div style="text-align:center;margin:0 0 32px;">
      <a href="${bookUrl}" style="display:inline-block;background-color:#facc15;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Order another rack from ${installer}</a>
    </div>

    <div style="border-top:1px solid #222;margin-top:32px;padding-top:18px;text-align:center;">
      <p style="margin:0 0 4px;color:#555;font-size:11px;">
        You&rsquo;re receiving this because you ordered a rack through Storage Network.
        <a href="${unsubUrl}" style="color:#facc15;text-decoration:underline;">Unsubscribe from promotional emails</a>
        &mdash; order updates, receipts and tracking emails are not affected.
      </p>
      <p style="margin:0;color:#555;font-size:11px;">
        Storage Network &middot; 1100 Williams Way, Westerville, OH 43082
      </p>
    </div>
    `
  );

  return { subject: `Need another rack? ${input.installerName} can build it`, html };
}

export async function sendRepeatOrderEmail(
  to: string,
  input: RepeatOrderEmailInput,
  opts: { subjectPrefix?: string } = {}
): Promise<SendEmailResult> {
  const { subject, html } = buildRepeatOrderEmail(input);
  const { unsubUrl } = repeatOrderUrls(input);
  return sendTransactionalEmail({
    to,
    toName: input.customerName || undefined,
    subject: `${opts.subjectPrefix ?? ""}${subject}`,
    html,
    // RFC 8058 one-click unsubscribe — the endpoint accepts the POST directly.
    headers: {
      "List-Unsubscribe": `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
