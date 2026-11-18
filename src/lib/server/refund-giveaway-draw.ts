import "server-only";

import { randomInt } from "node:crypto";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { centralDayRange, drawableDays } from "@/lib/refund-giveaway";
import { DEFAULT_TOTE_PLAN_DESIGN, TOTE_PLAN_ALL_ACCESS_TIER, TOTE_PLAN_ID } from "@/lib/tote-plans";
import type { GiveawayWinnerEmail } from "@/lib/emails/giveawayTemplates";

// ═══════════════════════════════════════════════════════════════════════════
// Holiday Full Refund Giveaway: the day's entries, the draw, and prizes.
//
// Entries for a Central Time day (see /refund-rules):
//   • purchase    every paid plans order that day (one per Stripe session;
//                 All-Access "included" plans and gift recipients aren't orders)
//   • gift_order  every paid gift order that day, once per order
//   • free        that day's free entries (form, or emailed and added by an admin)
//
// draw() picks at random (crypto) from entries not drawn before. Each pick
// is checked before it counts:
//   • one prize per person per day (by email)
//   • an order refunded or disputed since → recorded "void", never re-drawn
//   • a free-entry winner who bought that day gets that order refunded;
//     otherwise their prize is a lifetime plans account
// processWinner() issues the prize (Stripe refund with an idempotency key,
// or the plans account), then emails the winner. Every step is recorded on
// the winner row, so a failure can be retried from the admin card.
// ═══════════════════════════════════════════════════════════════════════════

export type EntryKind = "purchase" | "gift_order" | "free";

export interface GiveawayEntry {
  kind: EntryKind;
  /** Stripe session id (orders) or free:<entry id> */
  ref: string;
  email: string;
  name: string | null;
  sessionId: string | null;
  at: string;
  /** Free entries: "form" or "email" */
  source?: string;
}

export type WinnerStatus = "drawn" | "processing" | "refunded" | "granted" | "failed" | "void";

export interface WinnerRow {
  id: string;
  draw_date: string;
  entry_kind: EntryKind;
  entry_ref: string;
  email: string;
  full_name: string | null;
  prize: "refund" | "plans_account";
  stripe_session_id: string | null;
  amount_cents: number | null;
  status: WinnerStatus;
  stripe_refund_id: string | null;
  access_token: string | null;
  error: string | null;
  notified_at: string | null;
  notify_error: string | null;
  processed_at: string | null;
  created_at: string;
}

export const WINNER_COLUMNS =
  "id, draw_date, entry_kind, entry_ref, email, full_name, prize, stripe_session_id, amount_cents, status, stripe_refund_id, access_token, error, notified_at, notify_error, processed_at, created_at";

export interface GiveawayDeps {
  db: SupabaseClient;
  stripe: Stripe;
  notify: (p: GiveawayWinnerEmail) => Promise<{ success: boolean; error?: string }>;
  /** Uniform integer in [0, max). Defaults to crypto.randomInt. */
  random?: (max: number) => number;
}

const lower = (s: string) => s.trim().toLowerCase();

// ─── Entries ──────────────────────────────────────────────────────────────

