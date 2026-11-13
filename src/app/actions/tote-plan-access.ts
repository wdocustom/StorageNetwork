"use server";

// ═══════════════════════════════════════════════════════════════════════════
// TOTE PLAN ACCESS — the only door to a paid tote organizer plan
//
// /plans/build calls openTotePlan() with one of:
//   • sessionId  — first visit, straight from Stripe. Verifies payment,
//                  records the purchase (idempotent on stripe_session_id)
//                  and emails the permanent access link.
//   • token      — return visit from that email link.
//   • proDesign  — paid Pro installer or admin; re-checked server-side.
//   • leadId     — the installer assigned a lead that came from the plans
//                  designer ("have a pro build it"): the customer's exact
//                  design, read from the lead, for that installer only.
//
// Purchases also pass the device gate (@/lib/server/plan-device): a link
// opened on a device the buyer hasn't used comes back with `verify` and the
// page asks for the code emailed to the buyer.
//
// The design is always read from Stripe metadata or the purchase row,
// never trusted from the URL, and the full plan (shopping list, cut plan,
// steps) is only generated after access is established.
//
// All-Access (since Nov 12, 2026): every tote purchase opens with the full
// plan (3D guide + PDF), whatever tier the row records, and its link lets
// the buyer generate plans for more designs at no charge
// (createIncludedPlan). Those plans are rows of their own, with
// included_from pointing at the paid purchase.
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "stripe";
import { stripeConfig } from "@/lib/stripe/http";
import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import { generateDIYPlan, type CompleteDIYPlan } from "@/app/actions/generate-plan";
import { checkDIYPlanAccess } from "@/app/actions/diy-plan-checkout";
import { sendTotePlanAccessEmail } from "@/lib/emails/plansTemplates";
import { checkPlanDevice } from "@/lib/server/plan-device";
import {
  enforceActionRateLimit,
  RateLimitError,
} from "@/lib/server/action-rate-limit";
import { LADDER_JIG_PLAN_ID, ladderJigHref } from "@/lib/ladder-jig";
import {
  TOTE_PLAN_ALL_ACCESS_TIER,
  TOTE_PLAN_ID,
  TOTE_PLAN_LIMITS,
  decodeTotePlanDesign,
  encodeTotePlanDesign,
  isTotePlanTier,
  parseTotePlanDesign,
  type TotePlanDesign,
  type TotePlanTier,
} from "@/lib/tote-plans";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, stripeConfig());
  return _stripe;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OpenTotePlanInput =
  | { sessionId: string }
  | { token: string; upgradeSessionId?: string }
  | { proDesign: unknown }
  | { leadId: string };

export type OpenTotePlanResult =
  | {
      ok: true;
      tier: TotePlanTier;
      design: TotePlanDesign;
      plan: CompleteDIYPlan;
      /** Permanent access token — absent for Pro/admin access */
      token?: string;
      /** Buyer email — present on the first visit so the page can confirm it */
      emailSentTo?: string;
      /** Buyer's first name (from checkout) — the PDF cover says "Designed for …" */
      firstName?: string;
      /** Buyer email + order ref, stamped on every PDF page (purchases only) */
      license?: { email: string; order: string };
      access: "purchase" | "pro" | "admin" | "installer";
      /** Ladder jig link: their own jig plans if bought, else the $5 owner offer (purchases only) */
      jig?: { owned: boolean; href: string };
    }
  | {
      ok: false;
      error: string;
      /** Set when the link is fine but this device needs the emailed code */
      verify?: { token: string; emailHint: string };
    };

interface PurchaseRow {
  access_token: string;
  email: string;
  tier: string | null;
  build_config: unknown;
  plan_id: string;
  customer_name: string | null;
  /** All-Access: the paid purchase this free plan was built under */
  included_from: string | null;
}

const PURCHASE_COLUMNS = "access_token, email, tier, build_config, plan_id, customer_name, included_from";

/** "Skyler Camacho" → "Skyler"; null when there's nothing usable. */
function firstNameOf(name: string | null | undefined): string | undefined {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : undefined;
}

