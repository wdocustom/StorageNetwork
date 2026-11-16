import "server-only";

// ═══════════════════════════════════════════════════════════════════════════
// Gift DIY plans: fulfilment, delivery and the gifter's controls
//
// Order of events for one paid gift session (type "diy_plan_gift"):
//   1. The order flips to "paid" (once).
//   2. Every recipient gets their own public_plan_purchases row under THEIR
//      email: a full All-Access purchase (starter plan = the default 4×4;
//      they design their own from the gift page). Idempotent on the
//      per-recipient stripe_session_id "<cs_…>__gift_<n>".
//   3. Every recipient gets their own email. A send is CLAIMED first
//      (pending → sending) so two callers racing (webhook + return page)
//      never send it twice; it ends "sent" or "failed".
//   4. The gifter's receipt goes out once (receipt_claimed_at), listing who
//      was emailed, how to follow up, and the link back to their gift page.
//
// Three callers, all idempotent: the Stripe webhook, the gifter's return to
// /plans/gift/sent, and the hourly plan reconcile (which also retries failed
// or stuck sends, a few times, never forever).
// ═══════════════════════════════════════════════════════════════════════════

import type Stripe from "stripe";
import { getServiceClient } from "@/lib/supabase-server";
import { getAppUrl } from "@/lib/url-helper";
import { sendGiftReceiptEmail, sendGiftRecipientEmail } from "@/lib/emails/giftTemplates";
import { activityOwnerByToken, recordPlanActivity } from "@/lib/server/plan-activity";
import { DEFAULT_TOTE_PLAN_DESIGN, TOTE_PLAN_ALL_ACCESS_TIER, TOTE_PLAN_ID } from "@/lib/tote-plans";
import {
  GIFT_MAX_EMAIL_CORRECTIONS,
  GIFT_MAX_RESENDS,
  GIFT_RESEND_COOLDOWN_MS,
  cleanPersonName,
  giftManagePath,
  giftOpenPath,
  giftOrderRef,
  isValidEmail,
  normalizeEmail,
  type GiftDeliveryStatus,
  type GiftOrderView,
  type GiftRecipientView,
} from "@/lib/plan-gifts";

export const GIFT_SESSION_TYPE = "diy_plan_gift";
/** Automatic delivery attempts per recipient (the gifter can still resend by hand). */
export const GIFT_MAX_AUTO_ATTEMPTS = 3;
/** A send "sending" for longer than this was cut off mid-flight: retry it. */
const STUCK_SEND_MS = 10 * 60 * 1000;

export const ORDER_COLUMNS =
  "id, stripe_session_id, manage_token, gifter_name, gifter_email, message, quantity, amount_cents, status, paid_at, receipt_claimed_at, receipt_sent_at, promoter_id";
export const GIFT_COLUMNS =
  "id, order_id, position, recipient_name, recipient_email, purchase_token, email_status, email_attempts, email_error, email_claimed_at, sent_at, resend_count, last_resent_at, email_corrections, opened_at";

export interface GiftOrderRow {
  id: string;
  stripe_session_id: string | null;
  manage_token: string;
  gifter_name: string;
  gifter_email: string;
  message: string | null;
  quantity: number;
  amount_cents: number;
  status: "pending" | "paid";
  paid_at: string | null;
  receipt_claimed_at: string | null;
  receipt_sent_at: string | null;
  promoter_id: string | null;
}

export interface GiftRow {
  id: string;
  order_id: string;
  position: number;
  recipient_name: string;
  recipient_email: string;
  purchase_token: string | null;
  email_status: "pending" | "sending" | "sent" | "failed";
  email_attempts: number;
  email_error: string | null;
  email_claimed_at: string | null;
  sent_at: string | null;
  resend_count: number;
  last_resent_at: string | null;
  email_corrections: number;
  opened_at: string | null;
}

/** Purchase row id for one recipient of a gift session: unique, NOT NULL, maps back to the session. */
export const giftPurchaseSessionId = (sessionId: string, position: number) => `${sessionId}__gift_${position}`;

/** "cs_123__gift_2" → "cs_123" (analytics joins purchases to checkout starts by session). */
export const baseSessionId = (id: string) => id.split("__gift_")[0];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

