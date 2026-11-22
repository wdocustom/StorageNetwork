"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Check-ins for plan buyers who haven't opened their plans: their link at
// CHECK_IN_DAYS[0] days after buying, once more at CHECK_IN_DAYS[1], then
// never again. "Haven't opened" = device records, activity and page views all
// show nothing past the checkout visit (planUsage). Per buyer email per
// product, for their newest purchase of it. Dedupe: plan_buyer_campaigns
// (claimed before sending). Daily via /api/cron/plan-check-ins; admins can
// see the list and send the first check-in early from
// /dashboard/admin/plan-reviews.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import { plansOpenedBy } from "@/lib/server/plan-usage";
import { sendPlanCheckInEmail } from "@/lib/emails/planCheckInTemplates";
import { TOTE_PLAN_ID, TOTE_PLAN_MINI, parseTotePlanDesign, totePlanName } from "@/lib/tote-plans";
import type { PlanReviewProduct } from "@/lib/plan-reviews";

const DAY = 24 * 60 * 60 * 1000;
const CHECK_IN_DAYS = [14, 30] as const;
/** Past this, stop looking (buyers from before check-ins existed get at most the 30-day one). */
const LOOK_BACK_DAYS = 45;

const campaign = (stage: 1 | 2, product: PlanReviewProduct) => `plan_checkin_${CHECK_IN_DAYS[stage - 1]}:${product}`;
const productOf = (planId: string): PlanReviewProduct => (planId === TOTE_PLAN_MINI.id ? "mini" : "tote");

interface Purchase {
  id: string;
  email: string;
  plan_id: string;
  access_token: string;
  customer_name: string | null;
  build_config: unknown;
  purchased_at: string;
}

export interface NotOpenedBuyer {
  email: string;
  name: string | null;
  product: PlanReviewProduct;
  designName: string;
  purchasedAt: string;
  days: number;
  reason: string;
  sent: { stage: 1 | 2; at: string }[];
}

/** Buyers (newest purchase per email + product, last LOOK_BACK_DAYS) who haven't opened. */
async function notOpenedBuyers(now: number): Promise<{ buyers: (NotOpenedBuyer & { purchase: Purchase })[]; opened: number }> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("public_plan_purchases")
    .select("id, email, plan_id, access_token, customer_name, build_config, purchased_at")
    .in("plan_id", [TOTE_PLAN_ID, TOTE_PLAN_MINI.id])
    .is("included_from", null)
    .gte("purchased_at", new Date(now - LOOK_BACK_DAYS * DAY).toISOString())
    .order("purchased_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`purchase lookup failed: ${error.message}`);

  const newest = new Map<string, Purchase>();
  for (const p of (data ?? []) as Purchase[]) {
    const email = String(p.email ?? "").toLowerCase();
    if (!email || !p.access_token) continue;
    const key = `${email}|${productOf(p.plan_id)}`;
    if (!newest.has(key)) newest.set(key, { ...p, email });
  }
  if (!newest.size) return { buyers: [], opened: 0 };

  const usage = await plansOpenedBy([...newest.values()].map((p) => ({ email: p.email, purchasedAt: p.purchased_at })));
  const emails = [...new Set([...newest.values()].map((p) => p.email))];
  const { data: sentRows, error: sentErr } = await db
    .from("plan_buyer_campaigns")
    .select("email, campaign, sent_at")
    .in("email", emails)
    .like("campaign", "plan_checkin_%");
  if (sentErr) throw new Error(`campaign lookup failed: ${sentErr.message}`);

  const buyers: (NotOpenedBuyer & { purchase: Purchase })[] = [];
  let opened = 0;
  for (const p of newest.values()) {
    const u = usage.get(p.email);
    if (!u || u.opened) {
      opened++;
      continue;
    }
    const product = productOf(p.plan_id);
    const design = parseTotePlanDesign(p.build_config);
    const sent: NotOpenedBuyer["sent"] = [];
    for (const stage of [1, 2] as const) {
      const row = (sentRows ?? []).find((r) => r.email === p.email && r.campaign === campaign(stage, product));
      if (row) sent.push({ stage, at: row.sent_at as string });
    }
    buyers.push({
      email: p.email,
      name: p.customer_name,
      product,
      designName: design ? totePlanName(design) : "tote rack",
      purchasedAt: p.purchased_at,
      days: Math.floor((now - Date.parse(p.purchased_at)) / DAY),
      reason: u.reason,
      sent,
      purchase: p,
    });
  }
  buyers.sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  return { buyers, opened };
}