async function buildResult(
  row: PurchaseRow,
  extras: { emailSentTo?: string } = {},
): Promise<OpenTotePlanResult> {
  // build_config is a design ({units, name}) or, for purchases made before
  // multi-unit plans, a single unit config — parseTotePlanDesign reads both.
  const design = parseTotePlanDesign(row.build_config);
  if (row.plan_id !== TOTE_PLAN_ID || !design || !isTotePlanTier(row.tier)) {
    return { ok: false, error: "This link isn't for a tote organizer plan." };
  }
  const plan = await generateDIYPlan(design);
  const { data: jigRow } = await getServiceClient()
    .from("public_plan_purchases")
    .select("access_token")
    .eq("email", row.email)
    .eq("plan_id", LADDER_JIG_PLAN_ID)
    .limit(1)
    .maybeSingle();
  return {
    ok: true,
    // All-Access: every tote plan opens with the 3D guide and the PDF,
    // including ones bought as "pdf" before Nov 12, 2026.
    tier: TOTE_PLAN_ALL_ACCESS_TIER,
    design,
    plan,
    token: row.access_token,
    firstName: firstNameOf(row.customer_name),
    license: { email: row.email, order: orderRef(row.access_token) },
    access: "purchase",
    jig: jigRow
      ? { owned: true, href: `/plans/jig?token=${jigRow.access_token}` }
      : { owned: false, href: ladderJigHref(row.access_token) },
    ...extras,
  };
}

