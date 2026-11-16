"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Gift DIY plans: the server actions behind /plans/gift
//
//   createGiftCheckout   validate the order, save the recipients, open a
//                        Stripe Embedded Checkout for N × All-Access
//   loadGiftOrder        the "gifts sent" page: by session id (straight
//                        from paying) or the manage token (receipt email).
//                        Fulfils the order if nothing else has yet.
//   resendGiftEmail      gifter: send one recipient's email again
//   fixGiftEmail         gifter: correct a mistyped address before opening
//   loadGiftWelcome      recipient: who it's from + where to start
//   recordGiftOpened     recipient's page ran in a browser
//
// Delivery logic lives in @/lib/server/plan-gifts.
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "stripe";
import { stripeConfig } from "@/lib/stripe/http";
import { FINAL_SALE_TEXT, createEmbeddedCheckoutSession } from "@/lib/stripe/embedded-checkout";
import { siteConfig } from "@/config/site";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { resolvePromoterAttributionForCheckout } from "@/app/actions/promoter-program";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import { TOTE_PLAN_ALL_ACCESS, TOTE_PLAN_ALL_ACCESS_TIER, TOTE_PLAN_ID } from "@/lib/tote-plans";
import {
  GIFT_UNIT_PRICE,
  giftTotalCents,
  parseGiftOrder,
  recipientListLabel,
  type GiftFieldErrors,
  type GiftOrderView,
} from "@/lib/plan-gifts";
import {
  GIFT_SESSION_TYPE,
  correctGiftEmail,
  fulfilGiftSession,
  giftOrderView,
  giftWelcome,
  giftsForOrder,
  markGiftOpened,
  orderByManageToken,
  orderBySession,
  resendGift,
  type GiftWelcome,
} from "@/lib/server/plan-gifts";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { ...stripeConfig(), apiVersion: "2025-12-15.clover" });
  return _stripe;
}

async function limited(action: string, limit: number, window: "60 s" | "1 h"): Promise<string | null> {
  try {
    await enforceActionRateLimit({ action, limit, window, identify: "user-or-ip" });
    return null;
  } catch (err) {
    if (err instanceof RateLimitError) return err.message;
    throw err;
  }
}

// ── Checkout ─────────────────────────────────────────────────────────────────

export type GiftCheckoutResult =
  | { ok: true; clientSecret: string }
  | { ok: false; error: string; fields?: GiftFieldErrors };

export async function createGiftCheckout(rawOrder: unknown, rawVisitorId?: unknown): Promise<GiftCheckoutResult> {
  const slow = await limited("plan-gift-checkout", 10, "60 s");
  if (slow) return { ok: false, error: slow };

  const parsed = parseGiftOrder(rawOrder);
  if (!parsed.ok) return { ok: false, error: parsed.error, fields: parsed.fields };
  const { gifterName, gifterEmail, message, recipients } = parsed.order;
  const quantity = recipients.length;
  const amount = giftTotalCents(quantity);
  const visitorId =
    typeof rawVisitorId === "string" && /^[\w-]{1,64}$/.test(rawVisitorId) ? rawVisitorId : null;

  const db = getServiceClient();
  try {
    const buyer = await getAuthenticatedUser();
    const attribution = await resolvePromoterAttributionForCheckout(buyer?.id ?? null);

    // 1. The order and its recipients, before Stripe (metadata can't hold them).
    const { data: order, error: orderErr } = await db
      .from("plan_gift_orders")
      .insert({
        gifter_name: gifterName,
        gifter_email: gifterEmail,
        message,
        quantity,
        unit_amount_cents: GIFT_UNIT_PRICE,
        amount_cents: amount,
        promoter_id: attribution?.promoterId ?? null,
        visitor_id: visitorId,
      })
      .select("id")
      .single();
    if (orderErr || !order) {
      console.error("[PlanGifts] Order insert failed:", orderErr);
      return { ok: false, error: "We couldn't start your order. Please try again." };
    }
    const orderId = (order as { id: string }).id;

    const { error: giftsErr } = await db.from("plan_gifts").insert(
      recipients.map((r, i) => ({
        order_id: orderId,
        position: i + 1,
        recipient_name: r.name,
        recipient_email: r.email,
      }))
    );
    if (giftsErr) {
      console.error("[PlanGifts] Recipients insert failed:", giftsErr);
      await db.from("plan_gift_orders").delete().eq("id", orderId);
      return { ok: false, error: "We couldn't save the recipients. Please try again." };
    }

    // 2. One session, quantity N, priced here.
    const names = recipientListLabel(recipients.map((r) => r.name), 4);
    const session = await createEmbeddedCheckoutSession(getStripe(), {
      mode: "payment",
      customer_email: gifterEmail,
      custom_text: FINAL_SALE_TEXT,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Gift: ${TOTE_PLAN_ALL_ACCESS.name}`,
              description: `Lifetime DIY tote rack plans, emailed to ${names}. Each person gets their own access: unlimited plans, 3D guide + printable PDF.`.slice(
                0,
                500
              ),
            },
            unit_amount: GIFT_UNIT_PRICE,
          },
          quantity,
        },
      ],
      return_url: `${siteConfig.baseUrl}/plans/gift/sent?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        type: GIFT_SESSION_TYPE,
        gift_order_id: orderId,
        plan_id: TOTE_PLAN_ID,
        tier: TOTE_PLAN_ALL_ACCESS_TIER,
        quantity: String(quantity),
        ...(attribution ? { promoter_id: attribution.promoterId, promoter_referral_code: attribution.code } : {}),
      },
      payment_intent_data: {
        description: `Gift DIY plans x${quantity} (${orderId.slice(0, 8)})`,
        metadata: { type: GIFT_SESSION_TYPE, gift_order_id: orderId },
      },
    });
    if (!session.client_secret) {
      return { ok: false, error: "We couldn't open checkout. Please try again." };
    }

    const { error: linkErr } = await db
      .from("plan_gift_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderId);
    if (linkErr) {
      // Without this link the payment can't be matched to the recipients.
      console.error("[PlanGifts] Session link failed:", orderId, linkErr);
      await getStripe().checkout.sessions.expire(session.id).catch(() => {});
      return { ok: false, error: "We couldn't open checkout. Please try again." };
    }

    // Funnel analytics (best-effort): this gifter reached the payment form.
    const { error: startErr } = await db.from("plan_checkout_starts").insert({
      stripe_session_id: session.id,
      plan_id: TOTE_PLAN_ID,
      tier: TOTE_PLAN_ALL_ACCESS_TIER,
      amount_cents: amount,
      visitor_id: visitorId,
    });
    if (startErr) console.error("[PlanGifts] checkout-start log failed:", startErr.message);

    return { ok: true, clientSecret: session.client_secret };
  } catch (err) {
    console.error("[PlanGifts] Checkout error:", err);
    return { ok: false, error: "We couldn't open checkout. Please try again." };
  }
}

