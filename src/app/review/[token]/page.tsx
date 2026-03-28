"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getReviewPageData,
  submitReview,
  REVIEW_TAGS,
  type ReviewPageData,
} from "@/app/actions/reviews";
import { Star, CheckCircle2, Loader2, Shield } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Customer Review Page — /review/[token]
//
// One-time review submission. Token-based, no login required.
// Accessible from the receipt email after job completion.
// ═══════════════════════════════════════════════════════════════════════════

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export default function ReviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageData, setPageData] = useState<ReviewPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [headline, setHeadline] = useState("");
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getReviewPageData(token).then((result) => {
      if (result.data) {
        setPageData(result.data);
        if (result.data.alreadyReviewed) setSubmitted(true);
      } else {
        setError(result.error || "Review not found");
      }
      setLoading(false);
    });
  }, [token]);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);

    const result = await submitReview({
      token,
      rating,
      headline: headline.trim() || undefined,
      comment: comment.trim() || undefined,
      tags: selectedTags,
    });

    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error || "Failed to submit review");
    }
    setSubmitting(false);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (error && !pageData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Star className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Link Not Found</h1>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!pageData) return null;

  // ── Submitted State ────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Thank You!</h1>
          <p className="text-slate-400 text-sm mb-6">
            Your review helps other homeowners find great installers.
            {pageData.installerName !== "Your Installer" &&
              ` ${pageData.installerName} will appreciate your feedback.`}
          </p>
          <div className="flex justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-6 h-6 ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-slate-700"}`}
              />
            ))}
          </div>
          <a
            href="/"
            className="inline-block text-xs text-slate-500 hover:text-yellow-400 transition-colors"
          >
            Powered by Storage Network
          </a>
        </div>
      </div>
    );
  }

  // ── Review Form ────────────────────────────────────────────────────
  const displayRating = hoverRating || rating;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400 mb-3">
            Verified Customer Review
          </p>
          {/* Installer card */}
          <div className="flex items-center justify-center gap-3 mb-3">
            {pageData.installerAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pageData.installerAvatar}
                alt=""
                className="w-14 h-14 rounded-full object-cover border-2 border-yellow-400/50"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                <span className="text-xl font-bold text-slate-500">
                  {pageData.installerName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="text-left">
              <h1 className="text-lg font-bold text-white">{pageData.installerName}</h1>
              <p className="text-xs text-slate-400">
                {pageData.jobDescription}
                {pageData.completedDate && ` \u2022 ${pageData.completedDate}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Star Rating */}
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-300 mb-3">
            How was your experience?
          </p>
          <div className="flex justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(s)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    s <= displayRating
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-slate-700 hover:text-slate-600"
                  }`}
                />
              </button>
            ))}
          </div>
          {displayRating > 0 && (
            <p className={`text-sm font-bold transition-colors ${
              displayRating >= 4 ? "text-yellow-400" : displayRating >= 3 ? "text-slate-300" : "text-orange-400"
            }`}>
              {RATING_LABELS[displayRating]}
            </p>
          )}
        </div>

        {/* Tag Badges — only show after rating */}
        {rating > 0 && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">
              What stood out? <span className="text-slate-600 normal-case font-normal">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {REVIEW_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedTags.includes(tag.id)
                      ? "bg-yellow-400/20 border border-yellow-400/50 text-yellow-400"
                      : "bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <span>{tag.emoji}</span>
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Written Review — only show after rating */}
        {rating > 0 && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">
                Headline <span className="text-slate-600 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Summarize your experience in a few words"
                maxLength={100}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">
                Your Review <span className="text-slate-600 normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell other homeowners about your experience..."
                rows={4}
                maxLength={1000}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400 resize-none"
              />
              <p className="text-[10px] text-slate-600 text-right mt-1">
                {comment.length}/1000
              </p>
            </div>
          </div>
        )}

        {/* Submit */}
        {rating > 0 && (
          <div className="space-y-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-yellow-400 text-slate-900 font-bold text-sm py-3.5 rounded-xl hover:bg-yellow-300 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Star className="w-5 h-5" />
              )}
              Submit Review
            </button>

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
              <Shield className="w-3 h-3" />
              Verified purchase &bull; Your review will be public
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-[10px] text-slate-600">
            Powered by{" "}
            <a href="/" className="text-slate-500 hover:text-yellow-400">
              Storage Network
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