/** Short order reference for the PDF footer, e.g. "SN-3F9A2C1B". */
function orderRef(token: string): string {
  return `SN-${token.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

async function findByToken(token: string): Promise<PurchaseRow | null> {
  if (!UUID_RE.test(token)) return null;
  const { data } = await getServiceClient()
    .from("public_plan_purchases")
    .select(PURCHASE_COLUMNS)
    .eq("access_token", token)
    .maybeSingle();
  return (data as PurchaseRow | null) ?? null;
}

export async function openTotePlan(input: OpenTotePlanInput): Promise<OpenTotePlanResult> {
  try {
    if ("proDesign" in input) return await openForPro(input.proDesign);
    if ("leadId" in input) return await openForLeadInstaller(input.leadId);
    if ("sessionId" in input) return await openFromCheckout(input.sessionId);
    return await openFromToken(input.token, input.upgradeSessionId);
  } catch (err) {
    console.error("[TotePlanAccess]", err);
    return { ok: false, error: "We couldn't load your plan. Please try again." };
  }
}

async function openForPro(rawDesign: unknown): Promise<OpenTotePlanResult> {
  const access = await checkDIYPlanAccess();
  if (!access.hasFreeAccess || !access.reason) {
    return { ok: false, error: "Sign in with a Pro account to use included plans." };
  }
  const design = parseTotePlanDesign(rawDesign);
  if (!design) {
    return {
      ok: false,
      error: `Plans cover up to ${TOTE_PLAN_LIMITS.maxUnits} standard tote units, each up to ${TOTE_PLAN_LIMITS.maxCols} wide × ${TOTE_PLAN_LIMITS.maxRows} tall.`,
    };
  }
  const plan = await generateDIYPlan(design);
  return { ok: true, tier: "interactive", design, plan, access: access.reason };
}

/** The customer's design on a lead, for the installer the lead is assigned to (or an admin). */
async function openForLeadInstaller(leadId: string): Promise<OpenTotePlanResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: "Sign in to your installer account to open this plan." };
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) return { ok: false, error: "Job not found." };
  const db = getServiceClient();
  const [{ data: lead }, { data: profile }] = await Promise.all([
    db.from("leads").select("installer_id, plan_design, plan_design_name").eq("id", leadId).maybeSingle(),
    db.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
  ]);
  const isAdmin = profile?.is_admin === true;
  if (!lead || (lead.installer_id !== user.id && !isAdmin)) return { ok: false, error: "Job not found." };
  const design = decodeTotePlanDesign(lead.plan_design as string | null, lead.plan_design_name as string | null);
  if (!design) return { ok: false, error: "This job didn't come from the plans designer, so it has no plan." };
  const plan = await generateDIYPlan(design);
  return { ok: true, tier: "interactive", design, plan, access: isAdmin && lead.installer_id !== user.id ? "admin" : "installer" };
}

/** Design recorded on a paid session: compact `design` (current) or `config` JSON (single-unit legacy). */
function designFromSessionMetadata(metadata: Stripe.Metadata): TotePlanDesign | null {
  if (metadata.design) return decodeTotePlanDesign(metadata.design, metadata.design_name);
  try {
    return parseTotePlanDesign(JSON.parse(metadata.config ?? "null"));
  } catch {
    return null;
  }
}

async function openFromCheckout(sessionId: string): Promise<OpenTotePlanResult> {
  const db = getServiceClient();

  // Already recorded (page refresh, back button) — don't re-send the email.
  const { data: existing } = await db
    .from("public_plan_purchases")
    .select(PURCHASE_COLUMNS)
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (existing) return gated(existing as PurchaseRow);

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid" || session.metadata?.type !== "diy_plan") {
    return { ok: false, error: "We couldn't confirm that payment." };
  }

  const design = designFromSessionMetadata(session.metadata);
  // Sessions created before tiers existed carry no tier — they bought the PDF.
  const tier: TotePlanTier = isTotePlanTier(session.metadata.tier) ? session.metadata.tier : "pdf";
  const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase();
  if (!design || !email) {
    console.error("[TotePlanAccess] Paid session missing design or email:", sessionId);
    return { ok: false, error: "Your payment went through but the order is incomplete. Reply to your receipt and we'll sort it out." };
  }

  const { data: inserted, error } = await db
    .from("public_plan_purchases")
    .insert({
      email,
      plan_id: TOTE_PLAN_ID,
      tier,
      build_config: design,
      stripe_session_id: sessionId,
      customer_name: session.customer_details?.name?.trim() || null,
      email_sent: false,
      referred_by_promoter_id: session.metadata.promoter_id || null,
      promoter_referral_code_snapshot: session.metadata.promoter_referral_code || null,
    })
    .select(PURCHASE_COLUMNS)
    .single();

  if (error || !inserted) {
    // Lost a race with a concurrent load of the same session — use its row.
    if ((error as { code?: string } | null)?.code === "23505") {
      const { data: winner } = await db
        .from("public_plan_purchases")
        .select(PURCHASE_COLUMNS)
        .eq("stripe_session_id", sessionId)
        .single();
      if (winner) return gated(winner as PurchaseRow);
    }
    console.error("[TotePlanAccess] Insert error:", error);
    return { ok: false, error: "We couldn't record your purchase. Please refresh the page." };
  }

  const row = inserted as PurchaseRow;
  // The buyer just paid on this device — remember it.
  await checkPlanDevice(row.email, { trusted: true });
  // Awaited: a send left running after the response can be dropped by the
  // serverless runtime, and email_sent must only be true when it went out.
  const sent = await sendTotePlanAccessEmail(email, design, tier, row.access_token).catch((err) => {
    console.error("[TotePlanAccess] Email error:", err);
    return null;
  });
  if (sent?.success) {
    await db.from("public_plan_purchases").update({ email_sent: true }).eq("access_token", row.access_token);
  } else if (sent) {
    console.error("[TotePlanAccess] Email not sent:", sent.error);
  }

  return buildResult(row, { emailSentTo: email });
}

async function openFromToken(token: string, upgradeSessionId?: string): Promise<OpenTotePlanResult> {
  const row = await findByToken(token);
  if (!row) return { ok: false, error: "This link is invalid or has expired." };
  const device = await checkPlanDevice(row.email);
  if (!device.ok) return needsCode(row, device.emailHint);

  // A PDF → guide upgrade paid before All-Access: record it (the plan
  // opens with full access either way).
  if (upgradeSessionId && row.tier === "pdf") await applyUpgrade(row, upgradeSessionId);
  return buildResult(row);
}

function needsCode(row: PurchaseRow, emailHint: string): OpenTotePlanResult {
  return {
    ok: false,
    error: "Confirm it's you to open these plans on this device.",
    verify: { token: row.access_token, emailHint },
  };
}

/**
 * A reload of the Stripe return URL. Only the first load (the buyer's own
 * device, straight from paying) is trusted; after that a session id is
 * just another link.
 */
async function gated(row: PurchaseRow): Promise<OpenTotePlanResult> {
  const device = await checkPlanDevice(row.email);
  if (!device.ok) return needsCode(row, device.emailHint);
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

// ═══════════════════════════════════════════════════════════════════════════
// All-Access: more plans, included
// ═══════════════════════════════════════════════════════════════════════════

export type AllAccessResult =
  | { ok: true; emailHint: string }
  | { ok: false; error: string; verify?: { token: string; emailHint: string } };

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return domain ? `${user.slice(0, 2)}•••@${domain}` : "your email";
}

/** The tote purchase behind an access link, if it unlocks All-Access on this device. */
async function allAccessRow(
  token: string
): Promise<{ row: PurchaseRow } | { error: string; verify?: { token: string; emailHint: string } }> {
  const row = await findByToken(token);
  if (!row || row.plan_id !== TOTE_PLAN_ID) return { error: "This link isn't for a tote organizer plan." };
  const device = await checkPlanDevice(row.email);
  if (!device.ok) {
    return {
      error: "Confirm it's you to use your plans on this device.",
      verify: { token: row.access_token, emailHint: device.emailHint },
    };
  }
  return { row };
}

/** Does this link unlock free plans? (The designer asks before showing "Generate — included".) */
export async function checkAllAccess(token: string): Promise<AllAccessResult> {
  try {
    const found = await allAccessRow(token);
    if ("error" in found) return { ok: false, ...found };
    return { ok: true, emailHint: maskEmail(found.row.email) };
  } catch (err) {
    console.error("[TotePlanAccess] checkAllAccess:", err);
    return { ok: false, error: "We couldn't check your plans. Please try again." };
  }
}

export type IncludedPlanResult =
  | { ok: true; token: string }
  | { ok: false; error: string; verify?: { token: string; emailHint: string } };

/**
 * "Build another plan": a plan for a new design, at no charge, for anyone
 * whose link is a tote plan purchase. The new plan is its own row (own
 * access link, same email), so it shows up in My Builds and opens like any
 * other. Asking twice for the same design returns the plan already made.
 */
export async function createIncludedPlan(token: string, rawDesign: unknown): Promise<IncludedPlanResult> {
  try {
    await enforceActionRateLimit({
      action: "tote-plan-included",
      limit: 30,
      window: "1 h",
      identify: "user-or-ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  try {
    const design = parseTotePlanDesign(rawDesign);
    if (!design) {
      return {
        ok: false,
        error: `Plans cover up to ${TOTE_PLAN_LIMITS.maxUnits} standard tote units, each up to ${TOTE_PLAN_LIMITS.maxCols} wide × ${TOTE_PLAN_LIMITS.maxRows} tall.`,
      };
    }
    const found = await allAccessRow(token);
    if ("error" in found) return { ok: false, ...found };
    const { row } = found;
    const db = getServiceClient();

    // Same design already in their plans? Open that one.
    const wanted = encodeTotePlanDesign(design);
    const { data: owned } = await db
      .from("public_plan_purchases")
      .select("access_token, build_config")
      .eq("email", row.email)
      .eq("plan_id", TOTE_PLAN_ID);
    for (const o of (owned ?? []) as { access_token: string; build_config: unknown }[]) {
      const d = parseTotePlanDesign(o.build_config);
      if (d && encodeTotePlanDesign(d) === wanted) return { ok: true, token: o.access_token };
    }

    const { data: inserted, error } = await db
      .from("public_plan_purchases")
      .insert({
        email: row.email,
        plan_id: TOTE_PLAN_ID,
        tier: TOTE_PLAN_ALL_ACCESS_TIER,
        build_config: design,
        // NOT NULL and unique; included plans have no Stripe session.
        stripe_session_id: `included_${crypto.randomUUID()}`,
        customer_name: row.customer_name,
        // Nothing to email: it opens right away and lives in My Builds.
        email_sent: true,
        included_from: row.included_from ?? row.access_token,
      })
      .select("access_token")
      .single();
    if (error || !inserted) {
      console.error("[TotePlanAccess] Included plan insert failed:", error);
      return { ok: false, error: "We couldn't create that plan. Please try again." };
    }
    return { ok: true, token: inserted.access_token as string };
  } catch (err) {
    console.error("[TotePlanAccess] createIncludedPlan:", err);
    return { ok: false, error: "We couldn't create that plan. Please try again." };
  }
}
