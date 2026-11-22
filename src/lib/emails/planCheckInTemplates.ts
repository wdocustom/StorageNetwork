import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import { CONTACT_EMAIL, libraryHref } from "@/lib/plan-library";

// ═══════════════════════════════════════════════════════════════════════════
// Check-in for plan buyers who haven't opened their plans: "here's your
// link". Stage 1 at 14 days (or sent early by an admin), stage 2 at 30 days.
// Never accusing: some buyers came back to the site and couldn't find them.
// ═══════════════════════════════════════════════════════════════════════════

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface PlanCheckInData {
  accessToken: string;
  designName: string;
  customerName?: string | null;
  /** 1: first check-in (14 days); 2: last one (30 days) */
  stage: 1 | 2;
}

export function planCheckInSubject(d: Pick<PlanCheckInData, "designName" | "stage">): string {
  return d.stage === 1 ? `Your ${d.designName} plans: here's your link` : `Still planning your build? Your ${d.designName} plans are waiting`;
}

export function planCheckInHtml(d: PlanCheckInData): string {
  const app = getAppUrl();
  const planUrl = `${app}/plans/build?token=${encodeURIComponent(d.accessToken)}`;
  const libraryUrl = `${app}${libraryHref(d.accessToken)}`;
  const first = esc((d.customerName ?? "").trim().split(/\s+/)[0] || "there");
  const design = esc(d.designName);
  const item = (title: string, text: string) => `
    <tr>
      <td style="padding:0 10px 10px 0;vertical-align:top;color:#facc15;font-size:15px;">&#10003;</td>
      <td style="padding:0 0 10px;color:#a3a3a3;font-size:14px;line-height:1.5;"><strong style="color:#fff;">${title}</strong> ${text}</td>
    </tr>`;

  const intro =
    d.stage === 1
      ? `Just making sure you have your <strong style="color:#fff;">${design}</strong> plans. Here&rsquo;s your permanent link: it works any time, on any device.`
      : `Whenever you&rsquo;re ready to build, your <strong style="color:#fff;">${design}</strong> plans are right where you left them. They never expire.`;

  const body = `
    <p style="margin:0 0 8px;color:#fff;font-size:16px;">Hi ${first},</p>
    <p style="margin:0 0 22px;color:#a3a3a3;font-size:15px;line-height:1.7;">${intro}</p>

    <div style="text-align:center;margin:0 0 24px;">
      <a href="${planUrl}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:16px;text-decoration:none;padding:15px 36px;border-radius:10px;">
        Open my plans
      </a>
      <p style="margin:12px 0 0;color:#888;font-size:12px;">Save this email so your link is always one tap away.</p>
    </div>

    <div style="background:#111;border-radius:12px;padding:20px 22px;margin-bottom:20px;border:1px solid #222;">
      <p style="margin:0 0 12px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">What&rsquo;s inside</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${item("Shopping list", "everything to buy, ready to take to the store.")}
        ${item("Cut list", "every board and length, so you cut once.")}
        ${item("3D build guide", "every step in 3D: rotate it, zoom in, tap a piece to see what it is.")}
        ${item("Printable PDF", "for the garage, no phone needed.")}
      </table>
    </div>

    <div style="background:#111;border-radius:12px;padding:18px 22px;margin-bottom:20px;border:1px solid #222;">
      <p style="margin:0 0 6px;color:#fff;font-size:14px;font-weight:700;">Opening it on a new phone or computer?</p>
      <p style="margin:0;color:#a3a3a3;font-size:13px;line-height:1.6;">
        We&rsquo;ll email a 6-digit code to this address to confirm it&rsquo;s you, so your plans stay yours.
        All your plans are also under <a href="${libraryUrl}" style="color:#facc15;">My Builds</a>.
      </p>
    </div>

    <p style="margin:0;color:#777;font-size:12px;line-height:1.6;text-align:center;">
      ${d.stage === 1 ? "Trouble opening your plans, or questions before you start?" : "Questions before you start?"}
      Reply to this email or write to <a href="mailto:${CONTACT_EMAIL}" style="color:#facc15;">${CONTACT_EMAIL}</a> and we&rsquo;ll help.
    </p>
  `;
  return masterEmailLayout(d.stage === 1 ? "Your plans are ready" : "Your plans are waiting", body);
}

export async function sendPlanCheckInEmail(email: string, d: PlanCheckInData): Promise<SendEmailResult> {
  return sendTransactionalEmail({ to: email, subject: planCheckInSubject(d), html: planCheckInHtml(d) });
}
