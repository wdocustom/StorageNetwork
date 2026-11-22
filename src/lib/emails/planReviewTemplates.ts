import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import { CONTACT_EMAIL } from "@/lib/plan-library";
import { FRIEND_DISCOUNT_CENTS, friendPath } from "@/lib/plan-friend";
import { formatPlanPrice } from "@/lib/tote-plans";

// ═══════════════════════════════════════════════════════════════════════════
// DIY plan review emails: the ask (7 days after purchase), one reminder, and
// the admin heads-up when a 1–3★ review is held for approval.
// ═══════════════════════════════════════════════════════════════════════════

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function planReviewUrl(accessToken: string): string {
  return `${getAppUrl()}/plans/build?token=${encodeURIComponent(accessToken)}&review=1`;
}

export interface PlanReviewRequestData {
  accessToken: string;
  designName: string;
  customerName?: string | null;
  reminder?: boolean;
  /** Their share code: friends and family get $3 off through it */
  friendCode?: string | null;
}

/** "Share your plans" block: their link, plus text / email / Facebook buttons. */
function shareBlock(friendCode: string): string {
  const link = `${getAppUrl()}${friendPath(friendCode)}`;
  const off = formatPlanPrice(FRIEND_DISCOUNT_CENTS);
  const message = `I built my tote rack with these plans. Use my link for ${off} off yours: ${link}`;
  const btn = (href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;margin:4px;background:#1f1f1f;border:1px solid #333;color:#fff;font-weight:700;font-size:13px;text-decoration:none;padding:10px 16px;border-radius:999px;">${label}</a>`;
  return `
    <div style="background:#0f1a12;border-radius:12px;padding:24px;margin-bottom:20px;border:1px solid #1f3a26;text-align:center;">
      <p style="margin:0 0 6px;color:#4ade80;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Share your plans</p>
      <h2 style="margin:0 0 8px;color:#fff;font-size:19px;font-weight:800;">Know someone who needs one? They get ${off} off.</h2>
      <p style="margin:0 0 16px;color:#a3a3a3;font-size:14px;line-height:1.6;">
        Send friends and family your link. They design their own rack and get ${off} off their plans.
      </p>
      <div style="margin:0 auto 14px;max-width:420px;background:#000;border:1px dashed #3f6b4a;border-radius:10px;padding:12px 14px;">
        <a href="${link}" style="color:#facc15;font-size:15px;font-weight:700;text-decoration:none;word-break:break-all;">${link.replace(/^https?:\/\//, "")}</a>
      </div>
      <div>
        ${btn(`sms:?&body=${encodeURIComponent(message)}`, "Text it")}
        ${btn(`mailto:?subject=${encodeURIComponent(`${off} off tote rack plans`)}&body=${encodeURIComponent(message)}`, "Email it")}
        ${btn(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, "Share on Facebook")}
      </div>
    </div>`;
}

/** The review ask (and its reminder), as HTML. Exported for previews. */
export function planReviewRequestHtml(data: PlanReviewRequestData): string {
  const url = planReviewUrl(data.accessToken);
  const first = esc((data.customerName ?? "").trim().split(/\s+/)[0] || "there");
  const design = esc(data.designName);
  const star = (n: number) =>
    `<a href="${url}&stars=${n}" style="text-decoration:none;font-size:30px;line-height:1;color:#facc15;padding:0 2px;" aria-label="${n} star${n > 1 ? "s" : ""}">&#9733;</a>`;

  const body = `
    <p style="margin:0 0 8px;color:#fff;font-size:16px;">Hi ${first},</p>
    <p style="margin:0 0 20px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      ${
        data.reminder
          ? `Quick reminder: if your ${design} is built (or close), we&rsquo;d love to hear how it went.`
          : `How did your ${design} build go? Whether it&rsquo;s finished or still in progress, a short review helps the next builder decide, and tells us what to improve.`
      }
    </p>

    <div style="background:#111;border-radius:12px;padding:24px;margin-bottom:20px;border:1px solid #222;text-align:center;">
      <p style="margin:0 0 12px;color:#fff;font-size:15px;font-weight:700;">Tap a star to start</p>
      <div style="margin:0 0 16px;">${[1, 2, 3, 4, 5].map(star).join("")}</div>
      <a href="${url}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;">
        Review my plans
      </a>
      <p style="margin:14px 0 0;color:#888;font-size:12px;">Takes about a minute. A photo of your finished rack helps other builders most.</p>
    </div>

    ${data.friendCode ? shareBlock(data.friendCode) : ""}

    <p style="margin:0;color:#777;font-size:12px;line-height:1.6;text-align:center;">
      Something not right with your plans? Reply to this email or write to
      <a href="mailto:${CONTACT_EMAIL}" style="color:#facc15;">${CONTACT_EMAIL}</a> and we&rsquo;ll help.
    </p>
  `;
  return masterEmailLayout("How did your build go?", body);
}

export async function sendPlanReviewRequestEmail(email: string, data: PlanReviewRequestData): Promise<SendEmailResult> {
  return sendTransactionalEmail({
    to: email,
    subject: data.reminder ? `How did your ${data.designName} turn out?` : `How did your ${data.designName} build go?`,
    html: planReviewRequestHtml(data),
  });
}

export async function sendPlanReviewHeldEmail(data: {
  rating: number;
  product: string;
  customerName: string;
  email: string;
  headline: string | null;
  comment: string | null;
  photos: number;
}): Promise<SendEmailResult> {
  const url = `${getAppUrl()}/dashboard/admin/plan-reviews`;
  const body = `
    <p style="margin:0 0 12px;color:#fff;font-size:16px;">A ${data.rating}&#9733; plan review is waiting for you.</p>
    <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #222;">
      <p style="margin:0 0 6px;color:#facc15;font-size:20px;">${"&#9733;".repeat(data.rating)}${"&#9734;".repeat(5 - data.rating)}</p>
      <p style="margin:0 0 4px;color:#fff;font-size:14px;font-weight:700;">${esc(data.headline ?? "(no headline)")}</p>
      <p style="margin:0 0 12px;color:#bbb;font-size:13px;line-height:1.6;white-space:pre-line;">${esc(data.comment ?? "(no comment)")}</p>
      <p style="margin:0;color:#888;font-size:12px;">
        ${esc(data.customerName)} &middot; <a href="mailto:${esc(data.email)}" style="color:#facc15;">${esc(data.email)}</a>
        &middot; ${esc(data.product)}${data.photos ? ` &middot; ${data.photos} photo${data.photos > 1 ? "s" : ""}` : ""}
      </p>
    </div>
    <p style="margin:0 0 20px;color:#a3a3a3;font-size:14px;line-height:1.6;">
      It isn&rsquo;t public yet. Reach out to help them first if you like, then publish it, reply to it, or hide it.
    </p>
    <div style="text-align:center;">
      <a href="${url}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:10px;">Open plan reviews</a>
    </div>
  `;
  return sendTransactionalEmail({
    to: CONTACT_EMAIL,
    subject: `${data.rating}★ plan review held: ${data.headline ?? data.customerName}`,
    html: masterEmailLayout("Plan review held", body),
  });
}
