import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import type { PublicPlan } from "@/lib/plans-config";
import { LADDER_JIG_NAME, LADDER_JIG_TAGLINE } from "@/lib/ladder-jig";
import {
  TOTE_PLAN_TIERS,
  designFromItems,
  formatPlanPrice,
  totePlanDesignHref,
  totePlanName,
  totePlanSummary,
  type PlanSourceItem,
  type TotePlanDesign,
  type TotePlanTier,
} from "@/lib/tote-plans";

// ═══════════════════════════════════════════════════════════════════════════
// DIY plans footer for build / quote emails
//
// Every pre-purchase email that carries a customer's build (quote, saved
// build, waitlist, abandoned cart, "your installer is ready") ends with a
// small "prefer to build it yourself?" link that opens /plans/checkout with
// that exact design. Post-purchase emails (booking confirmation, receipts)
// deliberately don't — the customer already chose installation.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Absolute plans link for a lead's quote_data, or null if nothing in it is
 * plannable. `referralInstallerId` credits that installer with the
 * plan-sale split (installer-sent quotes only).
 */
export function diyPlansEmailUrl(quoteData: unknown, source: string, referralInstallerId?: string | null): string | null {
  if (!Array.isArray(quoteData) || quoteData.length === 0) return null;
  const { design } = designFromItems(quoteData as PlanSourceItem[]);
  return design ? `${getAppUrl()}${totePlanDesignHref(design, source, referralInstallerId)}` : null;
}

/** Quiet footer block; empty string when there's no link. */
export function diyPlansEmailBlock(url: string | null | undefined): string {
  if (!url) return "";
  return `
    <div style="border-top:1px solid #222;padding:18px 0 6px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 6px;color:#737373;font-size:12px;">Prefer to build it yourself?</p>
      <a href="${url}" style="color:#facc15;font-size:13px;font-weight:700;text-decoration:none;">
        Get DIY build plans for this design &mdash; from ${formatPlanPrice(TOTE_PLAN_TIERS.pdf.price)} &rarr;
      </a>
      <p style="margin:6px 0 0;color:#555;font-size:11px;">Printable PDF or interactive 3D build guide, sized to your build.</p>
    </div>`;
}

export async function sendPlanAccessEmail(
  email: string,
  plan: PublicPlan,
  accessToken: string,
): Promise<void> {
  const appUrl = getAppUrl();
  const accessUrl = `${appUrl}/plans/access?token=${accessToken}`;

  const body = `
    <div style="background:#111;border-radius:12px;padding:28px 24px;margin-bottom:20px;border:1px solid #222;">
      <p style="margin:0 0 6px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Your plans are ready</p>
      <h2 style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:800;">${plan.name}</h2>
      <p style="margin:0;color:#888;font-size:13px;">${plan.tagline}</p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${accessUrl}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
        Open My Build Plans →
      </a>
      <p style="margin:12px 0 0;color:#555;font-size:11px;">Bookmark this link — it's yours permanently.</p>
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 10px;color:#666;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">What's included</p>
      ${plan.includes.map((item) => `
        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
          <span style="color:#facc15;font-size:12px;flex-shrink:0;margin-top:1px;">✓</span>
          <span style="color:#ccc;font-size:13px;">${item}</span>
        </div>`).join("")}
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px 20px;">
      <p style="margin:0;color:#555;font-size:12px;line-height:1.6;">
        <strong style="color:#888;">Lost this email?</strong> Visit
        <a href="${appUrl}/plans" style="color:#facc15;text-decoration:none;">${appUrl.replace(/^https?:\/\//, "")}/plans</a>
        and use &ldquo;Resend my link&rdquo; to get a new copy sent to this address.
      </p>
    </div>
  `;

  await sendTransactionalEmail({
    to: email,
    subject: `Your ${plan.name} build plans`,
    html: masterEmailLayout(`${plan.name} — Build Plans`, body),
  });
}

