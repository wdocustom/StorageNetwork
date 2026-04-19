"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, BadgeCheck, Quote, MessageCircle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Testimonials — Auto-sliding carousel with verified badges
//
// Hardcoded testimonials from real platform installers.
// Avatar bubbles match the portfolio page style (rounded, yellow border).
// Each avatar links back to the installer's portfolio page.
// ═══════════════════════════════════════════════════════════════════════════

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
    text: "I get a lot of traction on my Facebook posts and TikToks, but half the people messaging me to build a unit live two hours away or in another state. Before, I just had to turn them down and lose the lead. Now, I give everybody my Storage Network link. If they type in a ZIP code outside my service area, the platform automatically hands the job off to a local certified installer in their city\u2014and it pays me a 30% cut of the deposit just for bringing the lead into the network. I\u2019m literally making passive income on jobs I don\u2019t even have to drive to.",
  },
  {
    name: "Mathew Gass",
    business: "Mathew Gass Woodworks",
    slug: "mathew-gass-woodworks",
    initials: "MG",
    text: "Before using the Storage-Network platform, I was literally sketching out garage layouts on paper and trying to explain to homeowners what a 5-tier tote rack would look like. Now, I just send them my custom link. When a customer can pull out their phone, punch in their wall width, and physically spin a 3D model of their new storage unit around, it builds instant trust. I don\u2019t have to \u2018sell\u2019 the job anymore. The configurator shows them exactly what they are getting, they book it right there, and I just show up and drop off their rack...Gamechanger.",
  },
  {
    name: "Michael Fujiwara",
    business: "Rack City Totes",
    slug: "rack-city-totes",
    initials: "MF",
    text: "I\u2019ve been using the Storage Network app for a while now, and it\u2019s completely changed how I run my business. Having everything in one place has made my workflow so much smoother, and the flexibility of the platform makes it easy to adapt to whatever I need. One of the biggest benefits is how it lets customers answer their own questions. The app is clear, organized, and easy to navigate, so people can find the information they need without constantly reaching out. That alone has saved me a ton of time and made everything more efficient. It\u2019s also helped me grow. I\u2019m able to reach more customers and take on more business without getting overwhelmed. On top of that, it\u2019s reduced the need to negotiate low prices because everything is laid out clearly\u2014customers know exactly what they\u2019re getting and what they\u2019re paying for upfront. Another feature I really appreciate is the ability to collect deposits directly through the app. It adds a level of professionalism and security that makes the whole process smoother for both me and my customers.",
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

  // Auto-advance every 8 seconds (pauses on hover/touch)
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(next, 8000);
    return () => clearInterval(interval);
  }, [isPaused, next]);

  const t = TESTIMONIALS[active];

  return (
    <section className="border-t border-stone-800/50 bg-gradient-to-b from-slate-950 to-gray-950 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-4xl">
        {/* Section Header */}
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
            {/* Quote Icon */}
            <Quote className="mx-auto mb-6 h-8 w-8 text-yellow-400/30" />

            {/* Testimonial Text */}
            <p className="mb-8 text-center text-sm leading-relaxed text-stone-300 sm:text-base sm:leading-relaxed">
              &ldquo;{t.text}&rdquo;
            </p>

            {/* Avatar + Info */}
            <div className="flex flex-col items-center">
              {/* Avatar Bubble — leaderboard ring style */}
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
                {/* Verified Badge */}
                <div className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-900 bg-emerald-500 shadow-sm">
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </a>

              {/* Name & Business */}
              <a
                href={`/p/${t.slug}`}
                className="text-center transition-colors hover:text-yellow-400"
              >
                <p className="text-sm font-bold text-white">{t.name}</p>
                <p className="text-xs text-stone-500">{t.business}</p>
              </a>

              {/* Verified Installer Label */}
              <div className="mt-2 flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Verified Installer
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
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

        {/* Avatar Selector Row — leaderboard ring style */}
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
