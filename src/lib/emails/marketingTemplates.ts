import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import { siteConfig } from "@/config/site";
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

// The CTA is an IMAGE on purpose. Gmail's dark mode (Android app) recolors
// "dark text on a light button" to white — it flipped black text AND a black
// border to white on this exact button — and no CSS stops it. Gmail never
// recolors images, so the label is baked into a PNG (public/email/). The cell
// keeps the yellow bgcolor and the alt text is styled black, so with images
// blocked the button still reads as a yellow button with its label.
const CTA_LABEL = "Get Organized \u2014 Order Another Rack";
const CTA_IMAGE_PATH = "/email/cta-order-another-rack.png";

function imageButton(url: string): string {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;width:100%;max-width:450px;">
      <tr>
        <td align="center" bgcolor="#facc15" style="background-color:#facc15;border-radius:12px;">
          <a href="${url}" target="_blank" style="display:block;text-decoration:none;">
            <img src="${getAppUrl()}${CTA_IMAGE_PATH}" alt="${CTA_LABEL}" width="450" style="display:block;width:100%;max-width:450px;height:auto;border:0;border-radius:12px;font-family:${font};font-size:17px;font-weight:800;line-height:1.3;color:#000000;text-align:center;padding:0;" />
          </a>
        </td>
      </tr>
    </table>`;
}

export function buildRepeatOrderEmail(input: RepeatOrderEmailInput): {
  subject: string;
  html: string;
} {
  const { bookUrl, unsubUrl } = repeatOrderUrls(input);
  const firstName = input.customerName?.trim().split(/\s+/)[0] || "there";
  const installer = escapeHtml(input.installerName);

  const check = `<span style="color:#facc15;font-weight:800;margin-right:8px;">&#10003;</span>`;
  const bullet = (text: string) =>
    `<tr><td style="padding:12px 0;border-bottom:1px solid #222;color:#ffffff;font-size:15px;line-height:1.6;">${check}${text}</td></tr>`;

  const html = masterEmailLayout(
    "Get Organized for the Holidays",
    `
    <!-- Preheader (inbox preview text) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#000000;font-size:1px;line-height:1px;">
      Another rack means a home for every holiday bin. Your details are already filled in &mdash; order in minutes.
      &#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;
    </div>

    <p style="margin:0 0 16px;color:#ffffff;font-size:17px;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px;color:#d4d4d4;font-size:16px;line-height:1.7;">
      The holidays are right around the corner &mdash; decorations to store, gifts to stash,
      guests on the way. The best time to get your space under control is
      <strong style="color:#ffffff;">before</strong> the season gets busy.
    </p>
    <p style="margin:0 0 24px;color:#d4d4d4;font-size:16px;line-height:1.7;">
      You already know how good a custom tote rack feels. ${installer}, the installer who built
      yours, can build another &mdash; sized to your space and ready for the season.
    </p>

    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 30px;">
      ${bullet("A home for every holiday bin, wreath box and gift overflow")}
      ${bullet(`Your details and past order are already filled in &mdash; order in a couple of minutes`)}
      ${bullet("See your price up front, then reserve your install date with a deposit")}
    </table>

    <div style="text-align:center;margin:0 0 12px;">
      ${imageButton(bookUrl)}
    </div>
    <p style="margin:0 0 8px;text-align:center;color:#a3a3a3;font-size:13px;">
      Built and installed by ${installer}
    </p>

    <div style="border-top:1px solid #222;margin-top:32px;padding-top:18px;text-align:center;">
      <p style="margin:0 0 4px;color:#737373;font-size:11px;line-height:1.6;">
        You&rsquo;re receiving this because you ordered a rack through Storage Network.
        <a href="${unsubUrl}" style="color:#facc15;text-decoration:underline;">Unsubscribe from promotional emails</a>
        &mdash; order updates, receipts and tracking emails are not affected.
      </p>
      <p style="margin:0;color:#737373;font-size:11px;">
        Storage Network &middot; ${escapeHtml(siteConfig.mailingAddress)}
      </p>
    </div>
    `
  );

  return {
    subject: `Get organized before the holidays \u2014 ${input.installerName} can build another rack`,
    html,
  };
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
