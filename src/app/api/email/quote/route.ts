// ═══════════════════════════════════════════════════════════════════════════
// Quote Email API — Send AI-configured build to customer's email
//
// Called from the CustomerChatWidget when the customer wants their
// design emailed to them. Includes a link to the pre-filled configurator.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { sendTransactionalEmail, emailShell } from "@/lib/email";
import { getAppUrl } from "@/lib/url-helper";

interface QuoteConfig {
  cols?: number;
  rows?: number;
  toteType?: string;
  toteColor?: string;
  unitType?: string;
  orientation?: string;
  hasTotes?: boolean;
  hasWheels?: boolean;
  hasTop?: boolean;
  preset?: string;
}

// Pricing constants (mirrored from platform defaults for email estimate)
const SLOT_PRICE = { standard: 30, mini: 15 };
const TOTE_PRICE = { black: 12, clear: 20, mini: 4 };
const WHEEL_PRICE = { standard: 65, mini: 40 };
const TOP_PRICE = 95;
const PRESET_PRICES: Record<string, number> = {
  "indiana-joe": 950,
  "long-ranger": 715,
  "gas-station": 840,
  "track-norris": 530,
};

function estimatePrice(config: QuoteConfig): number {
  if (config.preset && PRESET_PRICES[config.preset]) {
    let price = PRESET_PRICES[config.preset];
    if (config.hasTotes === false) {
      // Rough tote deduction for presets
      price = Math.round(price * 0.7);
    }
    return price;
  }

  const cols = config.cols || 2;
  const rows = config.rows || 4;
  const isStandard = config.unitType !== "mini";
  const slots = cols * rows;

  let total = slots * (isStandard ? SLOT_PRICE.standard : SLOT_PRICE.mini);

  if (config.hasTotes !== false) {
    const totePrice = !isStandard ? TOTE_PRICE.mini : config.toteColor === "clear" ? TOTE_PRICE.clear : TOTE_PRICE.black;
    total += slots * totePrice;
  }

  if (config.hasWheels) total += isStandard ? WHEEL_PRICE.standard : WHEEL_PRICE.mini;
  if (config.hasTop) total += TOP_PRICE;

  return total;
}

function describeConfig(config: QuoteConfig): string {
  if (config.preset) {
    const names: Record<string, string> = {
      "indiana-joe": "Indiana Joe (2×4 + 2×2 + 2×4)",
      "long-ranger": "The Long Ranger (2×4 + 4×2)",
      "gas-station": "The Gas Station (1×4 + 4×2 + 1×4)",
      "track-norris": "Track Norris (4×2 with drawer slides)",
    };
    return names[config.preset] || config.preset;
  }

  const cols = config.cols || 2;
  const rows = config.rows || 4;
  const tote = config.toteType === "GM" ? "Greenmade" : "HDX";
  const parts = [`${cols}×${rows} ${tote}`];
  if (config.unitType === "mini") parts.push("Mini");
  if (config.orientation === "sideways") parts.push("Sideways");
  if (config.hasWheels) parts.push("with Wheels");
  if (config.hasTop) parts.push("with Top");
  if (config.hasTotes !== false) parts.push(`(${cols * rows} totes)`);
  return parts.join(" ");
}

export async function POST(req: NextRequest) {
  let body: { email?: string; config?: QuoteConfig; designUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email, config, designUrl } = body;
  if (!email || !config) {
    return NextResponse.json({ error: "Email and config required" }, { status: 400 });
  }

  const price = estimatePrice(config);
  const description = describeConfig(config);
  const fullUrl = designUrl
    ? `${getAppUrl()}${designUrl.startsWith("/") ? designUrl : "/" + designUrl}`
    : `${getAppUrl()}/design`;

  const html = emailShell(
    "Your Custom Storage Design",
    `
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 8px;">Your Storage Design is Ready</h1>
      <p style="color: #a8a29e; font-size: 14px; margin: 0;">Built just for you by our AI design assistant</p>
    </div>

    <div style="background: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <p style="color: #a8a29e; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Your Build</p>
      <p style="color: #ffffff; font-size: 18px; font-weight: 800; margin: 0 0 16px;">${description}</p>

      <div style="border-top: 1px solid #334155; padding-top: 16px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${config.cols && config.rows ? `<tr><td style="color: #a8a29e; font-size: 13px; padding: 4px 0;">Size</td><td style="color: #ffffff; font-size: 13px; text-align: right;">${config.cols} columns × ${config.rows} tiers</td></tr>` : ""}
          ${config.toteType ? `<tr><td style="color: #a8a29e; font-size: 13px; padding: 4px 0;">Totes</td><td style="color: #ffffff; font-size: 13px; text-align: right;">${config.toteType === "GM" ? "Greenmade (Costco)" : "HDX (Home Depot)"}${config.toteColor === "clear" ? " — Clear" : ""}</td></tr>` : ""}
          ${config.hasWheels ? `<tr><td style="color: #a8a29e; font-size: 13px; padding: 4px 0;">Casters</td><td style="color: #ffffff; font-size: 13px; text-align: right;">Industrial swivel wheels</td></tr>` : ""}
          ${config.hasTop ? `<tr><td style="color: #a8a29e; font-size: 13px; padding: 4px 0;">Countertop</td><td style="color: #ffffff; font-size: 13px; text-align: right;">Plywood top surface</td></tr>` : ""}
        </table>
      </div>

      <div style="border-top: 1px solid #334155; margin-top: 16px; padding-top: 16px; text-align: center;">
        <p style="color: #a8a29e; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">Estimated Price</p>
        <p style="color: #facc15; font-size: 28px; font-weight: 900; margin: 0;">$${price}</p>
        <p style="color: #57534e; font-size: 11px; margin: 4px 0 0;">Final pricing shown in the 3D designer with your local installer's rates</p>
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${fullUrl}" style="display: inline-block; background: #facc15; color: #0f172a; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
        View My Design in 3D →
      </a>
    </div>

    <p style="color: #57534e; font-size: 12px; text-align: center;">
      Click the button above to see your storage unit in 3D, customize it further, and book professional installation.
    </p>
    `
  );

  const result = await sendTransactionalEmail({
    to: email,
    subject: `Your Custom Storage Design — ${description}`,
    html,
  });

  return NextResponse.json({ success: result.success });
}
