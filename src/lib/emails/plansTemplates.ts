import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import type { PublicPlan } from "@/lib/plans-config";
import { LADDER_JIG_NAME, LADDER_JIG_TAGLINE } from "@/lib/ladder-jig";
import {
  TOTE_PLAN_ALL_ACCESS,
  designFromItems,
  formatPlanPrice,
  totePlanDesignHref,
  totePlanName,
  totePlanSummary,
  type PlanSourceItem,
  type TotePlanDesign,
  type TotePlanTier,
} from "@/lib/tote-plans";
import { usdMoney } from "@/lib/geo/currency";
import { DIY_INVENTORY, diyInventoryHref } from "@/lib/diy-inventory";

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
        Get DIY build plans for this design &mdash; ${usdMoney(formatPlanPrice(TOTE_PLAN_ALL_ACCESS.price))} lifetime &rarr;
      </a>
      <p style="margin:6px 0 0;color:#555;font-size:11px;">Interactive 3D guide + printable PDF, and unlimited plans for every size you design.</p>
    </div>`;
}

/**
 * "Now that you've built it, let's get organized": the Smart Inventory
 * add-on ($5, every rack for life), linking the buyer's own inventory page.
 */
export function smartInventoryEmailBlock(appUrl: string, accessToken: string): string {
  const url = `${appUrl}${diyInventoryHref(accessToken)}`;
  const price = usdMoney(formatPlanPrice(DIY_INVENTORY.price));
  return `
    <div style="background:#0a0a0a;border:1px solid #3f3a1c;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Optional add-on &middot; ${DIY_INVENTORY.name}</p>
      <p style="margin:0 0 6px;color:#fff;font-size:14px;font-weight:800;">Built your rack? Let&rsquo;s get organized.</p>
      <p style="margin:0 0 10px;color:#999;font-size:12px;line-height:1.5;">Your rack on your phone: tap a tote, snap a photo and it lists what&rsquo;s inside. Search &ldquo;camping stove&rdquo; and the right tote lights up. QR labels for each rack, and your household can look things up too. Add every rack you build. All your plans for a single price of ${price}, for life.</p>
      <a href="${url}" style="color:#facc15;font-size:13px;font-weight:800;text-decoration:none;">See Smart Inventory &rarr;</a>
    </div>`;
}

export async function sendPlanAccessEmail(
  email: string,
  plan: PublicPlan,
  accessToken: string,
): Promise<SendEmailResult> {
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

  return sendTransactionalEmail({
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
): Promise<SendEmailResult> {
  const appUrl = getAppUrl();
  const accessUrl = `${appUrl}/plans/build?token=${accessToken}`;
  const name = totePlanName(design);
  const info = TOTE_PLAN_ALL_ACCESS;
  // Every tote plan opens with full access (All-Access); the tier is history.
  void tier;
  const buildAnotherUrl = `${appUrl}/plans/checkout?member=${accessToken}`;

  const body = `
    <div style="background:#111;border-radius:12px;padding:28px 24px;margin-bottom:20px;border:1px solid #222;">
      <p style="margin:0 0 6px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">${info.name}</p>
      <h2 style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:800;">${name}</h2>
      <p style="margin:0;color:#888;font-size:13px;">${totePlanSummary(design)}</p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${accessUrl}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
        Open My Build Plan →
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

    <div style="background:#06281e;border:1px solid #065f46;border-radius:8px;padding:16px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;color:#6ee7b7;font-size:14px;font-weight:800;">Build another? It&rsquo;s included.</p>
      <p style="margin:0 0 10px;color:#a7f3d0;font-size:12px;line-height:1.5;">All-Access covers every tote organizer you design, for life. New size, new plan, free.</p>
      <a href="${buildAnotherUrl}" style="color:#6ee7b7;font-size:13px;font-weight:800;text-decoration:none;">Build another plan &rarr;</a>
    </div>

    ${smartInventoryEmailBlock(appUrl, accessToken)}

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;color:#facc15;font-size:13px;font-weight:800;">Interested in building these for a living?</p>
      <p style="margin:0 0 8px;color:#999;font-size:12px;line-height:1.5;">Neighbors pay real money for a garage like yours. Storage Network installers get customers who design and pay a deposit online, exact cut lists for every job, and instant payouts.</p>
      <a href="${appUrl}/join?src=plans-email" style="color:#facc15;font-size:12px;font-weight:700;text-decoration:none;">See how installers earn &rarr;</a>
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px 20px;">
      <p style="margin:0;color:#555;font-size:12px;line-height:1.6;">
        <strong style="color:#888;">Lost this email?</strong> Visit
        <a href="${appUrl}/plans" style="color:#facc15;text-decoration:none;">${appUrl.replace(/^https?:\/\//, "")}/plans</a>
        and use &ldquo;Resend my link&rdquo; to get a new copy sent to this address.
      </p>
    </div>
  `;

  return sendTransactionalEmail({
    to: email,
    subject: `Your ${name} build plan — All-Access is yours`,
    html: masterEmailLayout(`${name} — ${info.name}`, body),
  });
}

export async function sendLadderJigAccessEmail(email: string, accessToken: string): Promise<SendEmailResult> {
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

  return sendTransactionalEmail({
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

/**
 * "Here's your design" — sent when a designer visitor who isn't ready to buy
 * asks us to email it (the $5-off offer). The link reopens their exact
 * design with the offer applied.
 */
export async function sendPlanDesignSavedEmail(
  email: string,
  design: TotePlanDesign,
  link: string,
  priceLabel: string,
): Promise<SendEmailResult> {
  const name = totePlanName(design);
  const body = `
    <p style="margin:0 0 18px;color:#a3a3a3;font-size:15px;line-height:1.7;text-align:center;">
      Here&rsquo;s the tote rack you designed. Open it any time to tweak it or get the plans.
    </p>
    <div style="background:#111;border:1px solid #222;border-radius:12px;padding:22px 18px;margin:0 0 20px;text-align:center;">
      <p style="margin:0 0 4px;color:#fff;font-size:18px;font-weight:800;">${name}</p>
      <p style="margin:0 0 16px;color:#888;font-size:13px;">${totePlanSummary(design)}</p>
      <p style="margin:0 0 4px;color:#facc15;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Your price</p>
      <p style="margin:0 0 18px;color:#fff;font-size:30px;font-weight:900;">
        ${usdMoney(priceLabel)}${priceLabel !== formatPlanPrice(TOTE_PLAN_ALL_ACCESS.price) ? ` <span style="color:#666;font-size:16px;font-weight:600;text-decoration:line-through;">${usdMoney(formatPlanPrice(TOTE_PLAN_ALL_ACCESS.price))}</span>` : ""}
      </p>
      <a href="${link}" style="display:inline-block;background:#facc15;color:#000;font-size:15px;font-weight:800;padding:14px 28px;border-radius:10px;text-decoration:none;">
        Open my design &rarr;
      </a>
      <p style="margin:14px 0 0;color:#666;font-size:12px;">Lifetime plans for this size and every one you design after it: 3D build guide, cut list, shopping list and printable PDF.</p>
    </div>
  `;
  return sendTransactionalEmail({
    to: email,
    subject: `Your ${name} design (${priceLabel} plans inside)`,
    html: masterEmailLayout("Your Tote Rack Design", body),
  });
}

/**
 * One-time note to buyers from before Smart Inventory existed: what it is,
 * and a link to their own inventory page (opens the explainer + $5 offer).
 */
export async function sendSmartInventoryAnnouncementEmail(
  email: string,
  data: { accessToken: string; designName: string; customerName?: string | null },
): Promise<SendEmailResult> {
  const appUrl = getAppUrl();
  const url = `${appUrl}${diyInventoryHref(data.accessToken)}`;
  const price = usdMoney(formatPlanPrice(DIY_INVENTORY.price));
  const first = (data.customerName ?? "").trim().split(/\s+/)[0];
  const row = (title: string, text: string) => `
    <div style="margin-bottom:12px;">
      <p style="margin:0 0 2px;color:#fff;font-size:14px;font-weight:700;">${title}</p>
      <p style="margin:0;color:#999;font-size:13px;line-height:1.5;">${text}</p>
    </div>`;

  const body = `
    <p style="margin:0 0 8px;color:#fff;font-size:16px;">Hi ${first || "there"},</p>
    <p style="margin:0 0 20px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Thanks again for building with our ${data.designName} plans. Now that your rack is up, here&rsquo;s something new to keep it organized.
    </p>

    <div style="background:#111;border-radius:12px;padding:24px;margin-bottom:20px;border:1px solid #222;">
      <p style="margin:0 0 6px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">New &middot; ${DIY_INVENTORY.name}</p>
      <h2 style="margin:0 0 16px;color:#fff;font-size:20px;font-weight:800;">Know what&rsquo;s in every tote without opening one.</h2>
      <div style="text-align:center;margin:0 0 18px;">
        <img src="${appUrl}/plan-samples/inventory-rack.jpg" width="240" alt="Smart Inventory on a phone: a rack with every tote" style="width:240px;max-width:70%;height:auto;border-radius:14px;border:1px solid #333;" />
      </div>
      ${row("Every tote, on your phone", "Tap a tote on your rack to list what&rsquo;s in it. Snap a photo and it lists the contents for you.")}
      ${row("Search, then walk straight to it", "Type &ldquo;camping stove&rdquo; and the right tote lights up, on whichever rack it&rsquo;s on.")}
      ${row("QR labels for your racks", "Print a label, stick it on the rack, and anyone in the house can scan it to look things up.")}
      ${row("Grows with every rack you build", "A 4&times;4 today, a 4&times;2 next spring: add each rack as you build it.")}
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${url}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;">
        Get organized &mdash; ${price}
      </a>
      <p style="margin:12px 0 0;color:#888;font-size:12px;">All your plans for a single price of ${price}. One payment, for life. No subscription.</p>
    </div>
  `;

  return sendTransactionalEmail({
    to: email,
    subject: `Your rack is built. Now know what's in every tote.`,
    html: masterEmailLayout(`${DIY_INVENTORY.name}`, body),
  });
}
