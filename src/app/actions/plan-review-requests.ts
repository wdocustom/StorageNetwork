"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Ask DIY plan buyers for a review: one email PLAN_REVIEW_REQUEST_AFTER_DAYS
// after they bought — and only once they've actually opened their plans
// (planUsage: device records, activity and page views agree) — one
// reminder PLAN_REVIEW_REMINDER_AFTER_DAYS later, then never again. Each
// email carries their share link ($3 off for friends and family). Per buyer email per product (27-gal / Mini), for their newest
// purchase of it; skipped once they've reviewed. Buyers older than
// PLAN_REVIEW_REQUEST_MAX_AGE_DAYS when this launched aren't asked.
// Called daily by /api/cron/plan-review-requests. Safe to re-run: each send
// claims its row first (review_request_sent_at / review_reminder_sent_at).
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { sendPlanReviewRequestEmail } from "@/lib/emails/planReviewTemplates";
import { TOTE_PLAN_ID, TOTE_PLAN_MINI, parseTotePlanDesign, totePlanName } from "@/lib/tote-plans";
import { getOrCreateFriendCode } from "@/lib/server/plan-friend";
import { plansOpenedBy } from "@/lib/server/plan-usage";
import {
  PLAN_REVIEW_REMINDER_AFTER_DAYS,
  PLAN_REVIEW_REQUEST_AFTER_DAYS,
  PLAN_REVIEW_REQUEST_MAX_AGE_DAYS,
  type PlanReviewProduct,
} from "@/lib/plan-reviews";

const DAY = 24 * 60 * 60 * 1000;

export interface ReviewRequestResult {
  requests: number;
  reminders: number;
  /** Due by date, skipped: haven't used their plans yet */
  notUsedYet: number;
  errors: string[];
}

interface Row {
  id: string;
  email: string;
  plan_id: string;
  access_token: string;
  customer_name: string | null;
  build_config: unknown;
  purchased_at: string;
  review_request_sent_at: string | null;
  review_reminder_sent_at: string | null;
}

const productOf = (planId: string): PlanReviewProduct => (planId === TOTE_PLAN_MINI.id ? "mini" : "tote");

export async function processPlanReviewRequests(now = Date.now()): Promise<ReviewRequestResult> {
  const result: ReviewRequestResult = { requests: 0, reminders: 0, notUsedYet: 0, errors: [] };
  const db = getServiceClient();

  const { data, error } = await db
    .from("public_plan_purchases")
    .select("id, email, plan_id, access_token, customer_name, build_config, purchased_at, review_request_sent_at, review_reminder_sent_at")
    .in("plan_id", [TOTE_PLAN_ID, TOTE_PLAN_MINI.id])
    .is("included_from", null)
    .gte("purchased_at", new Date(now - PLAN_REVIEW_REQUEST_MAX_AGE_DAYS * DAY).toISOString())
    .order("purchased_at", { ascending: false })
    .limit(5000);
  if (error) {
    result.errors.push(`Query failed: ${error.message}`);
    return result;
  }

  // Newest purchase per email + product; any row already asked counts for all.
  const groups = new Map<string, { newest: Row; asked: Row | null }>();
  for (const r of (data ?? []) as Row[]) {
    const email = String(r.email ?? "").toLowerCase();
    if (!email || !r.access_token) continue;
    const key = `${email}|${productOf(r.plan_id)}`;
    const g = groups.get(key) ?? { newest: r, asked: null };
    if (r.review_request_sent_at && !g.asked) g.asked = r;
    groups.set(key, g);
  }
  if (!groups.size) return result;

  const { data: reviewed } = await db.from("plan_reviews").select("email, product");
  const done = new Set((reviewed ?? []).map((r) => `${String(r.email).toLowerCase()}|${r.product}`));

  // Only buyers who've opened their plans (see planUsage). A failed lookup
  // stops the run: never guess.
  let usage: Map<string, { opened: boolean }>;
  try {
    usage = await plansOpenedBy([...groups.entries()].map(([k, g]) => ({ email: k.split("|")[0], purchasedAt: g.newest.purchased_at })));
  } catch (err) {
    result.errors.push(`Usage lookup failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  for (const [key, g] of groups) {
    if (done.has(key)) continue;
    const email = key.split("|")[0];
    if (!usage.get(email)?.opened) {
      result.notUsedYet++;
      continue;
    }
    let row: Row;
    let column: "review_request_sent_at" | "review_reminder_sent_at";
    if (!g.asked) {
      if (new Date(g.newest.purchased_at).getTime() > now - PLAN_REVIEW_REQUEST_AFTER_DAYS * DAY) continue;
      row = g.newest;
      column = "review_request_sent_at";
    } else {
      if (g.asked.review_reminder_sent_at) continue;
      if (new Date(g.asked.review_request_sent_at!).getTime() > now - PLAN_REVIEW_REMINDER_AFTER_DAYS * DAY) continue;
      row = g.asked;
      column = "review_reminder_sent_at";
    }

    // Claim first: a concurrent run can't send the same email twice.
    const stamp = new Date(now).toISOString();
    const { data: claimed } = await db.from("public_plan_purchases").update({ [column]: stamp }).eq("id", row.id).is(column, null).select("id");
    if (!claimed?.length) continue;

    const design = parseTotePlanDesign(row.build_config);
    // Their share link: friends and family get $3 off (made once per email)
    const friendCode = await getOrCreateFriendCode(email, row.id).catch(() => null);
    let sent = false;
    let lastError = "";
    for (let attempt = 0; attempt < 3 && !sent; attempt++) {
      const r = await sendPlanReviewRequestEmail(email, {
        accessToken: row.access_token,
        designName: design ? totePlanName(design) : "tote rack",
        customerName: row.customer_name,
        reminder: column === "review_reminder_sent_at",
        friendCode,
      });
      if (r.success) sent = true;
      else {
        lastError = r.error || "Unknown error";
        if (!lastError.includes("Too many requests")) break;
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
      }
    }
    if (sent) {
      if (column === "review_request_sent_at") result.requests++;
      else result.reminders++;
    } else {
      // Release the claim so the next run retries.
      await db.from("public_plan_purchases").update({ [column]: null }).eq("id", row.id);
      result.errors.push(`${email}: ${lastError}`);
    }
    await new Promise((res) => setTimeout(res, 600)); // stay under the email rate limit
  }
  console.log("[PlanReviewRequests]", {
    requests: result.requests,
    reminders: result.reminders,
    notUsedYet: result.notUsedYet,
    errors: result.errors.length,
  });
  return result;
}
