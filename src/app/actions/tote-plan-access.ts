"use server";

// ═══════════════════════════════════════════════════════════════════════════
// TOTE PLAN ACCESS — the only door to a paid tote organizer plan
//
// /plans/build calls openTotePlan() with one of:
//   • sessionId  — first visit, straight from Stripe. Verifies payment,
//                  records the purchase (idempotent on stripe_session_id)
//                  and emails the permanent access link.
//   • token      — return visit from that email link.
//   • proConfig  — paid Pro installer or admin; re-checked server-side.
//
// The config is always read from Stripe metadata or the purchase row,
// never trusted from the URL, and the full plan (shopping list, cut plan,
// steps) is only generated after access is established.
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "stripe";
import { siteConfig } from "@/config/site";
import { getServiceClient } from "@/lib/supabase-server";
import { generateDIYPlan, type CompleteDIYPlan } from "@/app/actions/generate-plan";
import { checkDIYPlanAccess } from "@/app/actions/diy-plan-checkout";
import { sendTotePlanAccessEmail } from "@/lib/emails/plansTemplates";
import {
  enforceActionRateLimit,
  RateLimitError,
} from "@/lib/server/action-rate-limit";
import {
  TOTE_PLAN_ID,
  TOTE_PLAN_UPGRADE_PRICE,
  isTotePlanTier,
  parseTotePlanConfig,
  totePlanName,
  type TotePlanConfig,
  type TotePlanTier,
} from "@/lib/tote-plans";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OpenTotePlanInput =
  | { sessionId: string }
  | { token: string; upgradeSessionId?: string }
  | { proConfig: unknown };

export type OpenTotePlanResult =
  | {
      ok: true;
      tier: TotePlanTier;
      config: TotePlanConfig;
      plan: CompleteDIYPlan;
      /** Permanent access token — absent for Pro/admin access */
      token?: string;
      /** Buyer email — present on the first visit so the page can confirm it */
      emailSentTo?: string;
      access: "purchase" | "pro" | "admin";
    }
  | { ok: false; error: string };

interface PurchaseRow {
  access_token: string;
  email: string;
  tier: string | null;
  build_config: unknown;
  plan_id: string;
}

async function buildResult(
  row: PurchaseRow,
  extras: { emailSentTo?: string } = {},
): Promise<OpenTotePlanResult> {
  const config = parseTotePlanConfig(row.build_config);
  if (row.plan_id !== TOTE_PLAN_ID || !config || !isTotePlanTier(row.tier)) {
    return { ok: false, error: "This link isn't for a tote organizer plan." };
  }
  const plan = await generateDIYPlan({ ...config, unitType: "standard", orientation: "standard" }, totePlanName(config));
  return {
    ok: true,
    tier: row.tier,
    config,
    plan,
    token: row.access_token,
    access: "purchase",
    ...extras,
  };
}

async function findByToken(token: string): Promise<PurchaseRow | null> {
  if (!UUID_RE.test(token)) return null;
  const { data } = await getServiceClient()
    .from("public_plan_purchases")
    .select("access_token, email, tier, build_config, plan_id")
    .eq("access_token", token)
    .maybeSingle();
  return (data as PurchaseRow | null) ?? null;
}

export async function openTotePlan(input: OpenTotePlanInput): Promise<OpenTotePlanResult> {
  try {
    if ("proConfig" in input) return await openForPro(input.proConfig);
    if ("sessionId" in input) return await openFromCheckout(input.sessionId);
    return await openFromToken(input.token, input.upgradeSessionId);
  } catch (err) {
    console.error("[TotePlanAccess]", err);
    return { ok: false, error: "We couldn't load your plan. Please try again." };
  }
}

async function openForPro(rawConfig: unknown): Promise<OpenTotePlanResult> {
  const access = await checkDIYPlanAccess();
  if (!access.hasFreeAccess || !access.reason) {
    return { ok: false, error: "Sign in with a Pro account to use included plans." };
  }
  const config = parseTotePlanConfig(rawConfig);
  if (!config) return { ok: false, error: "Plans are available for single units up to 4 wide × 6 tall." };
  const plan = await generateDIYPlan({ ...config, unitType: "standard", orientation: "standard" }, totePlanName(config));
  return { ok: true, tier: "interactive", config, plan, access: access.reason };
}

