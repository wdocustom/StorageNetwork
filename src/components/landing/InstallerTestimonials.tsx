"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, BadgeCheck, Quote, MessageCircle } from "lucide-react";

interface Testimonial {
  name: string;
  business: string;
  slug: string;
  initials: string;
  avatarUrl?: string;
  text: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Joe Long",
    business: "Elite Storage Systems",
    slug: "elite-storage-systems",
    initials: "JL",
    text: "I give everybody my Storage Network link. If they’re outside my area, the platform hands the job to a local installer and pays me 30% just for the referral. Passive income on jobs I don’t even drive to.",
  },
  {
    name: "Mathew Gass",
    business: "Mathew Gass Woodworks",
    slug: "mathew-gass-woodworks",
    initials: "MG",
    text: "I just send them my link. They pull out their phone, design their system in 3D, and book it right there. I don’t have to ‘sell’ the job anymore. Gamechanger.",
  },
  {
    name: "Michael Fujiwara",
    business: "Rack City Totes",
    slug: "rack-city-totes",
    initials: "MF",
    text: "Everything in one place. Customers answer their own questions, deposits collected through the app. It’s helped me grow without getting overwhelmed.",
  },
];

export default function InstallerTestimonials() {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(0);

  const next = useCallback(() => {
    setActive((i) => (i + 1) % TESTIMONIALS.length);
  }, []);

  const prev = useCallback(() => {
    setActive((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(next, 8000);
    return () => clearInterval(interval);
  }, [isPaused, next]);

  const t = TESTIMONIALS[active];

  return (
    <section className="border-t border-stone-800/50 bg-gradient-to-b from-slate-950 to-gray-950 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-400">
          From Our Installers
        </p>
        <h2 className="mb-4 text-center text-3xl font-black uppercase text-white sm:text-4xl">
          Real <span className="text-yellow-400">Results</span>
        </h2>
        <p className="mx-auto mb-10 max-w-lg text-center text-sm leading-relaxed text-stone-400">
          Don&apos;t take our word for it&mdash;these are real installers earning real money on the platform.
          <span className="mt-1 flex items-center justify-center gap-1.5 text-yellow-400/80">
            <MessageCircle className="inline h-3.5 w-3.5" />
            <span className="text-xs font-semibold">
              Visit their profiles and ask them yourself.
            </span>
          </span>
        </p>

        {/* Testimonial Card */}
        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
            setIsPaused(true);
          }}
          onTouchEnd={(e) => {
            const delta = e.changedTouches[0].clientX - touchStartX.current;
            if (delta > 50) prev();
            else if (delta < -50) next();
            setIsPaused(false);
          }}
        >
          <div className="rounded-2xl border border-stone-800 bg-gray-900/80 p-8 sm:p-10">
            <Quote className="mx-auto mb-6 h-8 w-8 text-yellow-400/30" />

            <p className="mb-8 text-center text-sm leading-relaxed text-stone-300 sm:text-base sm:leading-relaxed">
              &ldquo;{t.text}&rdquo;
            </p>

            <div className="flex flex-col items-center">
              <a
                href={`/p/${t.slug}`}
                className="group/avatar relative mb-3 block"
              >
                <div className="h-16 w-16 overflow-hidden rounded-full ring-[3px] ring-yellow-400 bg-slate-800 shadow-lg shadow-yellow-400/20 transition-transform group-hover/avatar:scale-110">
                  {t.avatarUrl ? (
                    <img
                      src={t.avatarUrl}
                      alt={t.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                      <span className="text-lg font-black text-yellow-400">
                        {t.initials}
                      </span>
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-900 bg-emerald-500 shadow-sm">
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </a>

              <a
                href={`/p/${t.slug}`}
                className="text-center transition-colors hover:text-yellow-400"
              >
                <p className="text-sm font-bold text-white">{t.name}</p>
                <p className="text-xs text-stone-500">{t.business}</p>
              </a>

              <div className="mt-2 flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Verified Installer
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-stone-700 bg-gray-900/90 p-2 text-stone-400 transition-all hover:border-yellow-400/40 hover:text-white sm:-left-5"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-stone-700 bg-gray-900/90 p-2 text-stone-400 transition-all hover:border-yellow-400/40 hover:text-white sm:-right-5"
            aria-label="Next testimonial"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6">
          {TESTIMONIALS.map((testimonial, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="group/pick flex flex-col items-center gap-2"
              aria-label={`View testimonial from ${testimonial.name}`}
            >
              <div
                className={`h-11 w-11 overflow-hidden rounded-full transition-all ${
                  i === active
                    ? "ring-2 ring-yellow-400 shadow-md shadow-yellow-400/20 scale-110"
                    : "ring-1 ring-stone-700 opacity-60 hover:opacity-90 group-hover/pick:scale-105"
                }`}
              >
                {testimonial.avatarUrl ? (
                  <img
                    src={testimonial.avatarUrl}
                    alt={testimonial.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                    <span className={`text-xs font-black ${i === active ? "text-yellow-400" : "text-stone-500"}`}>
                      {testimonial.initials}
                    </span>
                  </div>
                )}
              </div>
              <span className={`text-[10px] font-bold transition-colors ${
                i === active ? "text-yellow-400" : "text-stone-600"
              }`}>
                {testimonial.name.split(" ")[0]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