// ── Loading ──────────────────────────────────────────────────────────────────

export async function orderById(id: string): Promise<GiftOrderRow | null> {
  if (!isUuid(id)) return null;
  const { data } = await getServiceClient().from("plan_gift_orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();
  return (data as GiftOrderRow | null) ?? null;
}

export async function orderBySession(sessionId: string): Promise<GiftOrderRow | null> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;
  const { data } = await getServiceClient()
    .from("plan_gift_orders")
    .select(ORDER_COLUMNS)
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  return (data as GiftOrderRow | null) ?? null;
}

export async function orderByManageToken(token: string): Promise<GiftOrderRow | null> {
  if (!isUuid(token)) return null;
  const { data } = await getServiceClient()
    .from("plan_gift_orders")
    .select(ORDER_COLUMNS)
    .eq("manage_token", token)
    .maybeSingle();
  return (data as GiftOrderRow | null) ?? null;
}

export async function giftsForOrder(orderId: string): Promise<GiftRow[]> {
  const { data } = await getServiceClient()
    .from("plan_gifts")
    .select(GIFT_COLUMNS)
    .eq("order_id", orderId)
    .order("position", { ascending: true });
  return (data as GiftRow[] | null) ?? [];
}

// ── Fulfilment ───────────────────────────────────────────────────────────────

export type GiftFulfilResult =
  | { ok: true; order: GiftOrderRow; gifts: GiftRow[] }
  | { ok: false; error: string };

export async function fulfilGiftSession(
  session: Stripe.Checkout.Session,
  opts: { retryFailed?: boolean } = {}
): Promise<GiftFulfilResult> {
  if (session.metadata?.type !== GIFT_SESSION_TYPE) return { ok: false, error: "Not a gift purchase." };
  const order = await orderById(session.metadata.gift_order_id ?? "");
  // The order must be the one this session was created for.
  if (!order || order.stripe_session_id !== session.id) {
    console.error("[PlanGifts] Session has no matching order:", session.id);
    return { ok: false, error: "We couldn't find this gift order. Reply to your receipt and we'll sort it out." };
  }
  if (session.payment_status !== "paid") return { ok: false, error: "We couldn't confirm that payment." };

  const db = getServiceClient();
  // When they paid, not when this ran (the reconcile job can be hours late).
  const paidAt = new Date((session.created || Date.now() / 1000) * 1000).toISOString();
  if (order.status !== "paid") {
    await db.from("plan_gift_orders").update({ status: "paid", paid_at: paidAt }).eq("id", order.id).eq("status", "pending");
    order.status = "paid";
    order.paid_at = order.paid_at ?? paidAt;
  }

  const gifts = await giftsForOrder(order.id);
  if (!gifts.length) {
    console.error("[PlanGifts] Paid order has no recipients:", order.id);
    return { ok: false, error: "This gift order has no recipients. Reply to your receipt and we'll sort it out." };
  }

  for (const gift of gifts) {
    if (!gift.purchase_token) {
      const token = await ensureGiftPurchase(order, gift, session.id, paidAt);
      if (token) gift.purchase_token = token;
    }
  }

  for (const gift of gifts) {
    if (!gift.purchase_token) continue;
    const delivered = await deliverGift(order, gift, { retryFailed: opts.retryFailed, allowStuck: opts.retryFailed });
    if (delivered) Object.assign(gift, delivered);
  }

  await sendReceiptOnce(order, gifts);
  return { ok: true, order, gifts };
}

