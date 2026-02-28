"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Loader2,
  Phone,
  Ruler,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { bookDemo, getAvailableSlots } from "@/app/actions/demo-booking";
import { DEMO_TIME_SLOTS } from "@/lib/demo-constants";

// ═══════════════════════════════════════════════════════════════════════════
// Demo Booking Page — Installer acquisition funnel
//
// Linked from: Landing page, Instagram bio, /join page
// Purpose: Get potential installers to book a free demo call
// ═══════════════════════════════════════════════════════════════════════════

const BENEFITS = [
  {
    icon: DollarSign,
    title: "Pre-Sold Jobs",
    desc: "Customers design, configure, and pay a deposit before you ever pick up a tool. No selling, no bidding, no chasing leads.",
  },
  {
    icon: Ruler,
    title: "Auto Cut Lists",
    desc: "Every job comes with exact cut lists, material quantities, and build instructions. No math, no guesswork.",
  },
  {
    icon: Zap,
    title: "Instant Payouts",
    desc: "Deposits hit your Stripe account instantly. Collect the balance on-site via cash, Venmo, or card — your choice.",
  },
  {
    icon: Shield,
    title: "Zero Upfront Cost",
    desc: "No franchise fee. No inventory. No equipment. Just your skills and basic tools you already own.",
  },
  {
    icon: TrendingUp,
    title: "Marketing Tools",
    desc: "AI-powered scripts, group finders, branded links, and QR codes to grow your local presence.",
  },
  {
    icon: Users,
    title: "Pro Community",
    desc: "Connect with other installers across the country. Share tips, ask questions, and grow together.",
  },
];