/** Claim, send, release on failure. True if sent. */
async function sendCheckIn(b: NotOpenedBuyer & { purchase: Purchase }, stage: 1 | 2): Promise<{ ok: boolean; error?: string }> {
  const db = getServiceClient();
  const key = campaign(stage, b.product);
  const { error: claimError } = await db.from("plan_buyer_campaigns").insert({ email: b.email, campaign: key });
  if (claimError) return { ok: false, error: "already sent" };
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await sendPlanCheckInEmail(b.email, {
      accessToken: b.purchase.access_token,
      designName: b.designName,
      customerName: b.name,
      stage,
    });
    if (r.success) return { ok: true };
    lastError = r.error || "Unknown error";
    if (!lastError.includes("Too many requests")) break;
    await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
  }
  await db.from("plan_buyer_campaigns").delete().eq("email", b.email).eq("campaign", key);
  return { ok: false, error: lastError };
}

export interface CheckInResult {
  notOpened: number;
  first: number;
  second: number;
  errors: string[];
}

export async function processPlanCheckIns(now = Date.now()): Promise<CheckInResult> {
  const result: CheckInResult = { notOpened: 0, first: 0, second: 0, errors: [] };
  let buyers: Awaited<ReturnType<typeof notOpenedBuyers>>["buyers"];
  try {
    ({ buyers } = await notOpenedBuyers(now));
  } catch (err) {
    // Never guess who hasn't opened: skip the run.
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }
  result.notOpened = buyers.length;
  for (const b of buyers) {
    const has = (stage: 1 | 2) => b.sent.some((s) => s.stage === stage);
    // 30 days: the last one (also covers anyone who never got the first)
    let stage: 1 | 2 | null = null;
    if (b.days >= CHECK_IN_DAYS[1] && !has(2)) stage = 2;
    else if (b.days >= CHECK_IN_DAYS[0] && b.days < CHECK_IN_DAYS[1] && !has(1)) stage = 1;
    if (!stage) continue;
    const r = await sendCheckIn(b, stage);
    if (r.ok) {
      if (stage === 1) result.first++;
      else result.second++;
    } else if (r.error !== "already sent") result.errors.push(`${b.email}: ${r.error}`);
    await new Promise((res) => setTimeout(res, 600)); // email rate limit
  }
  console.log("[PlanCheckIns]", { notOpened: result.notOpened, first: result.first, second: result.second, errors: result.errors.length });
  return result;
}

// ── Admin ─────────────────────────────────────────────────────────────────

async function isAdmin(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  if (!user) return false;
  const { data } = await getServiceClient().from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return data?.is_admin === true;
}

export async function listNotOpenedBuyers(): Promise<
  { ok: true; buyers: NotOpenedBuyer[]; opened: number } | { ok: false; error: string }
> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  try {
    const { buyers, opened } = await notOpenedBuyers(Date.now());
    return { ok: true, opened, buyers: buyers.map(({ purchase: _purchase, ...b }) => b) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Lookup failed." };
  }
}

/** Send the first check-in now (re-checks that they still haven't opened). */
export async function sendCheckInNow(email: string, product: PlanReviewProduct): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  try {
    const { buyers } = await notOpenedBuyers(Date.now());
    const b = buyers.find((x) => x.email === String(email).toLowerCase() && x.product === product);
    if (!b) return { ok: false, error: "They've opened their plans since, or there's no such purchase." };
    if (b.sent.length) return { ok: false, error: "A check-in was already sent." };
    return await sendCheckIn(b, 1);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't send." };
  }
}
