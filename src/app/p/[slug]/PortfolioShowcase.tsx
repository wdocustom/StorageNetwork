"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { Star, Shield, ChevronLeft, ChevronRight, X, ChevronDown } from "lucide-react";
import { REVIEW_TAGS } from "@/config/review-tags";
import type { PublicReview, ReviewSummary } from "@/app/actions/reviews";

interface PortfolioPhoto {
  url: string;
  caption?: string;
}

interface Props {
  photos: PortfolioPhoto[];
  reviews: ReviewSummary | null;
  businessName: string;
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

export default function PortfolioShowcase({ photos, reviews, businessName }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const goNext = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % photos.length);
  }, [lightboxIndex, photos.length]);

  const goPrev = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length);
  }, [lightboxIndex, photos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [lightboxIndex, goNext, goPrev, closeLightbox]);

  const hasPhotos = photos.length > 0;
  const hasReviews = !!(reviews && reviews.totalReviews > 0);
  const tagMap = Object.fromEntries(REVIEW_TAGS.map((t) => [t.id, t]));

  if (!hasPhotos && !hasReviews) return null;

  const featuredReview = hasReviews
    ? reviews.reviews.find((r) => r.isVerified && r.comment && r.rating >= 4) || reviews.reviews[0]
    : null;

  const otherReviews = hasReviews
    ? reviews.reviews.filter((r) => r.id !== featuredReview?.id)
    : [];

  const maxGridReviews = showAllReviews ? otherReviews.length : Math.min(otherReviews.length, 4);
  const gridReviews = otherReviews.slice(0, maxGridReviews);

  type GridItem =
    | { type: "photo"; photo: PortfolioPhoto; photoIndex: number }
    | { type: "review"; review: PublicReview };

  const gridItems: GridItem[] = [];

  if (hasPhotos && gridReviews.length > 0) {
    const interval = Math.max(2, Math.ceil(photos.length / (gridReviews.length + 1)));
    let reviewIdx = 0;

    for (let i = 0; i < photos.length; i++) {
      gridItems.push({ type: "photo", photo: photos[i], photoIndex: i });

      if ((i + 1) % interval === 0 && reviewIdx < gridReviews.length) {
        gridItems.push({ type: "review", review: gridReviews[reviewIdx] });
        reviewIdx++;
      }
    }
    while (reviewIdx < gridReviews.length) {
      gridItems.push({ type: "review", review: gridReviews[reviewIdx] });
      reviewIdx++;
    }
  } else if (hasPhotos) {
    photos.forEach((photo, i) => gridItems.push({ type: "photo", photo, photoIndex: i }));
  } else {
    gridReviews.forEach((review) => gridItems.push({ type: "review", review }));
  }

  return (
    <section className="mx-auto max-w-3xl px-4 pb-8">
      {/* Section Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500">
          {hasPhotos && hasReviews ? "Work & Reviews" : hasPhotos ? "Our Work" : "Customer Reviews"}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
      </div>

      {/* ── Featured Testimonial ─────────────────────────────────── */}
      {featuredReview && featuredReview.comment && (
        <div className="relative mb-5 overflow-hidden rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-yellow-400/[0.04] via-[#0d1220] to-[#0d1220]">
          <div className="absolute -left-4 -top-2 text-[100px] font-black leading-none text-yellow-400/[0.07] select-none pointer-events-none">
            &ldquo;
          </div>
          <div className="relative px-6 py-6 sm:px-8 sm:py-7">
            <p className="mb-4 text-base font-medium leading-relaxed text-stone-200 sm:text-lg">
              {featuredReview.comment.length > 220
                ? featuredReview.comment.slice(0, 220).trimEnd() + "..."
                : featuredReview.comment}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <StarRating rating={featuredReview.rating} />
              <div className="h-4 w-px bg-slate-700" />
              <span className="text-sm font-bold text-white">{featuredReview.customerName}</span>
              {featuredReview.isVerified && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                  <Shield className="h-2.5 w-2.5" /> Verified
                </span>
              )}
              {featuredReview.tags.length > 0 && (
                <div className="flex gap-1.5">
                  {featuredReview.tags.slice(0, 3).map((tagId) => {
                    const tag = tagMap[tagId];
                    return (
                      <span
                        key={tagId}
                        className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[9px] font-semibold text-yellow-400/70"
                      >
                        {tag?.emoji} {tag?.label || tagId}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Review Summary Strip ─────────────────────────────────── */}
      {hasReviews && (
        <div className="mb-4 flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-2xl font-black text-white leading-none">{reviews.averageRating}</span>
            <div>
              <StarRating rating={Math.round(reviews.averageRating)} />
              <p className="mt-0.5 text-[9px] font-bold uppercase text-stone-500">
                {reviews.totalReviews} Review{reviews.totalReviews !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="hidden flex-1 sm:block">
            <div className="flex items-center gap-2">
              {reviews.ratingDistribution.map((d) => (
                <div key={d.stars} className="flex flex-1 items-center gap-1">
                  <span className="w-2 text-right text-[9px] text-stone-600">{d.stars}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-yellow-400" style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {reviews.topTags.length > 0 && (
            <div className="hidden gap-1.5 shrink-0 lg:flex">
              {reviews.topTags.slice(0, 3).map((t) => {
                const tag = tagMap[t.tag];
                return (
                  <span
                    key={t.tag}
                    className="rounded-full bg-slate-800 px-2 py-1 text-[9px] font-bold text-stone-400"
                  >
                    {tag?.emoji} {tag?.label || t.tag}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Interleaved Photo + Review Mosaic ────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {gridItems.map((item) => {
          if (item.type === "photo") {
            return (
              <button
                key={`photo-${item.photoIndex}`}
                onClick={() => setLightboxIndex(item.photoIndex)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800 transition-all hover:border-yellow-400/50 hover:shadow-lg hover:shadow-yellow-400/5 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
              >
                <Image
                  src={item.photo.url}
                  alt={item.photo.caption || `${businessName} project ${item.photoIndex + 1}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, 33vw"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                {item.photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="text-xs font-medium text-white drop-shadow-lg line-clamp-2">
                      {item.photo.caption}
                    </p>
                  </div>
                )}
              </button>
            );
          }

          const review = item.review;
          return (
            <div
              key={`review-${review.id}`}
              className="relative flex aspect-square flex-col justify-between overflow-hidden rounded-xl border border-slate-700/40 bg-gradient-to-br from-slate-800/80 to-slate-900 p-4"
            >
              <div className="absolute -right-2 -top-3 text-[72px] font-black leading-none text-yellow-400/[0.06] select-none pointer-events-none">
                &rdquo;
              </div>

              <div className="relative min-w-0">
                <StarRating rating={review.rating} />
                {review.headline && (
                  <p className="mt-1.5 text-xs font-bold text-white line-clamp-1">{review.headline}</p>
                )}
                {review.comment && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-stone-300 line-clamp-4">
                    {review.comment}
                  </p>
                )}
              </div>

              <div className="mt-auto pt-2">
                {review.tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {review.tags.slice(0, 2).map((tagId) => {
                      const tag = tagMap[tagId];
                      return (
                        <span
                          key={tagId}
                          className="rounded-full bg-yellow-400/10 px-1.5 py-0.5 text-[8px] font-semibold text-yellow-400/70"
                        >
                          {tag?.emoji} {tag?.label || tagId}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[10px] font-bold text-stone-400">{review.customerName}</p>
                  {review.isVerified && <Shield className="h-3 w-3 shrink-0 text-emerald-500" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show More Reviews */}
      {!showAllReviews && otherReviews.length > 4 && (
        <button
          onClick={() => setShowAllReviews(true)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-900/30 py-2.5 text-xs font-bold text-slate-400 transition-colors hover:border-slate-700 hover:text-white"
        >
          <ChevronDown className="h-4 w-4" />
          Show All {reviews!.totalReviews} Reviews
        </button>
      )}

      {/* ── Photo Lightbox ───────────────────────────────────────── */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="absolute left-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white/70">
            {lightboxIndex + 1} / {photos.length}
          </div>

          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-2 z-10 rounded-full bg-black/50 p-2 text-white/80 transition-colors hover:bg-black/70 hover:text-white sm:left-4"
            >
              <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
            </button>
          )}

          <div
            className="relative mx-12 max-h-[85vh] max-w-[90vw] sm:mx-20 sm:max-w-[80vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={photos[lightboxIndex].url}
              alt={photos[lightboxIndex].caption || `Photo ${lightboxIndex + 1}`}
              width={1200}
              height={900}
              className="max-h-[85vh] rounded-lg object-contain"
              unoptimized
            />
            {photos[lightboxIndex].caption && (
              <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-gradient-to-t from-black/80 to-transparent p-4 pt-8">
                <p className="text-center text-sm font-medium text-white">
                  {photos[lightboxIndex].caption}
                </p>
              </div>
            )}
          </div>

          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-2 z-10 rounded-full bg-black/50 p-2 text-white/80 transition-colors hover:bg-black/70 hover:text-white sm:right-4"
            >
              <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
