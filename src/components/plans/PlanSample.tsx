"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import type { TotePlanTier } from "@/lib/tote-plans";

// ═══════════════════════════════════════════════════════════════════════════
// "See a sample" for each plan tier on /plans/checkout: a two-picture
// snapshot on the card (with an ⓘ badge) that opens a swipeable preview of
// what the buyer gets — real screenshots of the 3D guide and the PDF.
// ═══════════════════════════════════════════════════════════════════════════

interface Slide {
  src: string;
  width: number;
  height: number;
  caption: string;
  /** A short muted loop; `src` is then its poster frame. */
  video?: string;
}

const SAMPLES: Record<TotePlanTier, { title: string; slides: Slide[] }> = {
  interactive: {
    title: "Interactive 3D Build Guide",
    slides: [
      {
        src: "/plan-samples/guide-demo-poster.jpg",
        video: "/plan-samples/guide-demo.mp4",
        width: 540,
        height: 1028,
        caption: "A real build guide on a phone: tap Next and each step builds itself in 3D.",
      },
      {
        src: "/plan-samples/guide-exploded.jpg",
        width: 720,
        height: 1451,
        caption: "Your exact build in 3D. Rotate, zoom and tap any piece for its size.",
      },
      {
        src: "/plan-samples/guide-step.jpg",
        width: 720,
        height: 1363,
        caption: "Step by step on your phone: each step animates in 3D, with the tools and screws it needs.",
      },
    ],
  },
  pdf: {
    title: "PDF Build Plan",
    slides: [
      {
        src: "/plan-samples/pdf-cover.jpg",
        width: 720,
        height: 927,
        caption: "A printable workbook for your design: cover, contents, drawings, shopping list and cut list.",
      },
      {
        src: "/plan-samples/pdf-step.jpg",
        width: 720,
        height: 919,
        caption: "One page per step: a 3D render, instructions, parts, tools and a pro tip.",
      },
    ],
  },
};

/** Clickable snapshot for a tier card. */
export function PlanSampleThumb({ tier, onOpen }: { tier: TotePlanTier; onOpen: () => void }) {
  const { title, slides } = SAMPLES[tier];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`See a sample of the ${title}`}
      className="group relative mb-4 block w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-left transition hover:border-yellow-400/50"
    >
      <div className="grid h-32 grid-cols-2 gap-px bg-slate-800">
        {slides.slice(0, 2).map((s) => (
          <Image
            key={s.src}
            src={s.src}
            alt=""
            width={s.width}
            height={s.height}
            sizes="(max-width: 640px) 45vw, 200px"
            className="h-32 w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />
      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-slate-950/90 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-yellow-400/60">
        <Info className="h-3.5 w-3.5 text-yellow-400" />
        See a sample
      </span>
    </button>
  );
}

/** Full-screen, swipeable preview of a tier's sample pictures. */
export function PlanSampleLightbox({ tier, onClose }: { tier: TotePlanTier; onClose: () => void }) {
  const { title, slides } = SAMPLES[tier];
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  });

  const go = (i: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, i));
    track.current?.scrollTo({ left: next * track.current.clientWidth, behavior: "smooth" });
    setIndex(next);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} sample`}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center gap-3 px-4 pb-2 pt-4" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">Sample</p>
          <p className="truncate text-sm font-bold text-white">{title}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close sample"
          className="rounded-full bg-slate-800 p-2 text-white transition hover:bg-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={track}
        onClick={(e) => e.stopPropagation()}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
      >
        {slides.map((s) => (
          <figure key={s.src} className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-3 px-4">
            <div className="relative min-h-0 w-full max-w-md flex-1">
              {s.video ? (
                <video
                  src={s.video}
                  poster={s.src}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-label={s.caption}
                  className="absolute inset-0 m-auto h-full max-h-full w-auto max-w-full rounded-2xl object-contain shadow-2xl shadow-black/50 ring-1 ring-white/10"
                />
              ) : (
                <Image src={s.src} alt={s.caption} fill sizes="(max-width: 640px) 100vw, 448px" className="object-contain" />
              )}
            </div>
            <figcaption className="max-w-md text-center text-sm text-stone-300">{s.caption}</figcaption>
          </figure>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 py-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous"
          className="rounded-full bg-slate-800 p-2 text-white transition hover:bg-slate-700 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-1.5">
          {slides.map((s, i) => (
            <span key={s.src} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-yellow-400" : "w-1.5 bg-slate-600"}`} />
          ))}
        </div>
        <button
          onClick={() => go(index + 1)}
          disabled={index === slides.length - 1}
          aria-label="Next"
          className="rounded-full bg-slate-800 p-2 text-white transition hover:bg-slate-700 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
