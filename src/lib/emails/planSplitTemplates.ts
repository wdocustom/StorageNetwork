import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import { formatPlanPrice } from "@/lib/tote-plans";
import { PLAN_SPLIT_TOTAL_CENTS } from "@/lib/plan-splits";
import { CONTACT_EMAIL } from "@/lib/plan-library";

// ═══════════════════════════════════════════════════════════════════════════
// DIY plan-sale split — "you just earned" email to the installer
//
// Sent once per paid split (webhook payout or owner retry), never for a
// failed one. Explains why they earned it — a customer they referred
// chose DIY plans, or a plan included their bestseller — and why the
// network shares plan sales at all.
// ═══════════════════════════════════════════════════════════════════════════

function eyebrow(text: string): string {
  return `<p style="margin:0 0 12px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${text}</p>`;
}

function ctaButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background-color:#facc15;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">${label}</a>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export interface PlanSplitEmailData {
  /** First name or business name */
  name: string;
  cents: number;
  reason: "referral" | "bestseller";
  /** Display names of the recipient's bestsellers in the plan */
  bestsellerNames: string[];
  /** "PDF Build Plan" / "Interactive Build Guide" */
  productName?: string;
  /** True when other installers' bestsellers shared this sale's $5 */
  shared?: boolean;
}

export function planSplitEmailContent(data: PlanSplitEmailData): { subject: string; html: string } {
  const amount = formatPlanPrice(data.cents);
  const total = formatPlanPrice(PLAN_SPLIT_TOTAL_CENTS);
  const name = escapeHtml(data.name);
  const designs = escapeHtml(listNames(data.bestsellerNames));
  const appUrl = getAppUrl();

  const subject =
    data.reason === "referral"
      ? `You just earned ${amount} from a DIY plan sale`
      : `Your ${listNames(data.bestsellerNames)} ${data.bestsellerNames.length > 1 ? "designs" : "design"} just earned you ${amount}`;

  const lead =
    data.reason === "referral"
      ? `A customer who found Storage Network through you decided to build it themselves and bought DIY build plans from your link. That job didn&rsquo;t walk away from you &mdash; part of the sale comes straight back to you.`
      : `Someone just bought DIY build plans that include <strong style="color:#ffffff;">${designs}</strong>, ${data.bestsellerNames.length > 1 ? "designs" : "a design"} you brought to the network. Every plan built from your bestseller pays you a share.`;

  const why =
    data.reason === "referral"
      ? `When a customer you sent chooses to DIY, the installer who brought them shouldn&rsquo;t be left out. So up to ${total} of every DIY plan sale goes back to the installer who referred the customer.`
      : `Bestsellers like yours are what make the plans worth buying. So when a plan includes your design, up to ${total} of the sale goes back to you${data.shared ? " &mdash; shared equally when a plan includes bestsellers from more than one installer" : ""}.`;

  const html = masterEmailLayout(
    "You earned a DIY plan split",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Nice work, ${name}.</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">${lead}</p>

    <div style="border:1px solid #222;border-radius:12px;padding:24px;margin:0 0 28px;text-align:center;">
      ${eyebrow("Your share")}
      <p style="margin:0 0 6px;color:#facc15;font-size:36px;font-weight:900;line-height:1;">${amount}</p>
      <p style="margin:0;color:#a3a3a3;font-size:13px;">
        Sent to your Stripe account${data.productName ? ` &middot; from ${/^[aeiou]/i.test(data.productName) ? "an" : "a"} ${escapeHtml(data.productName)} sale` : ""}
      </p>
    </div>

    ${eyebrow("Why we do this")}
    <p style="margin:0 0 12px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      Storage Network is built by installers, for installers. ${why}
    </p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      It&rsquo;s our way of giving back to the people who build this network &mdash; you earn even when the customer picks up the tools themselves.
    </p>

    <div style="text-align:center;margin:0 0 20px;">
      ${ctaButton(`${appUrl}/plans`, "See the DIY Plans")}
    </div>
    <p style="margin:0 0 24px;color:#737373;font-size:13px;text-align:center;">
      Track every split in <a href="${appUrl}/dashboard/profile?tab=account" style="color:#facc15;text-decoration:none;">your account &rarr; DIY Plan Earnings</a>.
    </p>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      The transfer reaches your bank on your normal Stripe payout schedule. Questions? Just reply to this email.
    </p>
    `,
  );

  return { subject, html };
}

export async function sendPlanSplitEarnedEmail(email: string, data: PlanSplitEmailData): Promise<SendEmailResult> {
  const { subject, html } = planSplitEmailContent(data);
  // "Questions? Just reply" should reach a person, not the sender inbox
  return sendTransactionalEmail({ to: email, toName: data.name, subject, html, replyTo: CONTACT_EMAIL });
}