export async function loadEntries(db: SupabaseClient, day: string): Promise<GiveawayEntry[]> {
  const { start, end } = centralDayRange(day);
  const [purchases, gifts, free] = await Promise.all([
    db
      .from("public_plan_purchases")
      .select("stripe_session_id, email, customer_name, purchased_at")
      .is("included_from", null)
      .is("gift_id", null)
      .like("stripe_session_id", "cs_%")
      .gte("purchased_at", start)
      .lt("purchased_at", end)
      .limit(5000),
    db
      .from("plan_gift_orders")
      .select("stripe_session_id, gifter_email, gifter_name, paid_at")
      .eq("status", "paid")
      .gte("paid_at", start)
      .lt("paid_at", end)
      .limit(5000),
    db.from("refund_giveaway_free_entries").select("id, full_name, email, created_at, source").eq("entry_date", day).limit(20000),
  ]);
  for (const r of [purchases, gifts, free]) if (r.error) throw new Error(r.error.message);

  const entries: GiveawayEntry[] = [];
  const seen = new Set<string>();
  for (const p of (purchases.data ?? []) as { stripe_session_id: string; email: string; customer_name: string | null; purchased_at: string }[]) {
    if (seen.has(p.stripe_session_id)) continue; // one entry per order
    seen.add(p.stripe_session_id);
    entries.push({ kind: "purchase", ref: p.stripe_session_id, email: lower(p.email), name: p.customer_name, sessionId: p.stripe_session_id, at: p.purchased_at });
  }
  for (const g of (gifts.data ?? []) as { stripe_session_id: string | null; gifter_email: string; gifter_name: string | null; paid_at: string }[]) {
    if (!g.stripe_session_id || seen.has(g.stripe_session_id)) continue;
    seen.add(g.stripe_session_id);
    entries.push({ kind: "gift_order", ref: g.stripe_session_id, email: lower(g.gifter_email), name: g.gifter_name, sessionId: g.stripe_session_id, at: g.paid_at });
  }
  for (const f of (free.data ?? []) as { id: string; full_name: string; email: string; created_at: string; source: string }[]) {
    entries.push({ kind: "free", ref: `free:${f.id}`, email: lower(f.email), name: f.full_name, sessionId: null, at: f.created_at, source: f.source });
  }
  return entries;
}

export async function loadWinners(db: SupabaseClient, day: string): Promise<WinnerRow[]> {
  const { data, error } = await db.from("refund_giveaway_winners").select(WINNER_COLUMNS).eq("draw_date", day).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as WinnerRow[];
}

// ─── Order checks ─────────────────────────────────────────────────────────

export type OrderCheck =
  | { ok: true; amountCents: number; paymentIntentId: string }
  | { ok: false; reason: string };

/** Is this order still paid, unrefunded and undisputed? */
export async function checkOrder(stripe: Stripe, sessionId: string): Promise<OrderCheck> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] });
  if (session.payment_status !== "paid") return { ok: false, reason: "Not paid" };
  const amount = session.amount_total ?? 0;
  if (amount <= 0) return { ok: false, reason: "Nothing was paid" };
  const pi = session.payment_intent as Stripe.PaymentIntent | string | null;
  if (!pi || typeof pi === "string") return { ok: false, reason: "No payment found" };
  const charge = pi.latest_charge as Stripe.Charge | string | null;
  if (charge && typeof charge !== "string") {
    if (charge.disputed) return { ok: false, reason: "Charged back" };
    if (charge.refunded || charge.amount_refunded > 0) return { ok: false, reason: "Already refunded" };
  }
  return { ok: true, amountCents: amount, paymentIntentId: pi.id };
}

// ─── Draw ─────────────────────────────────────────────────────────────────

export interface DrawResult {
  winners: WinnerRow[];
  /** Picks that didn't count, and why (refunded order, same person…) */
  voided: { email: string; reason: string }[];
  /** Fewer eligible entries left than asked for */
  exhausted: boolean;
}

