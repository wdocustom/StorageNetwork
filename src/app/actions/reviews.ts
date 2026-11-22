"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { requestQuoteUrl } from "@/lib/server/request-link";
import { getAuthenticatedUser, verifyLeadOwnership } from "@/lib/auth";
import { ensureLeadReviewToken } from "@/lib/server/review-token";
import { photoFiles, uploadReviewPhotos } from "@/lib/server/review-photos";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import { REVIEW_TAGS } from "@/config/review-tags";
import { REVIEW_LIMITS, cleanTags, cleanText, publicName, summarizeRatings, timeAgo } from "@/lib/reviews";

// ═══════════════════════════════════════════════════════════════════════════
// Customer Reviews — Server Actions
//
// Token-based review system. No customer login required.
// Writes go through the service role only (migration 166 removed the open
// INSERT policy); installer-side actions use the signed-in session.
// Each completed job gets a unique review_token embedded in the receipt
// email. Customer clicks the link, lands on /review/[token], writes
// their review. One review per job, verified by token.
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

// ── Review link for a job (installer "copy link") ───────────────────────
// Only the signed-in installer who owns the job. Job completion and the
// Stripe webhook use ensureLeadReviewToken directly.

export async function generateReviewToken(leadId: string): Promise<string | null> {
  if (typeof leadId !== "string" || !leadId) return null;
  if (!(await verifyLeadOwnership(leadId))) return null;
  return ensureLeadReviewToken(leadId);
}

// ── Get review page data (validates token, returns job context) ──────────

export interface ReviewPageData {
  leadId: string;
  customerName: string;
  installerName: string;
  installerAvatar: string | null;
  jobDescription: string;
  completedDate: string | null;
  alreadyReviewed: boolean;
  /** Signed link to request a new quote from the same installer. */
  requestQuoteUrl: string | null;
}

export async function getReviewPageData(token: string): Promise<{
  data: ReviewPageData | null;
  error?: string;
}> {
  if (!token || token.length < 16) {
    return { data: null, error: "Invalid review link" };
  }

  // Find the lead by token
  const { data: lead } = await db()
    .from("leads")
    .select("id, customer_name, installer_id, quote_data, completed_at, review_submitted")
    .eq("review_token", token)
    .maybeSingle();

  if (!lead) {
    return { data: null, error: "Review link not found or has expired" };
  }

  // Get installer info
  let installerName = "Your Installer";
  let installerAvatar: string | null = null;

  if (lead.installer_id) {
    const { data: profile } = await db()
      .from("profiles")
      .select("business_name, first_name, last_name, avatar_url")
      .eq("id", lead.installer_id)
      .maybeSingle();

    if (profile) {
      installerName =
        (profile.business_name as string) ||
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        "Your Installer";
      installerAvatar = (profile.avatar_url as string) || null;
    }
  }

  // Parse job description from quote_data
  let jobDescription = "Storage rack installation";
  if (lead.quote_data && typeof lead.quote_data === "object") {
    const qd = lead.quote_data as Record<string, unknown>;
    if (qd.description) jobDescription = qd.description as string;
    else if (qd.config) jobDescription = "Custom tote storage rack";
  }

  return {
    data: {
      leadId: lead.id as string,
      customerName: (lead.customer_name as string) || "Customer",
      installerName,
      installerAvatar,
      jobDescription,
      completedDate: lead.completed_at ? new Date(lead.completed_at as string).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }) : null,
      alreadyReviewed: !!(lead.review_submitted),
      requestQuoteUrl: requestQuoteUrl(lead.id as string, "review") ?? null,
    },
  };
}

// ── Submit a review ──────────────────────────────────────────────────────
// FormData: token, rating, headline, comment, tags (JSON array), photos (JPEGs).
// The one-time link is the proof: the job's customer got it by email.

