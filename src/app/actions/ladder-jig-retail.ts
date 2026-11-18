"use server";

// ═══════════════════════════════════════════════════════════════════════════
// LADDER JIG (RETAIL) — offer, checkout and gated delivery
//
//   getLadderJigOffer(ownerToken?)      price for this visitor ($5 for a
//                                       verified tote plan owner, else $9)
//   createLadderJigCheckout(ownerToken?) Stripe Checkout at that price
//   openLadderJig({sessionId}|{token})  verifies payment / access token and
//                                       only then returns the guide content
//
// The discount is decided here from a tote plan access token that must
// exist in public_plan_purchases — never from anything the client claims.
// Purchases live in public_plan_purchases (plan_id = 'ladder-jig') so they
// show up in the buyer's My Builds library and "Resend my link".
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "stripe";
import { stripeConfig } from "@/lib/stripe/http";
import { FINAL_SALE_TEXT, createEmbeddedCheckoutSession } from "@/lib/stripe/embedded-checkout";
import { siteConfig } from "@/config/site";
import { fulfilPlanSession, isFreshPurchase } from "@/lib/server/plan-fulfilment";
import { getServiceClient } from "@/lib/supabase-server";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import { checkPlanDevice } from "@/lib/server/plan-device";
import { recordPlanActivity } from "@/lib/server/plan-activity";
import { ladderJigContent, type LadderJigContent } from "@/lib/ladder-jig-content";
import {
  LADDER_JIG_NAME,
  LADDER_JIG_OWNER_PRICE,
  LADDER_JIG_PLAN_ID,
  LADDER_JIG_PRICE,
  LADDER_JIG_TAGLINE,
} from "@/lib/ladder-jig";
import { TOTE_PLAN_ID } from "@/lib/tote-plans";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, stripeConfig());
  return _stripe;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Row {
  access_token: string;
  email: string;
  plan_id: string;
}

async function rowByToken(token: string | null | undefined): Promise<Row | null> {
  if (!token || !UUID_RE.test(token)) return null;
  const { data } = await getServiceClient()
    .from("public_plan_purchases")
    .select("access_token, email, plan_id")
    .eq("access_token", token)
    .maybeSingle();
  return (data as Row | null) ?? null;
}

/** The buyer's existing jig purchase, if any (same email as the owner token). */
async function existingJigFor(email: string): Promise<Row | null> {
  const { data } = await getServiceClient()
    .from("public_plan_purchases")
    .select("access_token, email, plan_id")
    .eq("email", email)
    .eq("plan_id", LADDER_JIG_PLAN_ID)
    .limit(1)
    .maybeSingle();
  return (data as Row | null) ?? null;
}

export interface LadderJigOffer {
  price: number;
  regularPrice: number;
  /** True when the visitor's tote plan earned them the owner price */
  ownerDiscount: boolean;
  /** When this owner already bought the jig — open it instead of selling it again */
  ownedJigToken?: string;
}

export async function getLadderJigOffer(ownerToken?: string | null): Promise<LadderJigOffer> {
  const regular = { price: LADDER_JIG_PRICE, regularPrice: LADDER_JIG_PRICE, ownerDiscount: false };
  try {
    const owner = await rowByToken(ownerToken);
    if (!owner) return regular;
    if (owner.plan_id === LADDER_JIG_PLAN_ID) return { ...regular, ownedJigToken: owner.access_token };
    if (owner.plan_id !== TOTE_PLAN_ID) return regular;
    const jig = await existingJigFor(owner.email);
    return {
      price: LADDER_JIG_OWNER_PRICE,
      regularPrice: LADDER_JIG_PRICE,
      ownerDiscount: true,
      ...(jig ? { ownedJigToken: jig.access_token } : {}),
    };
  } catch (err) {
    console.error("[LadderJig] Offer lookup failed:", err);
    return regular;
  }
}