function getNextWeekdays(count: number): string[] {
  const days: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1); // Start from tomorrow
  while (days.length < count) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      days.push(`${yyyy}-${mm}-${dd}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

export default function DemoPage() {
  // Calendar state
  const [availableDates] = useState(() => getNextWeekdays(14));
  const [selectedDate, setSelectedDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState("");
  const [dateOffset, setDateOffset] = useState(0);

  // Qualifying questions
  const [toolExp, setToolExp] = useState("");
  const [buildsCurrent, setBuildsCurrent] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Success state
  const [booked, setBooked] = useState(false);
  const [calendarLink, setCalendarLink] = useState("");

  // Load available slots when date changes
  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    setSelectedTime("");
    getAvailableSlots(selectedDate)
      .then(({ slots }) => {
        setAvailableSlots(slots);
        setSlotsLoading(false);
      })
      .catch(() => {
        // If server action fails (e.g. table missing), show all slots
        setAvailableSlots(DEMO_TIME_SLOTS);
        setSlotsLoading(false);
      });
  }, [selectedDate]);

  async function handleBook() {
    if (!toolExp || !buildsCurrent) {
      setError("Please answer both qualifying questions above.");
      return;
    }
    if (!name.trim() || !email.trim() || !selectedDate || !selectedTime) {
      setError("Please fill in all required fields and select a date & time.");
      return;
    }
    setError("");
    setSubmitting(true);

    const result = await bookDemo({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      date: selectedDate,
      time: selectedTime,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      toolExperience: toolExp,
      buildsCurrently: buildsCurrent,
    });

    if (result.success) {
      setBooked(true);
      setCalendarLink(result.calendarLink || "");
    } else {
      setError(result.error || "Something went wrong.");
    }
    setSubmitting(false);
  }

  const visibleDates = availableDates.slice(dateOffset, dateOffset + 5);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-800 px-4 pb-16 pt-12">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.08) 0%, transparent 60%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <a href="/" className="mb-6 inline-block">
            <Image
              src="/landing_page_logo.png"
              alt="Storage Network"
              width={120}
              height={120}
              className="h-20 w-auto object-contain"
            />
          </a>

          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-400">
            Free Platform Demo
          </p>

          <h1 className="mb-4 text-3xl font-black uppercase leading-tight text-white sm:text-4xl md:text-5xl">
            See How Installers Are Earning{" "}
            <span className="text-yellow-400">$2K–$5K/Week</span>
          </h1>

          <p className="mx-auto mb-8 max-w-xl text-base text-stone-400 sm:text-lg">
            Book a free 30-minute call. We&apos;ll show you exactly how the
            platform delivers pre-sold jobs, handles all the sales, and puts
            money in your account — with zero upfront cost.
          </p>

          <a
            href="#book"
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-8 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
          >
            <Calendar className="h-5 w-5" />
            Pick a Time — It&apos;s Free
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────── */}
      <section className="border-b border-slate-800 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-400">
            How It Works
          </p>
          <h2 className="mb-4 text-center text-2xl font-black uppercase text-white sm:text-3xl">
            You Build. We Handle <span className="text-yellow-400">Everything Else.</span>
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-sm text-stone-400">
            From the first customer click to the money hitting your bank account,
            here&apos;s what the platform does for you.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition-colors hover:border-slate-700"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-400/10">
                  <b.icon className="h-5 w-5 text-yellow-400" />
                </div>
                <h3 className="mb-1.5 text-sm font-bold uppercase tracking-wider text-white">
                  {b.title}
                </h3>
                <p className="text-xs leading-relaxed text-stone-400">
                  {b.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Earnings Snapshot ─────────────────────────────────────────── */}
      <section className="border-b border-slate-800 px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <p className="mb-8 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-400">
            Earnings Potential
          </p>

          <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-black text-yellow-400 sm:text-3xl">$800+</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Per Job Avg
                </p>
              </div>
              <div>
                <p className="text-2xl font-black text-white sm:text-3xl">2–3 hrs</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Avg Install Time
                </p>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-400 sm:text-3xl">$0</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Startup Cost
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-slate-800/50 p-4">
              <p className="text-center text-xs leading-relaxed text-stone-400">
                Average installer completes <strong className="text-white">3–5 jobs per week</strong>{" "}
                using only materials from their local Home Depot. No inventory,
                no warehouse, no van wraps. Just you, your tools, and pre-sold work.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Booking Section ───────────────────────────────────────────── */}
      <section id="book" className="px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-400">
            Book Your Free Demo
          </p>
          <h2 className="mb-2 text-center text-2xl font-black uppercase text-white sm:text-3xl">
            Pick a Time That Works
          </h2>
          <p className="mx-auto mb-8 max-w-md text-center text-sm text-stone-400">
            30-minute call. No pressure. We&apos;ll show you the platform and
            answer every question.
          </p>

          {booked ? (
            /* ── Success State ─────────────────────────────────────── */
            <div className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="mb-2 text-xl font-black uppercase text-white">
                You&apos;re Booked!
              </h3>
              <p className="mb-1 text-sm text-stone-400">
                <strong className="text-white">{formatDate(selectedDate)}</strong>{" "}
                at{" "}
                <strong className="text-yellow-400">{formatTime(selectedTime)} CT</strong>
              </p>
              <p className="mb-6 text-sm text-stone-500">
                Check your email for confirmation details.
              </p>

              {calendarLink && (
                <a
                  href={calendarLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
                >
                  <Calendar className="h-4 w-4" />
                  Add to Google Calendar
                </a>
              )}

              <p className="mt-4 text-xs text-stone-600">
                We&apos;ll reach out at the scheduled time. Questions? Just reply
                to the confirmation email.
              </p>
            </div>
          ) : (
            /* ── Booking Form ──────────────────────────────────────── */
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              {/* Step 1: Pick a Date */}
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-gray-950">
                    1
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Pick a Date
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDateOffset(Math.max(0, dateOffset - 5))}
                    disabled={dateOffset === 0}
                    className="shrink-0 rounded-lg border border-slate-700 p-1.5 text-stone-500 transition-colors hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="flex flex-1 gap-2 overflow-hidden">
                    {visibleDates.map((d) => {
                      const active = selectedDate === d;
                      return (
                        <button
                          key={d}
                          onClick={() => setSelectedDate(d)}
                          className={`flex-1 rounded-lg border px-2 py-3 text-center transition-all ${
                            active
                              ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                              : "border-slate-700 bg-slate-800 text-stone-400 hover:border-slate-600"
                          }`}
                        >
                          <p className="text-[10px] font-bold uppercase">
                            {formatDate(d).split(",")[0]?.split(" ")[0]}
                          </p>
                          <p className="text-sm font-bold">
                            {formatDate(d).split(" ").pop()}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() =>
                      setDateOffset(
                        Math.min(availableDates.length - 5, dateOffset + 5)
                      )
                    }
                    disabled={dateOffset + 5 >= availableDates.length}
                    className="shrink-0 rounded-lg border border-slate-700 p-1.5 text-stone-500 transition-colors hover:text-white disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Step 2: Pick a Time */}
              {selectedDate && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-gray-950">
                      2
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Pick a Time
                    </span>
                    <span className="text-[10px] text-stone-500">(Central Time)</span>
                  </div>

                  {slotsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <p className="py-4 text-center text-xs text-stone-500">
                      No slots available on this date. Try another day.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {availableSlots.map((t) => {
                        const active = selectedTime === t;
                        return (
                          <button
                            key={t}
                            onClick={() => setSelectedTime(t)}
                            className={`rounded-lg border px-3 py-2.5 text-xs font-bold transition-all ${
                              active
                                ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                                : "border-slate-700 bg-slate-800 text-stone-400 hover:border-slate-600"
                            }`}
                          >
                            {formatTime(t)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Qualifying Questions */}
              {selectedDate && selectedTime && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-gray-950">
                      3
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Quick Questions
                    </span>
                  </div>

                  <div className="space-y-4">
                    {/* Question 1: Power tools */}
                    <div>
                      <p className="mb-1.5 text-sm font-medium text-stone-300">
                        How familiar are you with power tools?{" "}
                        <span className="text-[10px] text-stone-500">i.e. table saw, circular saw, drill, etc.</span>
                      </p>
                      <p className="mb-2 text-[10px] text-stone-600">Select one *</p>
                      <div className="grid grid-cols-3 gap-2">
                        {["Never used", "I've built a couple things", "Professional"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setToolExp(opt)}
                            className={`rounded-lg border px-3 py-2.5 text-xs font-bold transition-all ${
                              toolExp === opt
                                ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                                : "border-slate-700 bg-slate-800 text-stone-600 hover:border-slate-600 hover:text-stone-400"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question 2: Currently builds? */}
                    <div>
                      <p className="mb-1.5 text-sm font-medium text-stone-300">
                        Do you build tote storage organizers for people currently?
                      </p>
                      <p className="mb-2 text-[10px] text-stone-600">Select one *</p>
                      <div className="grid grid-cols-2 gap-2">
                        {["Yes", "No"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setBuildsCurrent(opt)}
                            className={`rounded-lg border px-3 py-2.5 text-xs font-bold transition-all ${
                              buildsCurrent === opt
                                ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                                : "border-slate-700 bg-slate-800 text-stone-600 hover:border-slate-600 hover:text-stone-400"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Your Info */}
              {selectedDate && selectedTime && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-gray-950">
                      4
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Your Info
                    </span>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full Name *"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email *"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none"
                    />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone (optional — for call day reminder)"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
                  <p className="text-xs font-medium text-red-400">{error}</p>
                </div>
              )}

              {/* Submit */}
              {selectedDate && selectedTime && (
                <button
                  onClick={handleBook}
                  disabled={submitting || !name.trim() || !email.trim() || !toolExp || !buildsCurrent}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirm Demo — {formatDate(selectedDate)} at{" "}
                      {formatTime(selectedTime)} CT
                    </>
                  )}
                </button>
              )}

              {/* Trust signals */}
              <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-stone-600">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> 30 min call
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone or video
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> 100% free
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      {!booked && (
        <section className="border-t border-slate-800 bg-slate-900 px-4 py-12">
          <div className="mx-auto max-w-xl text-center">
            <h3 className="mb-3 text-lg font-black uppercase text-white">
              Not ready to book?{" "}
              <span className="text-yellow-400">Sign up directly.</span>
            </h3>
            <p className="mb-5 text-sm text-stone-400">
              Skip the call and start your Pro trial right now.
            </p>
            <a
              href="/join"
              className="inline-flex items-center gap-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-6 py-3 text-sm font-bold text-yellow-400 transition-colors hover:border-yellow-400/50 hover:bg-yellow-400/20"
            >
              Join the Network
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 bg-slate-950 px-4 py-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Image
              src="/Header_avatar_logo.png"
              alt="Storage Network"
              width={32}
              height={32}
              className="h-8 w-auto object-contain"
            />
          </a>
          <p className="text-[10px] text-stone-700">
            &copy; {new Date().getFullYear()} Storage-Network.app
          </p>
          <a
            href="/login"
            className="text-[10px] text-stone-600 transition-colors hover:text-yellow-400"
          >
            Partner Login
          </a>
        </div>
      </footer>
    </div>
  );
}
