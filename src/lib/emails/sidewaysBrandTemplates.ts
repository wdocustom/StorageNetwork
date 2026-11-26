import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import { encodeTotePlanDesign, parseTotePlanDesign, totePlanName, type TotePlanDesign } from "@/lib/tote-plans";
import { rails2x4Bay } from "@/lib/rails2x4";
import { toFraction } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// One-time notice to DIY plan buyers whose plans have SIDEWAYS units, sent
// when sideways 2×4 bays started following the tote brand (PR #301).
//
// Every sideways plan sold before that was cut for HDX-size totes (30-1/4"
// bays) — the designer had no other choice. HDX owners are fine. Owners of
// Greenmade-size totes (Greenmade, Project Source, Hyper Tough) need 32"
// bays. Each button opens the designer on the buyer's own design, switched
// to Greenmade-size, signed in with their plan link — so "Generate — included"
// gives them the corrected plan free under All-Access.
// ═══════════════════════════════════════════════════════════════════════════

function ctaButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background-color:#facc15;color:#000000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">${label}</a>`;
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const inches = (n: number) => `${toFraction(n)}"`;

/** The buyer's design with every sideways 27-gal unit switched to Greenmade-size. */
export function greenmadeVersion(design: TotePlanDesign): TotePlanDesign {
  return { ...design, units: design.units.map((u) => (u.sideways && u.toteType === "HDX" ? { ...u, toteType: "GM" } : u)) };
}

export interface SidewaysNoticePlan {
  /** The plan's link token (signs them in to the designer as an All-Access owner) */
  accessToken: string;
  /** The purchase's build_config */
  buildConfig: unknown;
}

export function sidewaysNoticeLinks(plans: SidewaysNoticePlan[]): { name: string; url: string }[] {
  const appUrl = getAppUrl();
  const out: { name: string; url: string }[] = [];
  for (const p of plans) {
    const design = parseTotePlanDesign(p.buildConfig);
    if (!design || !design.units.some((u) => u.sideways)) continue;
    const fixed = greenmadeVersion(design);
    const params = new URLSearchParams({ member: p.accessToken, design: encodeTotePlanDesign(fixed), utm_source: "sideways_brand_fix" });
    if (fixed.name) params.set("name", fixed.name);
    out.push({ name: totePlanName(design), url: `${appUrl}/plans/checkout?${params.toString()}` });
  }
  return out;
}

export function renderSidewaysBrandNotice(data: { firstName: string | null; plans: { name: string; url: string }[] }): { subject: string; html: string } {
  const hdxBay = inches(rails2x4Bay(true, "HDX"));
  const gmBay = inches(rails2x4Bay(true, "GM"));
  const name = data.firstName?.trim();
  const greeting = name ? `Hi ${escapeHtml(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase())},` : "Hi,";
  const many = data.plans.length > 1;

  const buttons = data.plans
    .map(
      (p) => `
      <tr><td style="padding:10px 0;border-bottom:1px solid #222;">
        <p style="margin:0 0 10px;color:#ffffff;font-size:14px;font-weight:600;">${escapeHtml(p.name)}</p>
        ${ctaButton(p.url, "Get the Greenmade-size version")}
      </td></tr>`,
    )
    .join("");

  const html = masterEmailLayout(
    "A quick check on your sideways plan",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 18px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your tote rack plan${many ? "s include" : " includes"} sideways units, where each tote turns so its long side faces out.
      ${many ? "Those plans were" : "That plan was"} sized for <strong style="color:#ffffff;">HDX totes</strong> (Home Depot) and
      Performax (Menards), with ${hdxBay} bays between uprights.
    </p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:18px 20px;margin:0 0 18px;">
      <p style="margin:0 0 6px;color:#22c55e;font-size:14px;font-weight:700;">Using HDX or Performax totes?</p>
      <p style="margin:0;color:#a3a3a3;font-size:14px;line-height:1.6;">You're all set. Nothing changes; build as planned.</p>
    </div>

    <div style="background-color:#111111;border:1px solid #facc15;border-radius:12px;padding:18px 20px;margin:0 0 18px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:14px;font-weight:700;">Using Greenmade, Project Source or Hyper Tough totes?</p>
      <p style="margin:0 0 14px;color:#a3a3a3;font-size:14px;line-height:1.6;">
        Those totes (Costco, Lowe's, Walmart) are longer, and they likely won't drop into ${hdxBay} sideways bays.
        We now make sideways plans sized for them, with ${gmBay} bays. The corrected plan is free with your
        All-Access plans: tap below and choose <strong style="color:#ffffff;">Generate</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;">${buttons}</table>
    </div>

    <p style="margin:0 0 10px;color:#a3a3a3;font-size:14px;line-height:1.6;">
      Units in your plan that face the standard direction aren't affected: their 21" bays fit both kinds of tote.
    </p>
    <p style="margin:0 0 22px;color:#a3a3a3;font-size:14px;line-height:1.6;">
      Already built your sideways units with Greenmade-size totes and they're tight? Reply to this email and we'll help you sort it out.
    </p>
    <p style="margin:0;color:#555;font-size:12px;">Storage Network · DIY Build Plans</p>
    `,
  );
  return { subject: "Using Greenmade or Lowe's totes? A fix for your sideways rack plan", html };
}

export async function sendSidewaysBrandNotice(
  email: string,
  data: { firstName: string | null; plans: SidewaysNoticePlan[] },
): Promise<SendEmailResult> {
  const plans = sidewaysNoticeLinks(data.plans);
  if (!plans.length) return { success: false, error: "No sideways plans" };
  const { subject, html } = renderSidewaysBrandNotice({ firstName: data.firstName, plans });
  return sendTransactionalEmail({ to: email, subject, html });
}
