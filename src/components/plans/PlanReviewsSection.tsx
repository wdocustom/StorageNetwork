"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import ReviewCard from "@/components/reviews/ReviewCard";
import RatingSummary from "@/components/reviews/RatingSummary";
import Stars from "@/components/reviews/Stars";
import { PLAN_REVIEW_TAGS } from "@/lib/reviews";
import type { PlanReviewsData } from "@/app/actions/plan-reviews";

// Published DIY plan reviews on /plans: the summary, then reviews with photos
// first, three at a time.

const SHOW = 3;

/** "★★★★★ 4.9 from 23 builders" — shown once there are a few reviews. */
export function PlanRatingLine({ data, href, min = 3, className = "" }: { data: PlanReviewsData; href?: string; min?: number; className?: string }) {
  const { average, total } = data.summary;
  if (total < min) return null;
  const inner = (
    <>
      <Stars rating={average} size="sm" />
      <span>
        <strong className="text-white">{average.toFixed(1)}</strong> from {total} builder{total === 1 ? "" : "s"}
      </span>
    </>
  );
  return href ? (
    <a href={href} className={`inline-flex items-center gap-2 text-sm text-stone-400 hover:text-white ${className}`}>
      {inner}
    </a>
  ) : (
    <span className={`inline-flex items-center gap-2 text-sm text-stone-400 ${className}`}>{inner}</span>
  );
}

export default function PlanReviewsSection({ data, eyebrow, h2 }: { data: PlanReviewsData; eyebrow: string; h2: string }) {
  const [shown, setShown] = useState(SHOW);
  // Photos sell plans: reviews with photos first, otherwise newest first.
  const ordered = useMemo(
    () => [...data.reviews].sort((a, b) => Number(b.photos.length > 0) - Number(a.photos.length > 0)),
    [data.reviews],
  );
  if (!data.summary.total) return null;
  return (
    <section id="reviews" className="scroll-mt-4 border-t border-white/5 py-14">
      <p className={eyebrow}>From builders</p>
      <h2 className={h2}>What people who built it say.</h2>
      <p className="mb-6 mt-2 text-[15px] text-stone-400">Every review is from a verified plan buyer.</p>
      <RatingSummary summary={data.summary} />
      <div className="mt-4 space-y-3">
        {ordered.slice(0, shown).map((r) => (
          <ReviewCard
            key={r.id}
            tags={PLAN_REVIEW_TAGS}
            clamp
            review={{
              id: r.id,
              name: r.name,
              rating: r.rating,
              headline: r.headline,
              comment: r.comment,
              tags: r.tags,
              photos: r.photos,
              verified: true,
              when: r.when,
              meta: [r.product === "mini" ? "Mini plans" : null, r.meta].filter(Boolean).join(" · ") || null,
              reply: r.reply ? { by: "Storage Network", text: r.reply } : null,
            }}
          />
        ))}
      </div>
      {ordered.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + SHOW)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-800 py-2.5 text-xs font-bold text-slate-400 transition hover:border-slate-700 hover:text-white"
        >
          <ChevronDown className="h-4 w-4" />
          More reviews
        </button>
      )}
    </section>
  );
}
