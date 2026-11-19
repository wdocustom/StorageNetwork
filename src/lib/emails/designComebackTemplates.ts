import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { escapeHtml } from "./giftTemplates";
import { getAppUrl } from "@/lib/url-helper";
import { LADDER_JIG_NAME, LADDER_JIG_PRICE } from "@/lib/ladder-jig";
import { REFUND_GIVEAWAY, giveawayStatus } from "@/lib/refund-giveaway";
import {
  TOTE_PLAN_ALL_ACCESS,
  formatPlanPrice,
  totePlanName,
  totePlanSummary,
  type TotePlanDesign,
} from "@/lib/tote-plans";

// ═══════════════════════════════════════════════════════════════════════════
// Come-back email to people who emailed themselves a design but never
// bought: their design, the price they saved it at ($14 or $16), and the
// Ladder Building Jig plans free with it. While the Holiday Full Refund
// Giveaway runs, a short note about it (with "No purchase necessary" and the
// rules link, as the rules require). One button, back to their design.
// ═══════════════════════════════════════════════════════════════════════════

export interface DesignComebackEmail {
  design: TotePlanDesign;
  /** The design link with the come-back offer applied */
  link: string;
  priceCents: number;
}

const money = (cents: number) => formatPlanPrice(cents);

const TOTE_INCLUDES = [
  "Interactive 3D build guide: rotate, zoom and step through every cut",
  "Printable PDF with the shopping list and cut diagrams",
  "A free plan for every tote rack you design after this one, for life",
];

const JIG_INCLUDES = [
  "Every ladder frame comes out square and identical",
  "Rail marks built in: no measuring each rung",
  "Made from one sheet of OSB and three 2×4s",
];

const check = (text: string) => `
  <div style="margin-bottom:8px;">
    <span style="color:#facc15;font-size:12px;">&#10003;</span>
    <span style="color:#ccc;font-size:13px;margin-left:6px;">${escapeHtml(text)}</span>
  </div>`;

export function designComebackEmailContent(p: DesignComebackEmail, now: Date = new Date()): { subject: string; html: string } {
  const appUrl = getAppUrl();
  const name = totePlanName(p.design);
  const price = money(p.priceCents);
  const regular = money(TOTE_PLAN_ALL_ACCESS.price);
  const jigValue = money(LADDER_JIG_PRICE);
  const holiday = giveawayStatus(now) === "active";

  const holidayNote = holiday
    ? `
    <div style="background:#1a1606;border:1px solid #3d3410;border-radius:10px;padding:16px 18px;margin-bottom:20px;">
      <p style="margin:0 0 4px;color:#facc15;font-size:13px;font-weight:800;">&#127873; Holiday surprise</p>
      <p style="margin:0;color:#d4d4d4;font-size:13px;line-height:1.6;">
        Several random buyers get a <strong style="color:#fff;">full refund</strong>, every day, and they keep their plans.
        <span style="color:#888;">No purchase necessary.</span>
        <a href="${appUrl}${REFUND_GIVEAWAY.rulesPath}" style="color:#facc15;">Official Rules</a>
      </p>
    </div>`
    : "";

  const body = `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(
      `Still ${price}, the price you saved it at, plus our ${LADDER_JIG_NAME} plans free.`
    )}</div>

    <p style="margin:0 0 8px;color:#fff;font-size:16px;">Hi there,</p>
    <p style="margin:0 0 20px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      You saved this tote rack design a little while ago. It&rsquo;s still here at the price you saved it at, and
      we&rsquo;ve added something to make the build easier: our ${escapeHtml(LADDER_JIG_NAME)} plans, free.
    </p>

    <div style="background:#111;border:1px solid #222;border-radius:12px;padding:22px 18px;margin:0 0 20px;text-align:center;">
      <p style="margin:0 0 4px;color:#fff;font-size:18px;font-weight:800;">${escapeHtml(name)}</p>
      <p style="margin:0 0 16px;color:#888;font-size:13px;">${escapeHtml(totePlanSummary(p.design))}</p>
      <p style="margin:0 0 4px;color:#facc15;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Your price</p>
      <p style="margin:0 0 6px;color:#fff;font-size:30px;font-weight:900;">
        ${price} <span style="color:#666;font-size:16px;font-weight:600;text-decoration:line-through;">${regular}</span>
      </p>
      <p style="margin:0 0 18px;color:#4ade80;font-size:13px;font-weight:700;">+ ${escapeHtml(LADDER_JIG_NAME)} plans free (${jigValue} value)</p>
      <a href="${p.link}" style="display:inline-block;background:#facc15;color:#000;font-size:15px;font-weight:800;padding:14px 28px;border-radius:10px;text-decoration:none;">
        Get my plans &mdash; ${price} &rarr;
      </a>
      <p style="margin:12px 0 0;color:#666;font-size:12px;">Opens your exact design with this price applied.</p>
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:16px 20px;margin-bottom:14px;">
      <p style="margin:0 0 10px;color:#666;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Your tote rack plans</p>
      ${TOTE_INCLUDES.map(check).join("")}
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 10px;color:#666;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Free with them: ${escapeHtml(
        LADDER_JIG_NAME
      )}</p>
      ${JIG_INCLUDES.map(check).join("")}
      <p style="margin:6px 0 0;color:#777;font-size:12px;line-height:1.5;">Printable step-by-step PDF. Its link arrives in its own email when you buy.</p>
    </div>

    ${holidayNote}

    <p style="margin:0;color:#555;font-size:11px;line-height:1.6;text-align:center;">
      You&rsquo;re getting this because you emailed yourself a design at storage-network.app. This is the only reminder
      we&rsquo;ll send about it. Questions? Just reply.<br />
      Storage-Network.app &middot; Omaha, Nebraska
    </p>
  `;

  return {
    subject: `Your ${name} design: still ${price}, plus free jig plans`,
    html: masterEmailLayout("Your Tote Rack Design", body),
  };
}

export async function sendDesignComebackEmail(to: string, p: DesignComebackEmail): Promise<SendEmailResult> {
  const { subject, html } = designComebackEmailContent(p);
  return sendTransactionalEmail({
    to,
    subject,
    html,
    replyTo: REFUND_GIVEAWAY.contactEmail ?? undefined,
  });
}