/** The recipient's purchase row (made once); returns its access token. */
async function ensureGiftPurchase(
  order: GiftOrderRow,
  gift: GiftRow,
  sessionId: string,
  purchasedAt: string
): Promise<string | null> {
  const db = getServiceClient();
  const stripeSessionId = giftPurchaseSessionId(sessionId, gift.position);
  const { data: inserted, error } = await db
    .from("public_plan_purchases")
    .insert({
      email: gift.recipient_email,
      plan_id: TOTE_PLAN_ID,
      tier: TOTE_PLAN_ALL_ACCESS_TIER,
      // A starting plan; the gift page sends them to design their own (included).
      build_config: DEFAULT_TOTE_PLAN_DESIGN,
      stripe_session_id: stripeSessionId,
      customer_name: gift.recipient_name,
      // The gift email is tracked on plan_gifts, not here.
      email_sent: false,
      gift_id: gift.id,
      referred_by_promoter_id: order.promoter_id,
      purchased_at: purchasedAt,
    })
    .select("access_token")
    .single();

  let token = (inserted as { access_token: string } | null)?.access_token ?? null;
  if (!token) {
    if ((error as { code?: string } | null)?.code !== "23505") {
      console.error("[PlanGifts] Purchase insert failed:", gift.id, error);
      return null;
    }
    // Another caller made it first: use theirs.
    const { data: existing } = await db
      .from("public_plan_purchases")
      .select("access_token")
      .eq("stripe_session_id", stripeSessionId)
      .maybeSingle();
    token = (existing as { access_token: string } | null)?.access_token ?? null;
    if (!token) return null;
  }

  await db.from("plan_gifts").update({ purchase_token: token }).eq("id", gift.id).is("purchase_token", null);
  return token;
}

/**
 * Claim one recipient's email and send it. Returns the updated fields, or
 * null when someone else holds (or already finished) the send.
 */
async function deliverGift(
  order: GiftOrderRow,
  gift: GiftRow,
  opts: { retryFailed?: boolean; allowStuck?: boolean; force?: boolean } = {}
): Promise<Partial<GiftRow> | null> {
  const claimed = await claimSend(gift, opts);
  if (!claimed) return null;
  return sendClaimed(order, { ...gift, ...claimed });
}

async function claimSend(
  gift: GiftRow,
  opts: { retryFailed?: boolean; allowStuck?: boolean; force?: boolean }
): Promise<Partial<GiftRow> | null> {
  const db = getServiceClient();
  const now = new Date().toISOString();
  const claim = { email_status: "sending", email_claimed_at: now };

  // Gifter's resend: any finished state.
  if (opts.force) {
    const { data } = await db
      .from("plan_gifts")
      .update(claim)
      .eq("id", gift.id)
      .in("email_status", ["sent", "failed", "pending"])
      .select(GIFT_COLUMNS);
    return (data as GiftRow[] | null)?.[0] ?? null;
  }

  const states = opts.retryFailed ? ["pending", "failed"] : ["pending"];
  const { data } = await db
    .from("plan_gifts")
    .update(claim)
    .eq("id", gift.id)
    .in("email_status", states)
    .lt("email_attempts", GIFT_MAX_AUTO_ATTEMPTS)
    .select(GIFT_COLUMNS);
  const row = (data as GiftRow[] | null)?.[0];
  if (row) return row;

  if (opts.allowStuck) {
    const cutoff = new Date(Date.now() - STUCK_SEND_MS).toISOString();
    const { data: stuck } = await db
      .from("plan_gifts")
      .update(claim)
      .eq("id", gift.id)
      .eq("email_status", "sending")
      .lt("email_claimed_at", cutoff)
      .lt("email_attempts", GIFT_MAX_AUTO_ATTEMPTS)
      .select(GIFT_COLUMNS);
    return (stuck as GiftRow[] | null)?.[0] ?? null;
  }
  return null;
}

async function sendClaimed(order: GiftOrderRow, gift: GiftRow): Promise<Partial<GiftRow>> {
  // Awaited: a send left running after the response can be dropped by the
  // runtime, and "sent" must only be recorded when it went out.
  const sent = await sendGiftRecipientEmail({
    to: gift.recipient_email,
    recipientName: gift.recipient_name,
    gifterName: order.gifter_name,
    gifterEmail: order.gifter_email,
    message: order.message,
    accessToken: gift.purchase_token!,
  }).catch((err) => ({ success: false as const, error: err instanceof Error ? err.message : String(err) }));

  const update: Partial<GiftRow> = sent.success
    ? { email_status: "sent", sent_at: new Date().toISOString(), email_error: null, email_attempts: gift.email_attempts + 1 }
    : { email_status: "failed", email_error: (sent.error ?? "Send failed").slice(0, 300), email_attempts: gift.email_attempts + 1 };
  const { error } = await getServiceClient().from("plan_gifts").update(update).eq("id", gift.id);
  if (error) console.error("[PlanGifts] Status update failed:", gift.id, error);
  if (!sent.success) console.error("[PlanGifts] Recipient email failed:", gift.id, sent.error);
  if (sent.success) {
    await getServiceClient().from("public_plan_purchases").update({ email_sent: true }).eq("access_token", gift.purchase_token!);
  }
  return update;
}