export async function drawWinners(deps: GiveawayDeps, day: string, count: number, adminId: string | null): Promise<DrawResult> {
  if (!drawableDays().includes(day)) throw new Error("That day can't be drawn (it must be a finished day inside the promotion).");
  const want = Math.max(1, Math.min(100, Math.floor(count)));
  const random = deps.random ?? ((max: number) => randomInt(max));

  const [entries, existing] = await Promise.all([loadEntries(deps.db, day), loadWinners(deps.db, day)]);
  const drawnRefs = new Set(existing.map((w) => w.entry_ref));
  const live = existing.filter((w) => w.status !== "void");
  const takenEmails = new Set(live.map((w) => lower(w.email)));
  const takenSessions = new Set(live.map((w) => w.stripe_session_id).filter(Boolean) as string[]);

  // Fisher–Yates over the entries not drawn before.
  const pool = entries.filter((e) => !drawnRefs.has(e.ref));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const ordersByEmail = new Map<string, GiveawayEntry[]>();
  for (const e of entries) {
    if (!e.sessionId) continue;
    ordersByEmail.set(e.email, [...(ordersByEmail.get(e.email) ?? []), e]);
  }

  const result: DrawResult = { winners: [], voided: [], exhausted: false };

  const insert = async (row: Record<string, unknown>): Promise<WinnerRow | null> => {
    const { data, error } = await deps.db
      .from("refund_giveaway_winners")
      .insert({ draw_date: day, drawn_by: adminId, ...row })
      .select(WINNER_COLUMNS)
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505") return null; // drawn concurrently: skip
      throw new Error(error.message);
    }
    return data as WinnerRow;
  };

  for (const e of pool) {
    if (result.winners.length >= want) break;
    // One prize per person per day: their other entries stay in the pool for nobody.
    if (takenEmails.has(e.email)) continue;

    let prize: "refund" | "plans_account";
    let sessionId: string | null = null;
    let amount: number | null = null;

    if (e.sessionId) {
      if (takenSessions.has(e.sessionId)) continue;
      const check = await checkOrder(deps.stripe, e.sessionId);
      if (!check.ok) {
        await insert({ entry_kind: e.kind, entry_ref: e.ref, email: e.email, full_name: e.name, prize: "refund", stripe_session_id: e.sessionId, status: "void", error: check.reason });
        result.voided.push({ email: e.email, reason: check.reason });
        continue;
      }
      prize = "refund";
      sessionId = e.sessionId;
      amount = check.amountCents;
    } else {
      // A free entry: refund their order from that day if they made one.
      prize = "plans_account";
      for (const o of ordersByEmail.get(e.email) ?? []) {
        if (!o.sessionId || takenSessions.has(o.sessionId)) continue;
        const check = await checkOrder(deps.stripe, o.sessionId);
        if (check.ok) {
          prize = "refund";
          sessionId = o.sessionId;
          amount = check.amountCents;
          break;
        }
      }
    }

    const row = await insert({ entry_kind: e.kind, entry_ref: e.ref, email: e.email, full_name: e.name, prize, stripe_session_id: sessionId, amount_cents: amount, status: "drawn" });
    if (!row) continue;
    result.winners.push(row);
    takenEmails.add(e.email);
    if (sessionId) takenSessions.add(sessionId);
  }

  result.exhausted = result.winners.length < want;
  return result;
}

// ─── Prizes ───────────────────────────────────────────────────────────────

async function tokenForSession(db: SupabaseClient, sessionId: string): Promise<string | null> {
  const { data } = await db.from("public_plan_purchases").select("access_token").eq("stripe_session_id", sessionId).limit(1);
  return ((data as { access_token: string }[] | null) ?? [])[0]?.access_token ?? null;
}

/** A lifetime plans account for a free-entry winner (their existing one if they already own plans). */
async function grantPlansAccount(db: SupabaseClient, w: WinnerRow): Promise<string> {
  const { data: owned } = await db
    .from("public_plan_purchases")
    .select("access_token")
    .ilike("email", w.email.replace(/[%_\\]/g, "\\$&"))
    .eq("plan_id", TOTE_PLAN_ID)
    .is("included_from", null)
    .limit(1);
  const existing = ((owned as { access_token: string }[] | null) ?? [])[0]?.access_token;
  if (existing) return existing;

  const sessionKey = `giveaway_${w.id}`;
  const { data, error } = await db
    .from("public_plan_purchases")
    .insert({
      email: w.email,
      plan_id: TOTE_PLAN_ID,
      tier: TOTE_PLAN_ALL_ACCESS_TIER,
      build_config: DEFAULT_TOTE_PLAN_DESIGN,
      stripe_session_id: sessionKey,
      customer_name: w.full_name,
      email_sent: true, // the winner email carries the link
      purchased_at: new Date().toISOString(),
    })
    .select("access_token")
    .single();
  const token = (data as { access_token: string } | null)?.access_token;
  if (token) return token;
  if ((error as { code?: string } | null)?.code === "23505") {
    const again = await tokenForSession(db, sessionKey);
    if (again) return again;
  }
  throw new Error(error?.message ?? "Couldn't create the plans account");
}

