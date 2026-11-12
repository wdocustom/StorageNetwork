"use client";

import { useEffect, useState } from "react";
import { Bookmark, CalendarPlus, Check, Coffee, Percent, Scissors, Utensils } from "lucide-react";

import {
  PAGE_URL,
  googleCalendarUrl,
  nextVeteransDay,
  outlookCalendarUrl,
  veteransDayLabel,
} from "@/lib/freebies/veterans-day-date";

// ═══════════════════════════════════════════════════════════════════════════
// Countdown to next Veterans Day, with "Bookmark" and "Add to calendar".
//
// The countdown runs on the visitor's own clock (midnight local time on
// November 11), so it's only rendered after mount; the server sends the
// date and placeholders.
// ═══════════════════════════════════════════════════════════════════════════

const UNITS = [
  ["days", 86_400_000],
  ["hours", 3_600_000],
  ["minutes", 60_000],
  ["seconds", 1_000],
] as const;

function split(ms: number): Record<(typeof UNITS)[number][0], number> {
  let rest = Math.max(0, ms);
  const out = {} as Record<(typeof UNITS)[number][0], number>;
  for (const [unit, size] of UNITS) {
    out[unit] = Math.floor(rest / size);
    rest -= out[unit] * size;
  }
  return out;
}

const PERKS = [
  { icon: Utensils, label: "Free meals" },
  { icon: Coffee, label: "Coffee & sweet treats" },
  { icon: Scissors, label: "Haircuts & car washes" },
  { icon: Percent, label: "Military discounts" },
];

export default function VeteransDayCountdown({ serverYear }: { serverYear: number }) {
  const [now, setNow] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [bookmarkHint, setBookmarkHint] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const target = now ? nextVeteransDay(now) : null;
  const year = target?.getFullYear() ?? serverYear;
  const left = target && now ? split(target.getTime() - now.getTime()) : null;

  async function bookmark() {
    setBookmarkHint(null);
    // Browsers don't let a page add a bookmark itself. On phones the share
    // sheet has "Add Bookmark" / "Add to Home Screen"; on a computer the
    // keyboard shortcut is the one-step way.
    const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (touch && navigator.share) {
      try {
        await navigator.share({ title: "Veterans Day freebie planner", url: PAGE_URL });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    const mac = /Mac|iPhone|iPad/i.test(navigator.userAgent);
    let copied = false;
    try {
      await navigator.clipboard.writeText(PAGE_URL);
      copied = true;
    } catch {
      /* clipboard blocked */
    }
    setBookmarkHint(
      `Press ${mac ? "⌘" : "Ctrl"} + D to bookmark this page.${copied ? " The link is also copied." : ""}`
    );
  }

  const button =
    "flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-colors sm:w-auto";

  return (
    <section
      aria-labelledby="vd-heading"
      className="relative overflow-hidden rounded-3xl border border-yellow-400/30 bg-gradient-to-b from-slate-900 to-slate-950 px-5 py-10 text-center sm:px-10 sm:py-14"
    >
      {/* Stripes: a quiet flag motif behind the content */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
        style={{ background: "repeating-linear-gradient(90deg,#b91c1c 0 28px,#f8fafc 28px 56px,#1d4ed8 56px 84px)" }}
      />

      <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
        Veterans Day · {veteransDayLabel(year)}
      </p>
      <h1 id="vd-heading" className="mx-auto mt-4 max-w-2xl text-4xl font-black leading-tight text-white sm:text-5xl">
        Thank you for your service.
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-stone-300 sm:text-lg">
        Every November 11, restaurants and retailers across the country thank veterans and active-duty military
        with free meals and discounts. Our free planner turns them into one realistic day, breakfast to dinner,
        with directions to every stop.
      </p>

      {/* Countdown */}
      <div className="mx-auto mt-8 grid max-w-lg grid-cols-4 gap-2 sm:gap-3" role="timer" aria-live="off">
        {UNITS.map(([unit]) => (
          <div key={unit} className="rounded-2xl border border-slate-700 bg-slate-950/70 px-1 py-3 sm:py-4">
            <p className="font-mono text-3xl font-black tabular-nums text-white sm:text-5xl">
              {left ? String(left[unit]).padStart(unit === "days" ? 1 : 2, "0") : "–"}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400 sm:text-xs">{unit}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-stone-400">until Veterans Day {year}</p>

      {/* What to expect */}
      <ul className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-2">
        {PERKS.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-stone-200"
          >
            <Icon className="h-4 w-4 text-yellow-400" aria-hidden />
            {label}
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="mx-auto mt-9 flex max-w-md flex-col items-center gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => setCalendarOpen((v) => !v)}
          aria-expanded={calendarOpen}
          className={`${button} bg-yellow-400 text-gray-950 hover:bg-yellow-300`}
        >
          <CalendarPlus className="h-5 w-5" /> Add to calendar
        </button>
        <button
          type="button"
          onClick={bookmark}
          className={`${button} border border-slate-600 text-white hover:border-yellow-400`}
        >
          <Bookmark className="h-5 w-5" /> Bookmark this page
        </button>
      </div>

      {calendarOpen && (
        <div className="mx-auto mt-4 max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-2 text-left">
          <p className="px-3 pb-1 pt-2 text-xs text-stone-400">
            An all-day event every November 11 with a link to this planner. Apple and .ics add a reminder the day
            before.
          </p>
          {[
            { label: "Apple Calendar (iPhone, iPad, Mac)", href: "/veterans-day/calendar.ics" },
            { label: "Google Calendar", href: googleCalendarUrl(year), external: true },
            { label: "Outlook", href: outlookCalendarUrl(year), external: true },
            { label: "Other calendar app (.ics file)", href: "/veterans-day/calendar.ics", download: true },
          ].map((opt) => (
            <a
              key={opt.label}
              href={opt.href}
              {...(opt.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              {...(opt.download ? { download: "veterans-day.ics" } : {})}
              className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-white hover:bg-slate-900"
            >
              {opt.label}
              <CalendarPlus className="h-4 w-4 text-yellow-400" aria-hidden />
            </a>
          ))}
        </div>
      )}

      {bookmarkHint && (
        <p role="status" className="mx-auto mt-4 flex max-w-md items-center justify-center gap-2 text-sm text-emerald-300">
          <Check className="h-4 w-4 shrink-0" /> {bookmarkHint}
        </p>
      )}

      <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-stone-500">
        The planner opens here in early November with this year&apos;s confirmed offers. Bring proof of service
        on the day: military ID, VA card, a veteran-designated driver&apos;s license, or your DD-214.
      </p>
    </section>
  );
}
