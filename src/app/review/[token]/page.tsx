"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getReviewPageData,
  submitReview,
  type ReviewPageData,
} from "@/app/actions/reviews";
import { REVIEW_TAGS } from "@/config/review-tags";
import { Star, CheckCircle2, Loader2 } from "lucide-react";
import ReviewForm from "@/components/reviews/ReviewForm";

// ═══════════════════════════════════════════════════════════════════════════
// Customer Review Page — /review/[token]
//
// One-time review submission. Token-based, no login required.
// Accessible from the receipt email after job completion.
// ═══════════════════════════════════════════════════════════════════════════

export default function ReviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageData, setPageData] = useState<ReviewPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
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
          {pageData.requestQuoteUrl && (
            <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="mb-1 text-sm font-bold text-white">Want another one?</p>
              <p className="mb-3 text-xs text-slate-400">
                Another rack, a top, wheels or overhead storage — {pageData.installerName} will send you a quote.
              </p>
              <a
                href={pageData.requestQuoteUrl}
                className="inline-block rounded-lg bg-yellow-400 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-950 hover:bg-yellow-300"
              >
                Request a New Quote
              </a>
            </div>
          )}
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
        <ReviewForm
          question="How was your experience?"
          tags={REVIEW_TAGS}
          commentPlaceholder="Tell other homeowners about your experience..."
          photoPrompt="Photos of your new storage"
          publicNote="Verified customer · Your review and photos will be public"
          onSubmit={async (form) => {
            form.set("token", token);
            const res = await submitReview(form);
            if (!res.success) return { ok: false, error: res.error || "Failed to submit review" };
            setRating(Number(form.get("rating")));
            setSubmitted(true);
            return { ok: true };
          }}
        />

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
