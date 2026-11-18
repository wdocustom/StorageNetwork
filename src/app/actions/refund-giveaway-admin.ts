"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Admin: Holiday Full Refund Giveaway winners (Platform Analytics → Plans).
// Admins only, checked from the signed-in session on every call.
// The logic lives in @/lib/server/refund-giveaway-draw.
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "stripe";
import { stripeConfig } from "@/lib/stripe/http";
import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import { REFUND_GIVEAWAY, addDays, centralDate, drawableDays } from "@/lib/refund-giveaway";
import { sendGiveawayWinnerEmail } from "@/lib/emails/giveawayTemplates";
import {
  drawWinners,
  loadEntries,
  loadWinners,
  processWinner,
  resendWinnerEmail,
  voidWinner,
  type DrawResult,
  type EntryKind,
  type GiveawayDeps,
  type WinnerRow,
} from "@/lib/server/refund-giveaway-draw";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

let _stripe: Stripe | null = null;
function deps(): GiveawayDeps {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, stripeConfig());
  return { db: getServiceClient(), stripe: _stripe, notify: sendGiveawayWinnerEmail };
}

async function adminId(): Promise<string | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const { data } = await getServiceClient().from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return data?.is_admin === true ? user.id : null;
}

async function guarded<T>(fn: (admin: string) => Promise<T>): Promise<Result<T>> {
  try {
    const admin = await adminId();
    if (!admin) return { ok: false, error: "Not authorized." };
    return { ok: true, data: await fn(admin) };
  } catch (err) {
    console.error("[RefundGiveawayAdmin]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export interface GiveawayDayView {
  day: string;
  /** Finished days inside the promotion, newest first */
  days: string[];
  entries: { purchase: number; gift_order: number; free: number; freeByEmail: number; people: number };
  winners: WinnerRow[];
  /** Entries that can still be drawn (not drawn before, person hasn't won that day) */
  remaining: number;
}

export async function getGiveawayDay(day?: string): Promise<Result<GiveawayDayView>> {
  return guarded(async () => {
    const days = drawableDays();
    const pick = day && days.includes(day) ? day : days[0];
    if (!pick) throw new Error("No finished days to draw yet.");
    const db = getServiceClient();
    const [entries, winners] = await Promise.all([loadEntries(db, pick), loadWinners(db, pick)]);
    const count = (k: EntryKind) => entries.filter((e) => e.kind === k).length;
    const drawnRefs = new Set(winners.map((w) => w.entry_ref));
    const wonEmails = new Set(winners.filter((w) => w.status !== "void").map((w) => w.email.toLowerCase()));
    return {
      day: pick,
      days,
      entries: {
        purchase: count("purchase"),
        gift_order: count("gift_order"),
        free: count("free"),
        freeByEmail: entries.filter((e) => e.kind === "free" && e.source === "email").length,
        people: new Set(entries.map((e) => e.email)).size,
      },
      winners,
      remaining: entries.filter((e) => !drawnRefs.has(e.ref) && !wonEmails.has(e.email)).length,
    };
  });
}

export async function drawGiveawayWinners(day: string, count: number): Promise<Result<DrawResult>> {
  return guarded((admin) => drawWinners(deps(), day, count, admin));
}

export async function issueGiveawayPrize(winnerId: string): Promise<Result<WinnerRow>> {
  return guarded(() => processWinner(deps(), winnerId));
}

export async function resendGiveawayEmail(winnerId: string): Promise<Result<WinnerRow>> {
  return guarded(() => resendWinnerEmail(deps(), winnerId));
}

export async function voidGiveawayWinner(winnerId: string, reason: string): Promise<Result<null>> {
  return guarded(async () => {
    await voidWinner(getServiceClient(), winnerId, reason);
    return null;
  });
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

/** A free entry that came in by email, counted toward the day it arrived (Central Time). */
export async function addEmailedEntry(input: { name: string; email: string; day: string }): Promise<Result<null>> {
  return guarded(async () => {
    const name = input.name.replace(/\s+/g, " ").trim().slice(0, 100);
    const email = input.email.trim().toLowerCase();
    const day = input.day;
    const { startDate, endDate } = REFUND_GIVEAWAY;
    if (name.split(" ").length < 2) throw new Error("Enter their full name (first and last).");
    if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
    if (!startDate || !endDate || day < startDate || day > endDate || day > centralDate()) {
      throw new Error("That day isn't inside the promotion.");
    }
    if (day < addDays(centralDate(), -60)) throw new Error("That day is too far back.");
    const { data: drawn } = await getServiceClient().from("refund_giveaway_winners").select("id").eq("draw_date", day).limit(1);
    const { error } = await getServiceClient()
      .from("refund_giveaway_free_entries")
      .insert({ entry_date: day, full_name: name, email, source: "email" });
    if (error) {
      if ((error as { code?: string }).code === "23505") throw new Error("They already have a free entry for that day.");
      throw new Error(error.message);
    }
    if (drawn?.length) console.warn("[RefundGiveawayAdmin] emailed entry added after a draw for", day);
    return null;
  });
}
