"use server";

// ═══════════════════════════════════════════════════════════════════════════
// DIY plan reviews (plan_reviews).
//
// Who can review: a real plan buyer (public_plan_purchases, not a plan
// included with an installer job), from a device verified for that buyer —
// the same gate as opening the plan, so a forwarded link can't post. One
// review per email per product ("tote" / "mini").
//
// Publishing: 4–5★ go live at once; 1–3★ are held and the admin is emailed,
// so a buyer who hit a problem can be helped first. Admins publish, hide and
// reply from /dashboard/admin/plan-reviews.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isKnownPlanDevice } from "@/lib/server/plan-device";
import { photoFiles, uploadReviewPhotos } from "@/lib/server/review-photos";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import { recordPlanActivity } from "@/lib/server/plan-activity";
import { sendPlanReviewHeldEmail } from "@/lib/emails/planReviewTemplates";
import { isAccessToken } from "@/lib/plan-activity";
import { TOTE_PLAN_ID, TOTE_PLAN_MINI, parseTotePlanDesign } from "@/lib/tote-plans";
import {
  HOLD_AT_OR_BELOW,
  PLAN_REVIEW_TAGS,
  REVIEW_LIMITS,
  SKILL_LEVELS,
  cleanTags,
  cleanText,
  publicName,
  summarizeRatings,
  timeAgo,
  type RatingSummary,
} from "@/lib/reviews";
import {
  PLAN_REVIEW_PRODUCT_LABEL,
  cleanBuildHours,
  planBuildSummary,
  planReviewMeta,
  type PlanReviewProduct,
} from "@/lib/plan-reviews";

const db = () => getServiceClient();
const REVIEW_COLUMNS =
  "id, product, customer_name, rating, headline, comment, tags, photos, skill_level, build_hours, build_summary, status, reply, reply_at, created_at";

function productFor(planId: string): PlanReviewProduct | null {
  if (planId === TOTE_PLAN_ID) return "tote";
  if (planId === TOTE_PLAN_MINI.id) return "mini";
  return null;
}

interface Purchase {
  id: string;
  email: string;
  plan_id: string;
  customer_name: string | null;
  build_config: unknown;
  included_from: string | null;
}

/** The buyer behind a plan link, if this device may act for them. */
async function buyerFor(token: unknown): Promise<{ purchase: Purchase; product: PlanReviewProduct } | null> {
  if (!isAccessToken(token)) return null;
  const { data } = await db()
    .from("public_plan_purchases")
    .select("id, email, plan_id, customer_name, build_config, included_from")
    .eq("access_token", token)
    .maybeSingle();
  const purchase = data as Purchase | null;
  if (!purchase || purchase.included_from) return null;
  const product = productFor(purchase.plan_id);
  if (!product) return null;
  if (!(await isKnownPlanDevice(purchase.email))) return null;
  return { purchase, product };
}

// ── The buyer's side (plan page / guide) ─────────────────────────────────

export type MyPlanReview =
  | { canReview: false }
  | {
      canReview: true;
      product: PlanReviewProduct;
      buildSummary: string | null;
      /** Their review, if they've left one */
      review: { rating: number; status: "published" | "held" | "hidden" } | null;
    };

export async function getMyPlanReview(token: string): Promise<MyPlanReview> {
  const buyer = await buyerFor(token);
  if (!buyer) return { canReview: false };
  const { data } = await db()
    .from("plan_reviews")
    .select("rating, status")
    .eq("email", buyer.purchase.email.toLowerCase())
    .eq("product", buyer.product)
    .maybeSingle();
  return {
    canReview: true,
    product: buyer.product,
    buildSummary: planBuildSummary(parseTotePlanDesign(buyer.purchase.build_config)),
    review: data ? { rating: data.rating as number, status: data.status as "published" | "held" | "hidden" } : null,
  };
}