export async function createLadderJigCheckout(
  ownerToken?: string | null,
): Promise<{ success: boolean; clientSecret?: string; error?: string }> {
  try {
    await enforceActionRateLimit({ action: "ladder-jig-checkout", limit: 10, window: "60 s", identify: "user-or-ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { success: false, error: err.message };
    throw err;
  }

  // Price is decided server-side from a verified tote plan token.
  const owner = await rowByToken(ownerToken);
  const isOwner = owner?.plan_id === TOTE_PLAN_ID;
  const price = isOwner ? LADDER_JIG_OWNER_PRICE : LADDER_JIG_PRICE;

  try {
    const baseUrl = siteConfig.baseUrl;
    const back = isOwner ? `${baseUrl}/plans/jig?owner=${owner!.access_token}` : `${baseUrl}/plans/jig`;
    const session = await createEmbeddedCheckoutSession(getStripe(), {
      mode: "payment",
      custom_text: FINAL_SALE_TEXT,
      ...(isOwner ? { customer_email: owner!.email } : {}),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${LADDER_JIG_NAME} — Plans`,
              description: `${LADDER_JIG_TAGLINE} Cut plan, materials list and build steps, marked for 2×4 rails.`,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/plans/jig?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${back}${back.includes("?") ? "&" : "?"}cancelled=1`,
      metadata: {
        type: "ladder_jig",
        plan_id: LADDER_JIG_PLAN_ID,
        ...(isOwner ? { owner_token: owner!.access_token } : {}),
      },
    });
    if (!session.client_secret) return { success: false, error: "Failed to create checkout session." };
    return { success: true, clientSecret: session.client_secret };
  } catch (err) {
    console.error("[LadderJig] Checkout error:", err);
    return { success: false, error: "Failed to create checkout. Please try again." };
  }
}

export type OpenLadderJigResult =
  | {
      ok: true;
      token: string;
      content: LadderJigContent;
      emailSentTo?: string;
      /** Buyer email + order ref, stamped on every page of the PDF */
      license: { email: string; order: string };
    }
  | { ok: false; error: string; verify?: { token: string; emailHint: string } };

/** "SN-3F9A2C1B": the same order reference the tote plan PDFs carry. */
function licenseFor(row: { email: string; access_token: string }): { email: string; order: string } {
  return { email: row.email, order: `SN-${row.access_token.replace(/-/g, "").slice(0, 8).toUpperCase()}` };
}

/** Purchases pass the device gate (@/lib/server/plan-device). */
async function gatedJig(row: Row, extras: { emailSentTo?: string } = {}): Promise<OpenLadderJigResult> {
  const device = await checkPlanDevice(row.email);
  if (!device.ok) {
    await recordPlanActivity(row, "open_needs_code", { detail: "jig" });
    return {
      ok: false,
      error: "Confirm it's you to open these plans on this device.",
      verify: { token: row.access_token, emailHint: device.emailHint },
    };
  }
  await recordPlanActivity(row, "jig_open", { detail: "link" });
  return { ok: true, token: row.access_token, content: ladderJigContent(), license: licenseFor(row), ...extras };
}

export async function openLadderJig(input: { sessionId: string } | { token: string }): Promise<OpenLadderJigResult> {
  try {
    if ("token" in input) {
      const row = await rowByToken(input.token);
      if (!row || row.plan_id !== LADDER_JIG_PLAN_ID) return { ok: false, error: "This link is invalid or has expired." };
      return gatedJig(row);
    }

    // The webhook usually records the purchase first; either way the row is
    // made once and the email sent once (plan-fulfilment).
    const session = await getStripe().checkout.sessions.retrieve(input.sessionId);
    if (session.metadata?.type !== "ladder_jig") return { ok: false, error: "We couldn't confirm that payment." };
    const done = await fulfilPlanSession(session);
    if (!done.ok) return done;
    // Back from paying shortly after: this is the buyer's device.
    if (!isFreshPurchase(done.row)) return gatedJig(done.row as Row);
    await checkPlanDevice(done.email, { trusted: true });
    await recordPlanActivity(done.row, "jig_open", { detail: "checkout" });
    return {
      ok: true,
      token: done.row.access_token,
      content: ladderJigContent(),
      emailSentTo: done.email,
      license: licenseFor(done.row),
    };
  } catch (err) {
    console.error("[LadderJig] Open failed:", err);
    return { ok: false, error: "We couldn't load your plans. Please try again." };
  }
}