async function sendReceiptOnce(order: GiftOrderRow, local: GiftRow[]): Promise<void> {
  if (order.receipt_claimed_at) return;
  // Read fresh: a concurrent caller may have sent some of these. Wait until
  // every recipient has been tried once, so the receipt is accurate (the
  // reconcile job picks up a receipt that two racing callers both left).
  const fresh = await giftsForOrder(order.id);
  const gifts = fresh.length ? fresh : local;
  if (!gifts.length) return;
  if (gifts.some((g) => !g.purchase_token || g.email_status === "pending" || g.email_status === "sending")) return;

  const db = getServiceClient();
  const now = new Date().toISOString();
  const { data: claimed } = await db
    .from("plan_gift_orders")
    .update({ receipt_claimed_at: now })
    .eq("id", order.id)
    .is("receipt_claimed_at", null)
    .select("id");
  if (!(claimed as unknown[] | null)?.length) return;
  order.receipt_claimed_at = now;

  const sent = await sendGiftReceiptEmail({
    to: order.gifter_email,
    gifterName: order.gifter_name,
    orderId: order.id,
    manageToken: order.manage_token,
    amountCents: order.amount_cents,
    recipients: gifts.map((g) => ({ name: g.recipient_name, email: g.recipient_email, sent: g.email_status === "sent" })),
  }).catch((err) => ({ success: false as const, error: String(err) }));

  if (sent.success) {
    await db.from("plan_gift_orders").update({ receipt_sent_at: new Date().toISOString() }).eq("id", order.id);
    order.receipt_sent_at = new Date().toISOString();
  } else {
    // Release the claim so the next caller (reconcile) tries again.
    console.error("[PlanGifts] Gifter receipt failed:", order.id, sent.error);
    await db.from("plan_gift_orders").update({ receipt_claimed_at: null }).eq("id", order.id);
    order.receipt_claimed_at = null;
  }
}

// ── The gifter's view ────────────────────────────────────────────────────────

function deliveryStatus(g: GiftRow): GiftDeliveryStatus {
  if (!g.purchase_token) return "preparing";
  if (g.email_status === "sent") return "sent";
  if (g.email_status === "failed") return "failed";
  return "sending";
}

export async function canCorrectGiftEmail(g: GiftRow): Promise<boolean> {
  if (!g.purchase_token || g.opened_at || g.email_corrections >= GIFT_MAX_EMAIL_CORRECTIONS) return false;
  if (g.email_status === "sending") return false;
  return !(await giftWasUsed(g));
}

/**
 * Has anyone used this gift? A device registered for the recipient's email
 * since it was sent, or a plan built under it, means the link was opened.
 */
async function giftWasUsed(g: GiftRow): Promise<boolean> {
  const db = getServiceClient();
  const { data: included } = await db
    .from("public_plan_purchases")
    .select("access_token")
    .eq("included_from", g.purchase_token!)
    .limit(1);
  if ((included as unknown[] | null)?.length) return true;
  const since = g.sent_at ?? g.email_claimed_at;
  if (!since) return false;
  const { data: devices } = await db
    .from("plan_buyer_devices")
    .select("id")
    .eq("email", g.recipient_email)
    .gte("created_at", since)
    .limit(1);
  return !!(devices as unknown[] | null)?.length;
}

