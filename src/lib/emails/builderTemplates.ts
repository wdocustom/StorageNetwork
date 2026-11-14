import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import { escapeHtml } from "@/utils/escapeHtml";
import { BUILDER_SUBSCRIPTION, MARKET_HREF, builderHref, formatPrice, purchasedPlanHref } from "@/lib/builder/store";

// ═══════════════════════════════════════════════════════════════════════════
// Custom Builder emails
//
//   • subscriber welcome — their permanent link into the builder
//   • plan purchase — the buyer's permanent link to a plan bought from
//     another builder
//   • sale notice — tells a creator a plan sold and what they earned
//
// Same dark card style as the tote-plan emails (plansTemplates.ts).
// ═══════════════════════════════════════════════════════════════════════════

const button = (href: string, label: string) => `
  <div style="text-align:center;margin-bottom:28px;">
    <a href="${href}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
      ${label} &rarr;
    </a>
    <p style="margin:12px 0 0;color:#555;font-size:11px;">Bookmark this link. It opens on your devices only: a new device asks for a code we email you.</p>
  </div>`;

const hero = (kicker: string, title: string, sub: string) => `
  <div style="background:#111;border-radius:12px;padding:28px 24px;margin-bottom:20px;border:1px solid #222;">
    <p style="margin:0 0 6px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">${kicker}</p>
    <h2 style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:800;">${title}</h2>
    <p style="margin:0;color:#888;font-size:13px;">${sub}</p>
  </div>`;

export async function sendBuilderWelcomeEmail(email: string, accessToken: string): Promise<SendEmailResult> {
  const appUrl = getAppUrl();
  const body = `
    ${hero(BUILDER_SUBSCRIPTION.name, "You're in. Start building.", BUILDER_SUBSCRIPTION.tagline)}
    ${button(`${appUrl}${builderHref(accessToken)}`, "Open the Builder")}
    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 10px;color:#666;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">What's included</p>
      ${BUILDER_SUBSCRIPTION.includes
        .map(
          (item) => `
        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
          <span style="color:#facc15;font-size:12px;flex-shrink:0;margin-top:1px;">&#10003;</span>
          <span style="color:#ccc;font-size:13px;">${item}</span>
        </div>`,
        )
        .join("")}
    </div>
    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px 20px;">
      <p style="margin:0;color:#555;font-size:12px;line-height:1.6;">
        ${formatPrice(BUILDER_SUBSCRIPTION.price)} a month, billed by Stripe. Manage or cancel any time from
        <strong style="color:#888;">My designs</strong> in the builder.
      </p>
    </div>`;
  return sendTransactionalEmail({
    to: email,
    subject: `Your ${BUILDER_SUBSCRIPTION.name} link`,
    html: masterEmailLayout(BUILDER_SUBSCRIPTION.name, body),
  });
}

export async function sendBuilderPlanPurchaseEmail(email: string, designName: string, accessToken: string): Promise<SendEmailResult> {
  const appUrl = getAppUrl();
  const name = escapeHtml(designName);
  const body = `
    ${hero("Build plan", name, "Cut list, shopping list, interactive 3D guide and printable PDF.")}
    ${button(`${appUrl}${purchasedPlanHref(accessToken)}`, "Open My Build Plan")}
    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px 20px;">
      <p style="margin:0;color:#555;font-size:12px;line-height:1.6;">
        This plan is yours permanently, exactly as it was when you bought it.
        Want to design your own? <a href="${appUrl}/plans/builder" style="color:#facc15;text-decoration:none;">Try the Custom Builder</a>.
      </p>
    </div>`;
  return sendTransactionalEmail({
    to: email,
    subject: `Your ${designName} build plan`,
    html: masterEmailLayout(`${designName} — Build Plan`, body),
  });
}

export async function sendBuilderSaleEmail(
  creatorEmail: string,
  sale: { designName: string; amountCents: number; earningsCents: number },
): Promise<SendEmailResult> {
  const appUrl = getAppUrl();
  const body = `
    ${hero("Marketplace sale", `You earned ${formatPrice(sale.earningsCents)}`, `Someone just bought your ${escapeHtml(sale.designName)} plan for ${formatPrice(sale.amountCents)}.`)}
    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px 20px;">
      <p style="margin:0;color:#888;font-size:13px;line-height:1.6;">
        Your earnings are recorded with every sale and shown under <strong style="color:#ccc;">My designs</strong> in the builder.
      </p>
      <p style="margin:10px 0 0;font-size:12px;"><a href="${appUrl}${MARKET_HREF}" style="color:#facc15;text-decoration:none;">See the marketplace &rarr;</a></p>
    </div>`;
  return sendTransactionalEmail({
    to: creatorEmail,
    subject: `Your ${sale.designName} plan sold: ${formatPrice(sale.earningsCents)} earned`,
    html: masterEmailLayout("Marketplace sale", body),
  });
}