// ── Gifter's page ────────────────────────────────────────────────────────────

export type GiftOrderResult =
  | { ok: true; view: GiftOrderView; manageToken: string }
  | { ok: false; error: string; pending?: boolean };

export async function loadGiftOrder(input: { sessionId?: string; manageToken?: string }): Promise<GiftOrderResult> {
  const slow = await limited("plan-gift-view", 60, "60 s");
  if (slow) return { ok: false, error: slow };
  try {
    const order = input.manageToken
      ? await orderByManageToken(input.manageToken)
      : input.sessionId
        ? await orderBySession(input.sessionId)
        : null;
    if (!order) return { ok: false, error: "We couldn't find this gift order. Check the link in your receipt email." };

    // Not fulfilled yet (or a send still owed)? Do it now: the webhook may be
    // late, and the gifter is looking at the page.
    let gifts = await giftsForOrder(order.id);
    const owed =
      order.status !== "paid" || gifts.some((g) => !g.purchase_token || g.email_status === "pending") || !order.receipt_claimed_at;
    if (owed && order.stripe_session_id) {
      const session = await getStripe().checkout.sessions.retrieve(order.stripe_session_id);
      if (session.payment_status === "paid") {
        const done = await fulfilGiftSession(session);
        if (done.ok) {
          Object.assign(order, done.order);
          gifts = await giftsForOrder(order.id);
        } else {
          return { ok: false, error: done.error };
        }
      } else if (order.status !== "paid") {
        return {
          ok: false,
          pending: true,
          error:
            session.status === "open"
              ? "This order hasn't been paid yet."
              : session.status === "expired"
                ? "This checkout expired before payment, so nothing was charged."
                : "We're still confirming your payment. This page will update in a moment.",
        };
      }
    }
    return { ok: true, view: await giftOrderView(order, gifts), manageToken: order.manage_token };
  } catch (err) {
    console.error("[PlanGifts] loadGiftOrder:", err);
    return { ok: false, error: "We couldn't load your gift order. Please refresh the page." };
  }
}

export type GiftControlResult = { ok: true; view: GiftOrderView } | { ok: false; error: string };

export async function resendGiftEmail(manageToken: string, giftId: string): Promise<GiftControlResult> {
  const slow = await limited("plan-gift-resend", 12, "1 h");
  if (slow) return { ok: false, error: slow };
  try {
    return await resendGift(manageToken, giftId);
  } catch (err) {
    console.error("[PlanGifts] resend:", err);
    return { ok: false, error: "We couldn't resend that email. Please try again." };
  }
}

export async function fixGiftEmail(
  manageToken: string,
  giftId: string,
  email: unknown,
  name?: unknown
): Promise<GiftControlResult> {
  const slow = await limited("plan-gift-fix-email", 10, "1 h");
  if (slow) return { ok: false, error: slow };
  try {
    return await correctGiftEmail(manageToken, giftId, email, name);
  } catch (err) {
    console.error("[PlanGifts] fix email:", err);
    return { ok: false, error: "We couldn't update that address. Please try again." };
  }
}

// ── Recipient's page ─────────────────────────────────────────────────────────

export async function loadGiftWelcome(token: string): Promise<GiftWelcome | null> {
  try {
    return await giftWelcome(token);
  } catch (err) {
    console.error("[PlanGifts] welcome:", err);
    return null;
  }
}

export async function recordGiftOpened(token: unknown): Promise<void> {
  if (typeof token !== "string") return;
  try {
    await markGiftOpened(token);
  } catch (err) {
    console.error("[PlanGifts] opened:", err);
  }
}