/** FormData: token, rating, headline, comment, tags (JSON), skill_level, build_hours, photos. */
export async function submitPlanReview(form: FormData): Promise<{ ok: true; held: boolean } | { ok: false; error: string }> {
  try {
    await enforceActionRateLimit({ action: "plan-reviews.submit", limit: 10, window: "10 m", identify: "ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const buyer = await buyerFor(form.get("token"));
  if (!buyer) return { ok: false, error: "We couldn't confirm your plan purchase on this device. Open your plans from your email link and try again." };
  const { purchase, product } = buyer;
  const email = purchase.email.toLowerCase();

  const rating = Number(form.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Pick 1 to 5 stars." };

  const { data: existing } = await db().from("plan_reviews").select("id").eq("email", email).eq("product", product).maybeSingle();
  if (existing) return { ok: false, error: "You've already reviewed these plans. Thank you!" };

  let tags: unknown = [];
  try {
    tags = JSON.parse(String(form.get("tags") ?? "[]"));
  } catch {
    tags = [];
  }
  const skill = String(form.get("skill_level") ?? "");
  const photos = await uploadReviewPhotos(`plans/${purchase.id}`, photoFiles(form));
  if (!photos.ok) return { ok: false, error: photos.error };

  const held = rating <= HOLD_AT_OR_BELOW;
  const row = {
    purchase_id: purchase.id,
    email,
    product,
    customer_name: (purchase.customer_name ?? "").trim() || "Verified buyer",
    rating,
    headline: cleanText(form.get("headline"), REVIEW_LIMITS.headline),
    comment: cleanText(form.get("comment"), REVIEW_LIMITS.comment),
    tags: cleanTags(tags, PLAN_REVIEW_TAGS),
    photos: photos.urls,
    skill_level: SKILL_LEVELS.some((s) => s.id === skill) ? skill : null,
    build_hours: cleanBuildHours(form.get("build_hours")),
    build_summary: planBuildSummary(parseTotePlanDesign(purchase.build_config)),
    status: held ? "held" : "published",
  };
  const { error } = await db().from("plan_reviews").insert(row);
  if (error) {
    console.error("[PlanReviews] insert failed:", error.message);
    if (error.code === "23505") return { ok: false, error: "You've already reviewed these plans. Thank you!" };
    return { ok: false, error: "We couldn't save your review. Please try again." };
  }

  await recordPlanActivity(
    { access_token: String(form.get("token")), email, plan_id: purchase.plan_id },
    "review_submitted",
    { value: rating, detail: held ? "held" : "published" },
  );
  if (held) {
    const sent = await sendPlanReviewHeldEmail({
      rating,
      product: PLAN_REVIEW_PRODUCT_LABEL[product],
      customerName: row.customer_name,
      email,
      headline: row.headline,
      comment: row.comment,
      photos: row.photos.length,
    }).catch((e) => ({ success: false, error: String(e) }));
    if (!sent.success) console.error("[PlanReviews] held email failed:", sent.error);
  }
  return { ok: true, held };
}

// ── Public (plans page, checkout) ────────────────────────────────────────

export interface PublicPlanReview {
  id: string;
  product: PlanReviewProduct;
  name: string;
  rating: number;
  headline: string | null;
  comment: string | null;
  tags: string[];
  photos: string[];
  when: string;
  meta: string | null;
  reply: string | null;
}

export interface PlanReviewsData {
  summary: RatingSummary;
  /** Newest first, photo reviews first among the same age bucket is left to the UI */
  reviews: PublicPlanReview[];
}

type ReviewRow = {
  id: string;
  product: PlanReviewProduct;
  customer_name: string;
  rating: number;
  headline: string | null;
  comment: string | null;
  tags: string[] | null;
  photos: string[] | null;
  skill_level: string | null;
  build_hours: number | null;
  build_summary: string | null;
  status: string;
  reply: string | null;
  reply_at: string | null;
  created_at: string;
};

function toPublic(r: ReviewRow): PublicPlanReview {
  return {
    id: r.id,
    product: r.product,
    name: publicName(r.customer_name),
    rating: r.rating,
    headline: r.headline,
    comment: r.comment,
    tags: r.tags ?? [],
    photos: r.photos ?? [],
    when: timeAgo(r.created_at),
    meta: planReviewMeta(r),
    reply: r.reply,
  };
}

/** Published plan reviews: stats over all of them, the newest `limit` to show. */
export async function getPlanReviews(opts: { product?: PlanReviewProduct; limit?: number } = {}): Promise<PlanReviewsData> {
  const limit = Math.max(1, Math.min(50, opts.limit ?? 12));
  let stats = db().from("plan_reviews").select("rating, tags").eq("status", "published").limit(10000);
  let list = db().from("plan_reviews").select(REVIEW_COLUMNS).eq("status", "published").order("created_at", { ascending: false }).limit(limit);
  if (opts.product) {
    stats = stats.eq("product", opts.product);
    list = list.eq("product", opts.product);
  }
  const [s, l] = await Promise.all([stats, list]);
  if (s.error) console.error("[PlanReviews] stats failed:", s.error.message);
  if (l.error) console.error("[PlanReviews] list failed:", l.error.message);
  return {
    summary: summarizeRatings((s.data ?? []) as { rating: number; tags: string[] | null }[]),
    reviews: ((l.data ?? []) as ReviewRow[]).map(toPublic),
  };
}

/** Just the numbers (checkout's "★ 4.9 from 23 builders"). */
export async function getPlanRatingSummary(product?: PlanReviewProduct): Promise<{ average: number; total: number }> {
  let q = db().from("plan_reviews").select("rating").eq("status", "published").limit(10000);
  if (product === "tote" || product === "mini") q = q.eq("product", product);
  const { data } = await q;
  const { average, total } = summarizeRatings((data ?? []) as { rating: number }[]);
  return { average, total };
}

// ── Admin ─────────────────────────────────────────────────────────────────

async function isAdmin(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  if (!user) return false;
  const { data } = await db().from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return data?.is_admin === true;
}

export interface AdminPlanReview extends PublicPlanReview {
  email: string;
  fullName: string;
  status: "published" | "held" | "hidden";
  createdAt: string;
}

export async function listPlanReviewsAdmin(): Promise<{ ok: true; reviews: AdminPlanReview[] } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const { data, error } = await db()
    .from("plan_reviews")
    .select(`${REVIEW_COLUMNS}, email`)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    reviews: ((data ?? []) as (ReviewRow & { email: string })[]).map((r) => ({
      ...toPublic(r),
      email: r.email,
      fullName: r.customer_name,
      status: r.status as AdminPlanReview["status"],
      createdAt: r.created_at,
    })),
  };
}

export async function setPlanReviewStatus(id: string, status: "published" | "hidden"): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  if (status !== "published" && status !== "hidden") return { ok: false, error: "Bad status." };
  const { error } = await db().from("plan_reviews").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Public reply from Storage Network; empty text removes it. */
export async function replyToPlanReview(id: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const reply = cleanText(text, REVIEW_LIMITS.reply);
  const now = new Date().toISOString();
  const { error } = await db()
    .from("plan_reviews")
    .update({ reply, reply_at: reply ? now : null, updated_at: now })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