export async function giftOrderView(order: GiftOrderRow, gifts: GiftRow[]): Promise<GiftOrderView> {
  const appUrl = getAppUrl();
  const now = Date.now();
  const recipients: GiftRecipientView[] = await Promise.all(
    gifts.map(async (g) => {
      const last = g.last_resent_at ?? g.sent_at;
      const wait = last ? Math.max(0, GIFT_RESEND_COOLDOWN_MS - (now - new Date(last).getTime())) : 0;
      const status = deliveryStatus(g);
      const resendsLeft = Math.max(0, GIFT_MAX_RESENDS - g.resend_count);
      return {
        id: g.id,
        position: g.position,
        name: g.recipient_name,
        email: g.recipient_email,
        status,
        sentAt: g.sent_at,
        openedAt: g.opened_at,
        giftUrl: g.purchase_token ? `${appUrl}${giftOpenPath(g.purchase_token)}` : null,
        error: status === "failed" ? "The email didn't go out. Check the address, then resend." : null,
        canResend: order.status === "paid" && (status === "sent" || status === "failed") && resendsLeft > 0,
        resendInSeconds: Math.ceil(wait / 1000),
        resendsLeft,
        canCorrectEmail: order.status === "paid" ? await canCorrectGiftEmail(g) : false,
      };
    })
  );
  return {
    orderRef: giftOrderRef(order.id),
    paid: order.status === "paid",
    gifterName: order.gifter_name,
    gifterEmail: order.gifter_email,
    message: order.message,
    quantity: order.quantity,
    amountCents: order.amount_cents,
    paidAt: order.paid_at,
    manageUrl: `${appUrl}${giftManagePath(order.manage_token)}`,
    receiptSent: !!order.receipt_sent_at,
    recipients,
  };
}

// ── The gifter's controls ────────────────────────────────────────────────────

export type GiftActionResult = { ok: true; view: GiftOrderView } | { ok: false; error: string };

async function loadForAction(
  manageToken: string,
  giftId: string
): Promise<{ order: GiftOrderRow; gifts: GiftRow[]; gift: GiftRow } | { error: string }> {
  const order = await orderByManageToken(manageToken);
  if (!order) return { error: "This gift link isn't valid." };
  if (order.status !== "paid") return { error: "This order hasn't been paid yet." };
  const gifts = await giftsForOrder(order.id);
  const gift = gifts.find((g) => g.id === giftId);
  if (!gift) return { error: "We couldn't find that person on this order." };
  return { order, gifts, gift };
}

/** Send a recipient their gift email again (throttled). */
export async function resendGift(manageToken: string, giftId: string): Promise<GiftActionResult> {
  const found = await loadForAction(manageToken, giftId);
  if ("error" in found) return { ok: false, error: found.error };
  const { order, gifts, gift } = found;
  if (!gift.purchase_token) return { ok: false, error: "This gift is still being prepared. Try again in a minute." };
  if (gift.email_status === "sending") return { ok: false, error: "That email is sending right now." };
  if (gift.resend_count >= GIFT_MAX_RESENDS) {
    return { ok: false, error: "You've resent this one a few times. Copy their link and text it to them instead." };
  }
  const last = gift.last_resent_at ?? gift.sent_at;
  if (last && Date.now() - new Date(last).getTime() < GIFT_RESEND_COOLDOWN_MS) {
    return { ok: false, error: "We just sent it. Give it a minute before resending." };
  }

  const db = getServiceClient();
  const now = new Date().toISOString();
  // Count the resend first (conditional on the count we read) so a double
  // tap can't send twice.
  const { data: bumped } = await db
    .from("plan_gifts")
    .update({ resend_count: gift.resend_count + 1, last_resent_at: now })
    .eq("id", gift.id)
    .eq("resend_count", gift.resend_count)
    .select("id");
  if (!(bumped as unknown[] | null)?.length) return { ok: false, error: "That email is sending right now." };
  gift.resend_count += 1;
  gift.last_resent_at = now;

  const delivered = await deliverGift(order, gift, { force: true });
  if (delivered) Object.assign(gift, delivered);
  if (gift.email_status === "failed") {
    return { ok: false, error: "That email didn't go out. Check the address, or copy their link and text it." };
  }
  return { ok: true, view: await giftOrderView(order, gifts) };
}

/**
 * Fix a mistyped recipient email: only before the gift has been opened.
 * The old link stops working (new access token), and the gift is emailed
 * to the corrected address.
 */
