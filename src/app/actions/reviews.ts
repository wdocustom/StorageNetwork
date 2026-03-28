"use server";

import { randomBytes } from "crypto";
import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Customer Reviews — Server Actions
//
// Token-based review system. No customer login required.
// Each completed job gets a unique review_token embedded in the receipt
// email. Customer clicks the link, lands on /review/[token], writes
// their review. One review per job, verified by token.
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

// ── Review Tags (quick-tap badges) ───────────────────────────────────────

export const REVIEW_TAGS = [
  { id: "professional", label: "Professional", emoji: "\u{1F4BC}" },
  { id: "on_time", label: "On Time", emoji: "\u{23F0}" },
  { id: "clean_work", label: "Clean Work", emoji: "\u{2728}" },
  { id: "great_value", label: "Great Value", emoji: "\u{1F4B0}" },
  { id: "friendly", label: "Friendly", emoji: "\u{1F44D}" },
  { id: "fast", label: "Fast", emoji: "\u{26A1}" },
  { id: "quality_build", label: "Quality Build", emoji: "\u{1F3D7}\u{FE0F}" },
  { id: "would_recommend", label: "Would Recommend", emoji: "\u{2B50}" },
] as const;

// ── Generate review token for a completed job ────────────────────────────

export async function generateReviewToken(leadId: string): Promise<string | null> {
  const token = randomBytes(16).toString("hex");

  const { error } = await db()
    .from("leads")
    .update({ review_token: token })
    .eq("id", leadId)
    .is("review_token", null); // Only set if not already set

  if (error) {
    console.error("[Reviews] Failed to generate token:", error.message);
    return null;
  }

  return token;
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
    },
  };
}

// ── Submit a review ──────────────────────────────────────────────────────

export async function submitReview(input: {
  token: string;
  rating: number;
  headline?: string;
  comment?: string;
  tags: string[];
}): Promise<{ success: boolean; error?: string }> {
  const { token, rating, headline, comment, tags } = input;

  if (!token || token.length < 16) return { success: false, error: "Invalid token" };
  if (rating < 1 || rating > 5) return { success: false, error: "Rating must be 1-5" };

  // Look up the lead
  const { data: lead } = await db()
    .from("leads")
    .select("id, installer_id, customer_name, review_submitted")
    .eq("review_token", token)
    .maybeSingle();

  if (!lead) return { success: false, error: "Review link not found" };
  if (lead.review_submitted) return { success: false, error: "You already submitted a review for this job" };
  if (!lead.installer_id) return { success: false, error: "No installer associated with this job" };

  // Insert the review
  const { error: insertError } = await db()
    .from("installer_reviews")
    .insert({
      installer_id: lead.installer_id,
      lead_id: lead.id,
      review_token: token,
      customer_name: lead.customer_name || "Customer",
      rating,
      headline: headline?.trim() || null,
      comment: comment?.trim() || null,
      tags: tags.filter(Boolean),
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

  // Mark lead as reviewed
  await db()
    .from("leads")
    .update({ review_submitted: true })
    .eq("id", lead.id);

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
  const { data: reviews } = await db()
    .from("installer_reviews")
    .select("id, customer_name, rating, headline, comment, tags, is_verified, created_at")
    .eq("installer_id", installerId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!reviews || reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0, pct: 0 })),
      topTags: [],
      reviews: [],
    };
  }

  // Calculate stats
  const totalReviews = reviews.length;
  const sumRatings = reviews.reduce((sum, r) => sum + (r.rating as number), 0);
  const averageRating = Math.round((sumRatings / totalReviews) * 10) / 10;

  // Rating distribution
  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) ratingCounts[r.rating as number]++;
  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: ratingCounts[stars],
    pct: totalReviews > 0 ? Math.round((ratingCounts[stars] / totalReviews) * 100) : 0,
  }));

  // Top tags
  const tagCounts: Record<string, number> = {};
  for (const r of reviews) {
    const tags = (r.tags as string[]) || [];
    for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
  }
  const topTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Format time ago
  const now = Date.now();
  const formatTimeAgo = (dateStr: string) => {
    const diff = now - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  return {
    averageRating,
    totalReviews,
    ratingDistribution,
    topTags,
    reviews: reviews.map((r) => ({
      id: r.id as string,
      customerName: (r.customer_name as string).split(" ")[0] + " " +
        ((r.customer_name as string).split(" ")[1]?.charAt(0) || "") + ".",
      rating: r.rating as number,
      headline: r.headline as string | null,
      comment: r.comment as string | null,
      tags: (r.tags as string[]) || [],
      isVerified: r.is_verified as boolean,
      createdAt: new Date(r.created_at as string).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      timeAgo: formatTimeAgo(r.created_at as string),
    })),
  };
}

// ── Toggle show_reviews on profile ───────────────────────────────────────

export async function toggleShowReviews(
  installerId: string,
  show: boolean
): Promise<{ success: boolean }> {
  const { error } = await db()
    .from("profiles")
    .update({ show_reviews: show })
    .eq("id", installerId);

  if (error) {
    console.error("[Reviews] Toggle error:", error.message);
    return { success: false };
  }
  return { success: true };
}