export async function sendTotePlanAccessEmail(
  email: string,
  design: TotePlanDesign,
  tier: TotePlanTier,
  accessToken: string,
): Promise<void> {
  const appUrl = getAppUrl();
  const accessUrl = `${appUrl}/plans/build?token=${accessToken}`;
  const name = totePlanName(design);
  const info = TOTE_PLAN_TIERS[tier];

  const body = `
    <div style="background:#111;border-radius:12px;padding:28px 24px;margin-bottom:20px;border:1px solid #222;">
      <p style="margin:0 0 6px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">${info.name}</p>
      <h2 style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:800;">${name}</h2>
      <p style="margin:0;color:#888;font-size:13px;">${totePlanSummary(design)}</p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${accessUrl}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
        ${tier === "interactive" ? "Open My Build Guide →" : "Get My Build Plan →"}
      </a>
      <p style="margin:12px 0 0;color:#555;font-size:11px;">Bookmark this link — it's yours permanently.</p>
      <p style="margin:8px 0 0;color:#888;font-size:12px;">All your plans in one place: <a href="${appUrl}/plans/library?token=${accessToken}" style="color:#facc15;text-decoration:none;">My Builds</a></p>
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 10px;color:#666;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">What's included</p>
      ${info.includes.map((item) => `
        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
          <span style="color:#facc15;font-size:12px;flex-shrink:0;margin-top:1px;">✓</span>
          <span style="color:#ccc;font-size:13px;">${item}</span>
        </div>`).join("")}
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px 20px;">
      <p style="margin:0;color:#555;font-size:12px;line-height:1.6;">
        <strong style="color:#888;">Lost this email?</strong> Visit
        <a href="${appUrl}/plans" style="color:#facc15;text-decoration:none;">${appUrl.replace(/^https?:\/\//, "")}/plans</a>
        and use &ldquo;Resend my link&rdquo; to get a new copy sent to this address.
      </p>
    </div>
  `;

  await sendTransactionalEmail({
    to: email,
    subject: `Your ${name} ${tier === "interactive" ? "build guide" : "build plan"}`,
    html: masterEmailLayout(`${name} — ${info.name}`, body),
  });
}

export async function sendLadderJigAccessEmail(email: string, accessToken: string): Promise<void> {
  const appUrl = getAppUrl();
  const accessUrl = `${appUrl}/plans/jig?token=${accessToken}`;
  const libraryUrl = `${appUrl}/plans/library?token=${accessToken}`;

  const body = `
    <div style="background:#111;border-radius:12px;padding:28px 24px;margin-bottom:20px;border:1px solid #222;">
      <p style="margin:0 0 6px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Your plans are ready</p>
      <h2 style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:800;">${LADDER_JIG_NAME}</h2>
      <p style="margin:0;color:#888;font-size:13px;">${LADDER_JIG_TAGLINE}</p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${accessUrl}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
        Open My Jig Plans →
      </a>
      <p style="margin:12px 0 0;color:#555;font-size:11px;">Bookmark this link — it's yours permanently.</p>
    </div>

    <p style="margin:0 0 20px;color:#888;font-size:12px;text-align:center;">
      All your plans in one place: <a href="${libraryUrl}" style="color:#facc15;text-decoration:none;">My Builds</a>
    </p>
  `;

  await sendTransactionalEmail({
    to: email,
    subject: `Your ${LADDER_JIG_NAME} plans`,
    html: masterEmailLayout(`${LADDER_JIG_NAME} — Plans`, body),
  });
}

/**
 * The 6-digit code for opening a buyer's plans on a new device
 * (see @/lib/server/plan-device).
 */
export async function sendPlanDeviceCodeEmail(email: string, code: string): Promise<SendEmailResult> {
  const appUrl = getAppUrl();
  const spaced = `${code.slice(0, 3)}&nbsp;${code.slice(3)}`;

  const body = `
    <p style="margin:0 0 20px;color:#a3a3a3;font-size:15px;line-height:1.7;text-align:center;">
      Someone is opening your Storage Network build plans on a new device.<br/>
      If that&rsquo;s you, enter this code:
    </p>

    <div style="background:#111;border:1px solid #222;border-radius:12px;padding:26px 16px;margin:0 0 20px;text-align:center;">
      <p style="margin:0 0 8px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Your code</p>
      <p style="margin:0;color:#facc15;font-size:40px;font-weight:900;letter-spacing:0.18em;font-family:'SF Mono',Menlo,Consolas,monospace;">${spaced}</p>
      <p style="margin:12px 0 0;color:#666;font-size:12px;">Expires in 15 minutes.</p>
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px 20px;">
      <p style="margin:0;color:#777;font-size:12px;line-height:1.6;">
        <strong style="color:#aaa;">Didn&rsquo;t ask for this?</strong> Someone may have your plan link.
        Don&rsquo;t share this code &mdash; without it they can&rsquo;t open your plans. Questions? Reply to this email or visit
        <a href="${appUrl}/plans" style="color:#facc15;text-decoration:none;">${appUrl.replace(/^https?:\/\//, "")}/plans</a>.
      </p>
    </div>
  `;

  return sendTransactionalEmail({
    to: email,
    subject: `${code} is your Storage Network code`,
    html: masterEmailLayout("Confirm It's You", body),
  });
}