export async function submitReview(form: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    await enforceActionRateLimit({ action: "reviews.submitReview", limit: 10, window: "10 m", identify: "ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { success: false, error: err.message };
    throw err;
  }

  const token = form.get("token");
  const rating = Number(form.get("rating"));
  if (typeof token !== "string" || token.length < 16) return { success: false, error: "Invalid token" };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { success: false, error: "Rating must be 1-5" };

  const { data: lead } = await db()
    .from("leads")
    .select("id, installer_id, customer_name, review_submitted")
    .eq("review_token", token)
    .maybeSingle();

  if (!lead) return { success: false, error: "Review link not found" };
  if (lead.review_submitted) return { success: false, error: "You already submitted a review for this job" };
  if (!lead.installer_id) return { success: false, error: "No installer associated with this job" };

  let tags: unknown = [];
  try {
    tags = JSON.parse(String(form.get("tags") ?? "[]"));
  } catch {
    tags = [];
  }

  const photos = await uploadReviewPhotos(`installer/${lead.installer_id}/${lead.id}`, photoFiles(form));
  if (!photos.ok) return { success: false, error: photos.error };

  const { error: insertError } = await db()
    .from("installer_reviews")
    .insert({
      installer_id: lead.installer_id,
      lead_id: lead.id,
      review_token: token,
      customer_name: lead.customer_name || "Customer",
      rating,
      headline: cleanText(form.get("headline"), REVIEW_LIMITS.headline),
      comment: cleanText(form.get("comment"), REVIEW_LIMITS.comment),
      tags: cleanTags(tags, REVIEW_TAGS),
      photos: photos.urls,
      is_verified: true,
      is_published: true,
    });

  if (insertError) {
    console.error("[Reviews] Insert error:", insertError.message);
    if (insertError.message.includes("duplicate")) {
      return { success: false, error: "A review has already been submitted for this job" };
    }
    return { success: false, error: "Failed to submit review" };
  }

  await db().from("leads").update({ review_submitted: true }).eq("id", lead.id);
  return { success: true };
}

// ── Get reviews for an installer (portfolio display) ─────────────────────

export interface PublicReview {
  id: string;
  customerName: string;
  rating: number;
  headline: string | null;
  comment: string | null;
  tags: string[];
  photos: string[];
  reply: string | null;
  isVerified: boolean;
  createdAt: string;
  timeAgo: string;
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: { stars: number; count: number; pct: number }[];
  topTags: { tag: string; count: number }[];
  reviews: PublicReview[];
}

export async function getInstallerReviews(installerId: string): Promise<ReviewSummary> {
  // Stats over every published review; the list is the latest 50.
  const [{ data: all }, { data: reviews }] = await Promise.all([
    db().from("installer_reviews").select("rating, tags").eq("installer_id", installerId).eq("is_published", true).limit(10000),
    db()
      .from("installer_reviews")
      .select("id, customer_name, rating, headline, comment, tags, photos, reply, is_verified, created_at")
      .eq("installer_id", installerId)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const summary = summarizeRatings((all ?? []) as { rating: number; tags: string[] | null }[]);
  return {
    averageRating: summary.average,
    totalReviews: summary.total,
    ratingDistribution: summary.distribution,
    topTags: summary.topTags,
    reviews: (reviews ?? []).map((r) => ({
      id: r.id as string,
      customerName: publicName(r.customer_name as string, "Customer"),
      rating: r.rating as number,
      headline: r.headline as string | null,
      comment: r.comment as string | null,
      tags: (r.tags as string[]) || [],
      photos: (r.photos as string[]) || [],
      reply: (r.reply as string | null) ?? null,
      isVerified: r.is_verified as boolean,
      createdAt: new Date(r.created_at as string).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      timeAgo: timeAgo(r.created_at as string),
    })),
  };
}

// ── Toggle show_reviews on the signed-in installer's profile ─────────────

export async function toggleShowReviews(show: boolean): Promise<{ success: boolean }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false };
  const { error } = await db().from("profiles").update({ show_reviews: !!show }).eq("id", user.id);
  if (error) {
    console.error("[Reviews] Toggle error:", error.message);
    return { success: false };
  }
  return { success: true };
}

// ── The review on one of the signed-in installer's jobs, and their reply ──

export interface MyLeadReview {
  id: string;
  rating: number;
  headline: string | null;
  comment: string | null;
  tags: string[];
  photos: string[];
  reply: string | null;
  createdAt: string;
}

export async function getMyLeadReview(leadId: string): Promise<MyLeadReview | null> {
  if (typeof leadId !== "string" || !leadId) return null;
  const installerId = await verifyLeadOwnership(leadId);
  if (!installerId) return null;
  const { data } = await db()
    .from("installer_reviews")
    .select("id, rating, headline, comment, tags, photos, reply, created_at")
    .eq("lead_id", leadId)
    .eq("installer_id", installerId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    rating: data.rating as number,
    headline: (data.headline as string | null) ?? null,
    comment: (data.comment as string | null) ?? null,
    tags: (data.tags as string[]) || [],
    photos: (data.photos as string[]) || [],
    reply: (data.reply as string | null) ?? null,
    createdAt: data.created_at as string,
  };
}

/** Post, edit or (empty text) remove the installer's public reply. */
export async function replyToReview(leadId: string, text: string): Promise<{ success: boolean; error?: string }> {
  if (typeof leadId !== "string" || !leadId) return { success: false, error: "Job not found" };
  const installerId = await verifyLeadOwnership(leadId);
  if (!installerId) return { success: false, error: "Job not found" };
  const reply = cleanText(text, REVIEW_LIMITS.reply);
  const { error } = await db()
    .from("installer_reviews")
    .update({ reply, reply_at: reply ? new Date().toISOString() : null })
    .eq("lead_id", leadId)
    .eq("installer_id", installerId);
  if (error) {
    console.error("[Reviews] Reply error:", error.message);
    return { success: false, error: "Couldn't save your reply" };
  }
  return { success: true };
}

// ── Request a review (installer-initiated for past jobs) ─────────────────

export async function requestReview(input: { leadId: string }): Promise<{ success: boolean; error?: string }> {
  const leadId = input?.leadId;
  if (typeof leadId !== "string" || !leadId) return { success: false, error: "Job not found" };
  // The installer is whoever is signed in, never a value from the browser.
  const installerId = await verifyLeadOwnership(leadId);
  if (!installerId) return { success: false, error: "Job not found" };

  // Verify the lead belongs to this installer and is paid
  const { data: lead } = await db()
    .from("leads")
    .select("id, customer_name, customer_email, installer_id, status, review_token, review_submitted, estimated_price, quote_data")
    .eq("id", leadId)
    .eq("installer_id", installerId)
    .maybeSingle();

  if (!lead) return { success: false, error: "Job not found" };
  if (lead.status !== "paid") return { success: false, error: "Reviews can only be requested for completed jobs" };
  if (lead.review_submitted) return { success: false, error: "Customer already submitted a review" };
  if (!lead.customer_email) return { success: false, error: "No customer email on file" };

  // Generate token if not already set
  let reviewToken = lead.review_token as string | null;
  if (!reviewToken) {
    reviewToken = await generateReviewToken(leadId);
    if (!reviewToken) return { success: false, error: "Failed to generate review link" };
  }

  // Get installer profile for the email
  const { data: profile } = await db()
    .from("profiles")
    .select("business_name, first_name, last_name, avatar_url")
    .eq("id", installerId)
    .maybeSingle();

  const installerName =
    (profile?.business_name as string) ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Your Installer";
  const avatarUrl = (profile?.avatar_url as string) || null;

  // Parse job description
  let jobDescription = "storage rack installation";
  const qd = lead.quote_data;
  if (Array.isArray(qd) && qd.length > 0) {
    jobDescription = `${qd.length} shelving unit${qd.length !== 1 ? "s" : ""}`;
  }

  // Send the review request email
  const { getAppUrl } = await import("@/lib/url-helper");
  const { sendTransactionalEmail, emailShell } = await import("@/lib/email");

  const reviewUrl = `${getAppUrl()}/review/${reviewToken}`;
  const newQuoteUrl = requestQuoteUrl(leadId, "review");
  const safeName = (lead.customer_name as string || "").split(" ")[0] || "there";

  // Avatar or initial
  const avatarHtml = avatarUrl
    ? `<img src="${avatarUrl}" alt="${installerName}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #facc15;" />`
    : `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#facc15,#f59e0b);display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#1e293b;">${installerName.charAt(0).toUpperCase()}</div>`;

  const html = emailShell(
    "How Did We Do?",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${safeName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      Thank you for choosing us for your ${jobDescription}! We&rsquo;d love to hear about your experience.
    </p>

    <!-- Installer Card -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <div style="margin-bottom:12px;">${avatarHtml}</div>
      <p style="margin:0 0 4px;color:#facc15;font-size:18px;font-weight:800;">${installerName}</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your Installer</p>
    </div>

    <!-- Star Visual -->
    <div style="text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#94a3b8;font-size:14px;">Rate your experience:</p>
      <div style="font-size:32px;letter-spacing:4px;">&#11088;&#11088;&#11088;&#11088;&#11088;</div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${reviewUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Leave a Review
      </a>
    </div>

    <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;text-align:center;">
      It takes less than 30 seconds and helps other homeowners
      find great installers in their area.
    </p>

    <p style="margin:0;color:#475569;font-size:12px;text-align:center;font-style:italic;">
      No login required &mdash; just click the button above.
    </p>
    ${newQuoteUrl ? `
    <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #334155;color:#94a3b8;font-size:13px;text-align:center;">
      Need another rack, a top, wheels or overhead storage?
      <a href="${newQuoteUrl}" style="color:#facc15;font-weight:700;">Request a new quote</a>
    </p>
    ` : ""}
    `
  );

  const result = await sendTransactionalEmail({
    to: lead.customer_email as string,
    toName: lead.customer_name as string,
    subject: `How was your experience with ${installerName}?`,
    html,
  });

  if (!result.success) {
    return { success: false, error: result.error || "Failed to send email" };
  }

  // Log activity
  const { logActivityInternal } = await import("@/app/actions/installer-activity");
  await logActivityInternal(installerId, "review_requested", { leadId });

  return { success: true };
}

// ── Get review stats for an installer (dashboard summary) ────────────────

export interface InstallerReviewStats {
  averageRating: number;
  totalReviews: number;
  pendingRequests: number;
}

export async function getInstallerReviewStats(): Promise<InstallerReviewStats> {
  const user = await getAuthenticatedUser();
  if (!user) return { averageRating: 0, totalReviews: 0, pendingRequests: 0 };
  const installerId = user.id;
  const { data: reviews } = await db()
    .from("installer_reviews")
    .select("rating")
    .eq("installer_id", installerId)
    .eq("is_published", true);

  const totalReviews = reviews?.length || 0;
  const averageRating = totalReviews > 0
    ? Math.round((reviews!.reduce((sum, r) => sum + (r.rating as number), 0) / totalReviews) * 10) / 10
    : 0;

  const { count } = await db()
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("installer_id", installerId)
    .not("review_token", "is", null)
    .or("review_submitted.is.null,review_submitted.eq.false");

  return {
    averageRating,
    totalReviews,
    pendingRequests: count || 0,
  };
}
