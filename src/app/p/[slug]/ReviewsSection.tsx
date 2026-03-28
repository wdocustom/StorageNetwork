"use client";

import { useEffect, useState } from "react";
import { getInstallerReviews, type ReviewSummary } from "@/app/actions/reviews";
import { REVIEW_TAGS } from "@/config/review-tags";
import { Star, Shield, ChevronDown } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Reviews Section — Displayed on installer portfolio page /p/[slug]
// Fetches and displays verified customer reviews with rating summary.
// Only renders if the installer has show_reviews enabled and has reviews.
// ═══════════════════════════════════════════════════════════════════════════

interface ReviewsSectionProps {
  installerId: string;
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${cls} ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-slate-700"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsSection({ installerId }: ReviewsSectionProps) {
  const [data, setData] = useState<ReviewSummary | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    getInstallerReviews(installerId).then(setData);
  }, [installerId]);

  if (!data || data.totalReviews === 0) return null;

  const displayReviews = showAll ? data.reviews : data.reviews.slice(0, 3);
  const tagMap = Object.fromEntries(REVIEW_TAGS.map((t) => [t.id, t]));

  return (
    <section className="mx-auto max-w-3xl px-4 pb-6">
      {/* Section Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500">
          Customer Reviews
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
      </div>

      {/* Summary Card */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 p-6 mb-4">
        <div className="flex items-center gap-6">
          {/* Big Rating Number */}
          <div className="text-center shrink-0">
            <p className="text-4xl font-black text-white leading-none">{data.averageRating}</p>
            <StarRating rating={Math.round(data.averageRating)} size="lg" />
            <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase">
              {data.totalReviews} Review{data.totalReviews !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Rating Distribution Bars */}
          <div className="flex-1 space-y-1">
            {data.ratingDistribution.map((d) => (
              <div key={d.stars} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-3 text-right">{d.stars}</span>
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-600 w-6 text-right">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Tags */}
        {data.topTags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex flex-wrap gap-2">
              {data.topTags.map((t) => {
                const tag = tagMap[t.tag];
                return (
                  <span
                    key={t.tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-[10px] font-bold text-slate-400"
                  >
                    {tag?.emoji} {tag?.label || t.tag}
                    <span className="text-slate-600">&middot; {t.count}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Individual Reviews */}
      <div className="space-y-3">
        {displayReviews.map((review) => (
          <div
            key={review.id}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <StarRating rating={review.rating} />
                  {review.isVerified && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 uppercase">
                      <Shield className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>
                {review.headline && (
                  <p className="text-sm font-bold text-white">{review.headline}</p>
                )}
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-[10px] text-slate-500">{review.timeAgo}</p>
              </div>
            </div>

            {review.comment && (
              <p className="text-sm text-slate-400 leading-relaxed mb-2">{review.comment}</p>
            )}

            {/* Review Tags */}
            {review.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {review.tags.map((tagId) => {
                  const tag = tagMap[tagId];
                  return (
                    <span
                      key={tagId}
                      className="text-[9px] font-semibold bg-yellow-400/10 text-yellow-400/70 px-2 py-0.5 rounded-full"
                    >
                      {tag?.emoji} {tag?.label || tagId}
                    </span>
                  );
                })}
              </div>
            )}

            <p className="text-[10px] text-slate-600">{review.customerName} &middot; {review.createdAt}</p>
          </div>
        ))}
      </div>

      {/* Show More */}
      {data.reviews.length > 3 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 flex items-center justify-center gap-1 w-full rounded-xl border border-slate-800 bg-slate-900/30 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
          Show All {data.reviews.length} Reviews
        </button>
      )}
    </section>
  );
}
