"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, MessageSquareReply, X } from "lucide-react";
import Stars from "@/components/reviews/Stars";
import type { ReviewTag } from "@/lib/reviews";

// ═══════════════════════════════════════════════════════════════════════════
// One review as shown publicly (plans + installer pages): stars, headline,
// words, what stood out, photos (tap to enlarge), who, and a reply.
// ═══════════════════════════════════════════════════════════════════════════

export interface ReviewView {
  id: string;
  name: string;
  rating: number;
  headline: string | null;
  comment: string | null;
  tags: string[];
  photos: string[];
  verified: boolean;
  /** "3 weeks ago" */
  when: string;
  /** "Built an 8×4 rolling rack · First build · 4 hrs" */
  meta?: string | null;
  reply?: { by: string; text: string } | null;
}

export function PhotoLightbox({ photos, start, onClose }: { photos: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => (n + 1) % photos.length);
      if (e.key === "ArrowLeft") setI((n) => (n - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, onClose]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Review photo"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white/80 hover:text-white"
      >
        <X className="h-6 w-6" />
      </button>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              setI((n) => (n - 1 + photos.length) % photos.length);
            }}
            className="absolute left-2 rounded-full bg-black/50 p-2 text-white/80 hover:text-white"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              setI((n) => (n + 1) % photos.length);
            }}
            className="absolute right-2 rounded-full bg-black/50 p-2 text-white/80 hover:text-white"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[i]}
        alt={`Review photo ${i + 1} of ${photos.length}`}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export default function ReviewCard({ review, tags, clamp = false }: { review: ReviewView; tags: readonly ReviewTag[]; clamp?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const tagMap = new Map(tags.map((t) => [t.id, t]));
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <Stars rating={review.rating} />
        <span className="shrink-0 text-[11px] text-slate-500">{review.when}</span>
      </div>
      {review.headline && <h3 className="mt-2 text-sm font-bold text-white">{review.headline}</h3>}
      {review.comment && (
        <p className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed text-stone-300 ${clamp ? "line-clamp-5" : ""}`}>
          {review.comment}
        </p>
      )}
      {review.photos.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {review.photos.map((src, i) => (
            <button
              key={`${i}-${src}`}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open photo ${i + 1}`}
              className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-700 transition hover:border-yellow-400/60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {review.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {review.tags.slice(0, 4).map((id) => {
            const t = tagMap.get(id);
            return t ? (
              <span key={id} className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-300/80">
                {t.emoji} {t.label}
              </span>
            ) : null;
          })}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span className="font-bold text-stone-300">{review.name}</span>
        {review.verified && (
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            Verified
          </span>
        )}
        {review.meta && <span className="text-slate-500">· {review.meta}</span>}
      </div>
      {review.reply && (
        <div className="mt-3 rounded-xl border-l-2 border-yellow-400/50 bg-slate-800/60 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-300">
            <MessageSquareReply className="h-3.5 w-3.5" aria-hidden />
            Reply from {review.reply.by}
          </p>
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-stone-300">{review.reply.text}</p>
        </div>
      )}
      {open !== null && <PhotoLightbox photos={review.photos} start={open} onClose={() => setOpen(null)} />}
    </article>
  );
}