export async function correctGiftEmail(
  manageToken: string,
  giftId: string,
  rawEmail: unknown,
  rawName?: unknown
): Promise<GiftActionResult> {
  const found = await loadForAction(manageToken, giftId);
  if ("error" in found) return { ok: false, error: found.error };
  const { order, gifts, gift } = found;

  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return { ok: false, error: "That email doesn't look right." };
  const name = rawName === undefined ? gift.recipient_name : cleanPersonName(rawName);
  if (!name) return { ok: false, error: "Add their name." };
  if (email === gift.recipient_email && name === gift.recipient_name) return { ok: false, error: "That's the address we already have." };
  if (gifts.some((g) => g.id !== gift.id && g.recipient_email === email)) {
    return { ok: false, error: "Someone else on this order already has that email." };
  }
  if (!(await canCorrectGiftEmail(gift))) {
    return {
      ok: false,
      error:
        gift.email_corrections >= GIFT_MAX_EMAIL_CORRECTIONS
          ? "This address has already been changed. Reply to your receipt and we'll help."
          : "This gift has already been opened, so its address can't be changed.",
    };
  }

  const db = getServiceClient();
  const oldToken = gift.purchase_token!;
  const newToken = crypto.randomUUID();
  // Move the purchase to the new address and retire the old link.
  const { data: moved, error: moveErr } = await db
    .from("public_plan_purchases")
    .update({ email: email, customer_name: name, access_token: newToken, email_sent: false })
    .eq("access_token", oldToken)
    .eq("gift_id", gift.id)
    .select("access_token");
  if (moveErr || !(moved as unknown[] | null)?.length) {
    console.error("[PlanGifts] Email correction (purchase) failed:", gift.id, moveErr);
    return { ok: false, error: "We couldn't update that address. Please try again." };
  }

  const { data: updated, error: giftErr } = await db
    .from("plan_gifts")
    .update({
      recipient_email: email,
      recipient_name: name,
      purchase_token: newToken,
      email_status: "pending",
      email_attempts: 0,
      email_error: null,
      sent_at: null,
      email_corrections: gift.email_corrections + 1,
      last_resent_at: null,
    })
    .eq("id", gift.id)
    .eq("purchase_token", oldToken)
    .select(GIFT_COLUMNS);
  const fresh = (updated as GiftRow[] | null)?.[0];
  if (giftErr || !fresh) {
    console.error("[PlanGifts] Email correction (gift) failed:", gift.id, giftErr);
    return { ok: false, error: "We couldn't update that address. Please try again." };
  }
  Object.assign(gift, fresh);

  const delivered = await deliverGift(order, gift);
  if (delivered) Object.assign(gift, delivered);
  if (gift.email_status === "failed") {
    return { ok: false, error: "Saved, but the email didn't go out. Try resending in a minute, or text them their link." };
  }
  return { ok: true, view: await giftOrderView(order, gifts) };
}

// ── The recipient's side ─────────────────────────────────────────────────────

export interface GiftWelcome {
  recipientFirstName: string;
  gifterName: string;
  message: string | null;
  designHref: string;
  starterHref: string;
  libraryHref: string;
}

export async function giftWelcome(token: string): Promise<GiftWelcome | null> {
  if (!isUuid(token)) return null;
  const db = getServiceClient();
  const { data: gift } = await db
    .from("plan_gifts")
    .select("id, order_id, recipient_name, purchase_token")
    .eq("purchase_token", token)
    .maybeSingle();
  if (!gift) return null;
  const order = await orderById((gift as { order_id: string }).order_id);
  if (!order || order.status !== "paid") return null;
  const name = (gift as { recipient_name: string }).recipient_name;
  return {
    recipientFirstName: name.trim().split(/\s+/)[0] ?? "",
    gifterName: order.gifter_name,
    message: order.message,
    designHref: `/plans/checkout?member=${token}`,
    starterHref: `/plans/build?token=${token}`,
    libraryHref: `/plans/library?token=${token}`,
  };
}

/** First time the gift page ran in a browser (link scanners don't run it). */
export async function markGiftOpened(token: string): Promise<void> {
  if (!isUuid(token)) return;
  await getServiceClient()
    .from("plan_gifts")
    .update({ opened_at: new Date().toISOString() })
    .eq("purchase_token", token)
    .is("opened_at", null);
  const owner = await activityOwnerByToken(token);
  if (owner) await recordPlanActivity(owner, "gift_open");
}