async function openFromCheckout(sessionId: string): Promise<OpenTotePlanResult> {
  const db = getServiceClient();

  // Already recorded (page refresh, back button) — don't re-send the email.
  const { data: existing } = await db
    .from("public_plan_purchases")
    .select("access_token, email, tier, build_config, plan_id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (existing) return buildResult(existing as PurchaseRow);

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid" || session.metadata?.type !== "diy_plan") {
    return { ok: false, error: "We couldn't confirm that payment." };
  }

  let parsedConfig: unknown = null;
  try {
    parsedConfig = JSON.parse(session.metadata.config ?? "null");
  } catch {
    parsedConfig = null;
  }
  const config = parseTotePlanConfig(parsedConfig);
  // Sessions created before tiers existed carry no tier — they bought the PDF.
  const tier: TotePlanTier = isTotePlanTier(session.metadata.tier) ? session.metadata.tier : "pdf";
  const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase();
  if (!config || !email) {
    console.error("[TotePlanAccess] Paid session missing config or email:", sessionId);
    return { ok: false, error: "Your payment went through but the order is incomplete. Reply to your receipt and we'll sort it out." };
  }

  const { data: inserted, error } = await db
    .from("public_plan_purchases")
    .insert({
      email,
      plan_id: TOTE_PLAN_ID,
      tier,
      build_config: config,
      stripe_session_id: sessionId,
      email_sent: false,
      referred_by_promoter_id: session.metadata.promoter_id || null,
      promoter_referral_code_snapshot: session.metadata.promoter_referral_code || null,
    })
    .select("access_token, email, tier, build_config, plan_id")
    .single();

  if (error || !inserted) {
    // Lost a race with a concurrent load of the same session — use its row.
    if ((error as { code?: string } | null)?.code === "23505") {
      const { data: winner } = await db
        .from("public_plan_purchases")
        .select("access_token, email, tier, build_config, plan_id")
        .eq("stripe_session_id", sessionId)
        .single();
      if (winner) return buildResult(winner as PurchaseRow);
    }
    console.error("[TotePlanAccess] Insert error:", error);
    return { ok: false, error: "We couldn't record your purchase. Please refresh the page." };
  }

  const row = inserted as PurchaseRow;
  sendTotePlanAccessEmail(email, config, tier, row.access_token)
    .then(() =>
      db.from("public_plan_purchases").update({ email_sent: true }).eq("access_token", row.access_token),
    )
    .catch((err) => console.error("[TotePlanAccess] Email error:", err));

  return buildResult(row, { emailSentTo: email });
}

async function openFromToken(token: string, upgradeSessionId?: string): Promise<OpenTotePlanResult> {
  const row = await findByToken(token);
  if (!row) return { ok: false, error: "This link is invalid or has expired." };

  if (upgradeSessionId && row.tier === "pdf") {
    await applyUpgrade(row, upgradeSessionId);
    const refreshed = await findByToken(token);
    if (refreshed) return buildResult(refreshed);
  }
  return buildResult(row);
}

async function applyUpgrade(row: PurchaseRow, upgradeSessionId: string): Promise<void> {
  const session = await getStripe().checkout.sessions.retrieve(upgradeSessionId);
  if (
    session.payment_status !== "paid" ||
    session.metadata?.type !== "diy_plan_upgrade" ||
    session.metadata?.access_token !== row.access_token
  ) {
    return;
  }
  const { error } = await getServiceClient()
    .from("public_plan_purchases")
    .update({
      tier: "interactive",
      upgraded_at: new Date().toISOString(),
      upgrade_stripe_session_id: upgradeSessionId,
    })
    .eq("access_token", row.access_token)
    .eq("tier", "pdf");
  if (error) console.error("[TotePlanAccess] Upgrade update failed:", error);
}

/**
 * Checkout for moving a PDF purchase up to the Interactive Build Guide.
 * Charges the price difference; the upgrade is applied when Stripe sends
 * the buyer back to their /plans/build link.
 */
export async function createTotePlanUpgradeCheckout(
  token: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await enforceActionRateLimit({
      action: "tote-plan-upgrade-checkout",
      limit: 10,
      window: "60 s",
      identify: "user-or-ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) return { success: false, error: err.message };
    throw err;
  }

  const row = await findByToken(token);
  const config = row ? parseTotePlanConfig(row.build_config) : null;
  if (!row || !config || row.plan_id !== TOTE_PLAN_ID) {
    return { success: false, error: "We couldn't find that purchase." };
  }
  if (row.tier === "interactive") {
    return { success: false, error: "You already have the Interactive Build Guide." };
  }

  try {
    const baseUrl = siteConfig.baseUrl;
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: row.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Upgrade to Interactive Build Guide — ${totePlanName(config)}`,
              description: "Interactive 3D assembly guide for the plan you already own.",
            },
            unit_amount: TOTE_PLAN_UPGRADE_PRICE,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/plans/build?token=${row.access_token}&upgrade_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/plans/build?token=${row.access_token}`,
      metadata: {
        type: "diy_plan_upgrade",
        plan_id: TOTE_PLAN_ID,
        access_token: row.access_token,
      },
    });
    if (!session.url) return { success: false, error: "Failed to create checkout session." };
    return { success: true, url: session.url };
  } catch (err) {
    console.error("[TotePlanAccess] Upgrade checkout error:", err);
    return { success: false, error: "Failed to create checkout. Please try again." };
  }
}
