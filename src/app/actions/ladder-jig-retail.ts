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
import { siteConfig } from "@/config/site";
import { getServiceClient } from "@/lib/supabase-server";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import { sendLadderJigAccessEmail } from "@/lib/emails/plansTemplates";
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
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
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
): Promise<{ success: boolean; url?: string; error?: string }> {
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
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
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
    if (!session.url) return { success: false, error: "Failed to create checkout session." };
    return { success: true, url: session.url };
  } catch (err) {
    console.error("[LadderJig] Checkout error:", err);
    return { success: false, error: "Failed to create checkout. Please try again." };
  }
}

export type OpenLadderJigResult =
  | { ok: true; token: string; content: LadderJigContent; emailSentTo?: string }
  | { ok: false; error: string };

export async function openLadderJig(input: { sessionId: string } | { token: string }): Promise<OpenLadderJigResult> {
  try {
    if ("token" in input) {
      const row = await rowByToken(input.token);
      if (!row || row.plan_id !== LADDER_JIG_PLAN_ID) return { ok: false, error: "This link is invalid or has expired." };
      return { ok: true, token: row.access_token, content: ladderJigContent() };
    }

    const db = getServiceClient();
    const { data: existing } = await db
      .from("public_plan_purchases")
      .select("access_token, email, plan_id")
      .eq("stripe_session_id", input.sessionId)
      .maybeSingle();
    if (existing) return { ok: true, token: (existing as Row).access_token, content: ladderJigContent() };

    const session = await getStripe().checkout.sessions.retrieve(input.sessionId);
    if (session.payment_status !== "paid" || session.metadata?.type !== "ladder_jig") {
      return { ok: false, error: "We couldn't confirm that payment." };
    }
    const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase();
    if (!email) return { ok: false, error: "Your payment went through but the order is incomplete. Reply to your receipt and we'll sort it out." };

    const { data: inserted, error } = await db
      .from("public_plan_purchases")
      .insert({ email, plan_id: LADDER_JIG_PLAN_ID, stripe_session_id: input.sessionId, email_sent: false })
      .select("access_token, email, plan_id")
      .single();
    if (error || !inserted) {
      if ((error as { code?: string } | null)?.code === "23505") {
        const { data: winner } = await db
          .from("public_plan_purchases")
          .select("access_token")
          .eq("stripe_session_id", input.sessionId)
          .single();
        if (winner) return { ok: true, token: winner.access_token as string, content: ladderJigContent() };
      }
      console.error("[LadderJig] Insert error:", error);
      return { ok: false, error: "We couldn't record your purchase. Please refresh the page." };
    }

    const token = (inserted as Row).access_token;
    sendLadderJigAccessEmail(email, token)
      .then(() => db.from("public_plan_purchases").update({ email_sent: true }).eq("access_token", token))
      .catch((err) => console.error("[LadderJig] Email error:", err));
    return { ok: true, token, content: ladderJigContent(), emailSentTo: email };
  } catch (err) {
    console.error("[LadderJig] Open failed:", err);
    return { ok: false, error: "We couldn't load your plans. Please try again." };
  }
}