async function emailWinner(deps: GiveawayDeps, w: WinnerRow): Promise<WinnerRow> {
  const sent = await deps
    .notify({ to: w.email, name: w.full_name, prize: w.prize, drawDate: w.draw_date, amountCents: w.amount_cents, accessToken: w.access_token })
    .catch((err) => ({ success: false, error: err instanceof Error ? err.message : String(err) }));
  const update = sent.success
    ? { notified_at: new Date().toISOString(), notify_error: null }
    : { notify_error: (sent.error ?? "Send failed").slice(0, 300) };
  await deps.db.from("refund_giveaway_winners").update(update).eq("id", w.id);
  return { ...w, ...update };
}

/** Issue one winner's prize, then email them. Safe to retry after a failure. */
export async function processWinner(deps: GiveawayDeps, winnerId: string): Promise<WinnerRow> {
  const { data: claimed } = await deps.db
    .from("refund_giveaway_winners")
    .update({ status: "processing", error: null })
    .eq("id", winnerId)
    .in("status", ["drawn", "failed"])
    .select(WINNER_COLUMNS);
  const w = ((claimed as WinnerRow[] | null) ?? [])[0];
  if (!w) throw new Error("This winner was already processed (or is being processed).");

  try {
    let update: Partial<WinnerRow>;
    if (w.prize === "refund") {
      if (!w.stripe_session_id) throw new Error("No order to refund");
      const session = await deps.stripe.checkout.sessions.retrieve(w.stripe_session_id);
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!pi) throw new Error("No payment found for this order");
      const refund = await deps.stripe.refunds.create(
        { payment_intent: pi, reason: "requested_by_customer", metadata: { type: "refund_giveaway", winner_id: w.id, draw_date: w.draw_date } },
        { idempotencyKey: `refund-giveaway-${w.id}` }
      );
      update = {
        status: "refunded",
        stripe_refund_id: refund.id,
        amount_cents: refund.amount,
        access_token: await tokenForSession(deps.db, w.stripe_session_id),
      };
    } else {
      update = { status: "granted", access_token: await grantPlansAccount(deps.db, w) };
    }
    const done = { ...update, processed_at: new Date().toISOString(), error: null };
    await deps.db.from("refund_giveaway_winners").update(done).eq("id", w.id);
    return emailWinner(deps, { ...w, ...done } as WinnerRow);
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    await deps.db.from("refund_giveaway_winners").update({ status: "failed", error: message }).eq("id", w.id);
    return { ...w, status: "failed", error: message };
  }
}

/** Send the winner email again (prize already issued). */
export async function resendWinnerEmail(deps: GiveawayDeps, winnerId: string): Promise<WinnerRow> {
  const { data } = await deps.db.from("refund_giveaway_winners").select(WINNER_COLUMNS).eq("id", winnerId).maybeSingle();
  const w = data as WinnerRow | null;
  if (!w || (w.status !== "refunded" && w.status !== "granted")) throw new Error("Only issued prizes can be emailed.");
  return emailWinner(deps, w);
}

/** Take back a drawn (not yet issued) win, e.g. an ineligible person. The entry isn't drawn again. */
export async function voidWinner(db: SupabaseClient, winnerId: string, reason: string): Promise<void> {
  const { data } = await db
    .from("refund_giveaway_winners")
    .update({ status: "void", error: reason.slice(0, 300) || "Voided by admin" })
    .eq("id", winnerId)
    .in("status", ["drawn", "failed"])
    .select("id");
  if (!(data as unknown[] | null)?.length) throw new Error("Only a winner whose prize hasn't been issued can be voided.");
}
