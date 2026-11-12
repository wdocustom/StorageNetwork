"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CalendarPlus,
  Car,
  ChevronDown,
  ExternalLink,
  Info,
  Loader2,
  LocateFixed,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Route,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { EXTRA_TYPE_LABEL, VETERANS_DAY, getOffer, type ExtraType } from "@/lib/freebies/offers";
import {
  FOOD_SLOTS,
  SLOT_RULES,
  alternativesFor,
  canFill,
  directionsUrl,
  formatTime,
  insertExtra,
  placeLine,
  routeUrl,
  schedule,
  slotLabel,
  slotOrder,
  type FoodSlot,
  type Place,
  type PlanStop,
  type TimedStop,
} from "@/lib/freebies/schedule";

// ═══════════════════════════════════════════════════════════════════════════
// Veterans Day freebie planner — the interactive part of /veterans-day
//
// Location in → a timed plan out. Swaps, removals and added stops are
// re-timed in the browser with the same rules the server used, so the
// timeline on screen is always one the scheduler accepts (or says is late).
// ═══════════════════════════════════════════════════════════════════════════

interface Origin {
  lat: number;
  lon: number;
  label: string;
}

interface PlanResponse {
  origin: Origin;
  startMin: number;
  radiusMi: number;
  places: Place[];
  stops: PlanStop[];
  summary: string | null;
  tips: string[];
  ai: boolean;
}

type DayMode = "before" | "today" | "after";

const RADIUS_OPTIONS = [5, 10, 15, 25] as const;
const START_OPTIONS = Array.from({ length: 27 }, (_, i) => 5 * 60 + 30 + i * 30); // 5:30 AM – 6:30 PM

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nearestStartOption(min: number): number {
  return START_OPTIONS.find((o) => o >= min) ?? START_OPTIONS[START_OPTIONS.length - 1];
}

const EXTRA_ORDER: ExtraType[] = ["haircut", "carwash", "voucher", "discount"];

/** Calendar file with one event per stop, in the phone's own time zone. */
function buildIcs(timed: TimedStop[]): string {
  const day = VETERANS_DAY.date.replace(/-/g, "");
  const stamp = (min: number) =>
    `${day}T${String(Math.floor(min / 60)).padStart(2, "0")}${String(min % 60).padStart(2, "0")}00`;
  const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
  const events = timed.flatMap((stop, i) => {
    const offer = getOffer(stop.place.offerId);
    if (!offer) return [];
    return [
      "BEGIN:VEVENT",
      `UID:veterans-day-${day}-${i}-${stop.place.id.replace("/", "-")}@storage-network.app`,
      `DTSTAMP:${day}T000000Z`,
      `DTSTART:${stamp(stop.arrive)}`,
      `DTEND:${stamp(stop.depart)}`,
      `SUMMARY:${text(`${offer.brand} — ${offer.headline}`)}`,
      `LOCATION:${text(stop.place.address ?? `${stop.place.lat},${stop.place.lon}`)}`,
      `DESCRIPTION:${text(
        `${offer.details}\nWho qualifies: ${offer.eligibility}\nBring proof of service.\nDirections: ${directionsUrl(stop.place)}`
      )}`,
      "END:VEVENT",
    ];
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Storage Network//Veterans Day Planner//EN", ...events, "END:VCALENDAR"].join(
    "\r\n"
  );
}

export default function FreebiePlanner() {
  // ── Inputs ────────────────────────────────────────────────────────────────
  const [zip, setZip] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [startMin, setStartMin] = useState(7 * 60 + 30);
  const [radiusMi, setRadiusMi] = useState<(typeof RADIUS_OPTIONS)[number]>(10);
  const [prefs, setPrefs] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [mode, setMode] = useState<DayMode>("before");

  // ── Plan ──────────────────────────────────────────────────────────────────
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [stops, setStops] = useState<PlanStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openDetails, setOpenDetails] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [adding, setAdding] = useState<FoodSlot | null>(null);

  // ── Change request + email ────────────────────────────────────────────────
  const [change, setChange] = useState("");
  const [changing, setChanging] = useState(false);
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent">("idle");
  const [emailError, setEmailError] = useState<string | null>(null);

  // The clock is only known in the browser: pick the day mode and a sensible
  // start time after mount.
  useEffect(() => {
    const now = new Date();
    const today = localDate(now);
    if (today === VETERANS_DAY.date) {
      setMode("today");
      const minutes = now.getHours() * 60 + now.getMinutes();
      if (minutes > 6 * 60 + 30) setStartMin(nearestStartOption(minutes + 10));
    } else {
      setMode(today > VETERANS_DAY.date ? "after" : "before");
    }
  }, []);

  const timed = useMemo(
    () => (plan ? schedule(stops, plan.origin, plan.startMin) : []),
    [plan, stops]
  );

  const usedPlaceIds = useMemo(() => new Set(stops.map((s) => s.place.id)), [stops]);
  const usedOfferIds = useMemo(() => new Set(stops.map((s) => s.place.offerId)), [stops]);

  /** Non-food offers nearby that aren't on the timeline: the nearest location of each. */
  const extras = useMemo(() => {
    if (!plan) return [];
    const seen = new Set<string>();
    return plan.places
      .filter((p) => getOffer(p.offerId)?.kind === "extra" && !usedOfferIds.has(p.offerId))
      .filter((p) => (seen.has(p.offerId) ? false : (seen.add(p.offerId), true)))
      .sort((a, b) => {
        const ta = EXTRA_ORDER.indexOf(getOffer(a.offerId)!.extraType!);
        const tb = EXTRA_ORDER.indexOf(getOffer(b.offerId)!.extraType!);
        return ta - tb || a.distanceMi - b.distanceMi;
      });
  }, [plan, usedOfferIds]);

  /** Food slots with nothing scheduled that still have a usable option. */
  const openSlots = useMemo(() => {
    if (!plan) return [];
    const filled = new Set(stops.map((s) => s.slot));
    return FOOD_SLOTS.filter(
      (slot) =>
        !filled.has(slot) &&
        SLOT_RULES[slot].latest >= plan.startMin &&
        plan.places.some((p) => canFill(p.offerId, slot) && !usedOfferIds.has(p.offerId))
    );
  }, [plan, stops, usedOfferIds]);

  // ── Actions ───────────────────────────────────────────────────────────────

  function shareLocation() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("This browser can't share a location. Enter your ZIP code instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // ~100 m precision is plenty to find nearby stores.
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(3)),
          lon: Number(pos.coords.longitude.toFixed(3)),
        });
        setZip("");
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was declined. Enter your ZIP code instead."
            : "We couldn't get your location. Enter your ZIP code instead."
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  }

  async function postPlan(body: Record<string, unknown>) {
    const res = await fetch("/api/veterans-day/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: (PlanResponse & { error?: string }) | null = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON (e.g. the site-wide rate limiter) */
    }
    if (!res.ok || !json) {
      throw new Error(json?.error || (res.status === 429 ? text : "Something went wrong. Please try again."));
    }
    return json;
  }

  async function requestPlan(extra?: { request: string; current: Record<FoodSlot, string | null> }) {
    return postPlan({
      ...(coords ? coords : { zip }),
      startMin,
      radiusMi,
      ...(extra
        ? { request: extra.request, current: extra.current }
        : prefs.trim()
          ? { request: prefs.trim() }
          : {}),
    });
  }

  async function generate() {
    setError(null);
    setNotice(null);
    if (!coords && !/^\d{5}$/.test(zip)) {
      setError("Enter a 5-digit ZIP code, or tap “Use my location.”");
      return;
    }
    setLoading(true);
    try {
      const result = await requestPlan();
      setPlan(result);
      setStops(result.stops);
      setSwapping(null);
      setAdding(null);
      setOpenDetails(null);
      setEmailState("idle");
      requestAnimationFrame(() =>
        document.getElementById("your-plan")?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function applyChange() {
    if (!plan || !change.trim()) return;
    setNotice(null);
    setError(null);
    setChanging(true);
    try {
      const current = Object.fromEntries(
        FOOD_SLOTS.map((slot) => [slot, stops.find((s) => s.slot === slot)?.place.id ?? null])
      ) as Record<FoodSlot, string | null>;
      const result = await requestPlan({ request: change.trim(), current });
      if (!result.ai) {
        setNotice("We couldn't apply that request automatically right now. Use Swap or Remove on any stop instead.");
        return;
      }
      // Keep the extra stops the veteran added, wherever they still fit.
      let next = result.stops;
      for (const kept of stops.filter((s) => s.slot === "extra")) {
        next = insertExtra(next, kept.place, plan.origin, plan.startMin) ?? next;
      }
      setPlan({ ...plan, summary: result.summary, tips: result.tips, ai: result.ai });
      setStops(next);
      setChange("");
      setEmailState("idle");
      setNotice("Plan updated.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setChanging(false);
    }
  }

  function edit(next: PlanStop[]) {
    setStops(next);
    setSwapping(null);
    setAdding(null);
    setNotice(null);
    setEmailState("idle");
  }

  function swap(stop: PlanStop, place: Place) {
    edit(stops.map((s) => (s === stop ? { slot: s.slot, place } : s)));
  }

  function addToSlot(slot: FoodSlot, place: Place) {
    const at = stops.findIndex((s) => s.slot !== "extra" && slotOrder(s.slot) > slotOrder(slot));
    const next = [...stops];
    next.splice(at === -1 ? stops.length : at, 0, { slot, place });
    edit(next);
  }

  function addExtra(place: Place) {
    if (!plan) return;
    const next = insertExtra(stops, place, plan.origin, plan.startMin);
    if (!next) {
      const offer = getOffer(place.offerId);
      setNotice(
        `${offer?.brand ?? "That stop"} doesn't fit without making another stop late. It's still listed below with directions.`
      );
      return;
    }
    edit(next);
  }

  function downloadCalendar() {
    const blob = new Blob([buildIcs(timed)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "veterans-day-plan.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendEmail() {
    if (!plan || !stops.length) return;
    setEmailError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailState("sending");
    try {
      const res = await fetch("/api/veterans-day/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          origin: { lat: plan.origin.lat, lon: plan.origin.lon },
          startMin: plan.startMin,
          stops: stops.map((s) => ({ slot: s.slot, place: s.place })),
          extras,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "We couldn't send the email just now. Please try again.");
      setEmailState("sent");
    } catch (err) {
      setEmailState("idle");
      setEmailError(err instanceof Error ? err.message : "We couldn't send the email just now.");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const route = routeUrl(stops);
  const lateCount = timed.filter((t) => t.late).length;

  return (
    <div>
      {/* ── Location form ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
        {mode === "after" && (
          <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Veterans Day {VETERANS_DAY.year} has passed. These were this year&apos;s offers — most chains repeat
            them every November 11. You can still build a sample plan.
          </p>
        )}
        <h2 className="text-lg font-bold text-white">Where are you starting from?</h2>
        <p className="mt-1 text-sm text-stone-400">
          No account needed. Your location is only used to find offers near you.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <label className="sm:flex-1">
            <span className="sr-only">ZIP code</span>
            <input
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              placeholder="ZIP code"
              value={zip}
              onChange={(e) => {
                setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
                setCoords(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && generate()}
              className="h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 text-lg font-semibold tracking-widest text-white placeholder:font-normal placeholder:tracking-normal placeholder:text-stone-500 focus:border-yellow-400 focus:outline-none"
            />
          </label>
          <span className="self-center text-xs font-semibold uppercase tracking-widest text-stone-500">or</span>
          <button
            type="button"
            onClick={shareLocation}
            disabled={locating}
            className={`flex h-12 shrink-0 items-center sm:flex-1 justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition-colors ${
              coords
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-slate-700 bg-slate-950 text-white hover:border-yellow-400"
            }`}
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {coords ? "Using your location" : locating ? "Finding you…" : "Use my location"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowOptions((v) => !v)}
          className="mt-4 flex items-start gap-1 text-left text-sm font-semibold text-stone-300 hover:text-white"
          aria-expanded={showOptions}
        >
          <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${showOptions ? "rotate-180" : ""}`} />
          <span>
            Start time, distance and preferences
            <span className="block font-normal text-stone-500">
              {formatTime(startMin)} · within {radiusMi} miles
            </span>
          </span>
        </button>

        {showOptions && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-stone-300">Start my day at</span>
              <select
                value={startMin}
                onChange={(e) => setStartMin(Number(e.target.value))}
                className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white focus:border-yellow-400 focus:outline-none"
              >
                {START_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {formatTime(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-stone-300">How far I&apos;ll drive</span>
              <select
                value={radiusMi}
                onChange={(e) => setRadiusMi(Number(e.target.value) as (typeof RADIUS_OPTIONS)[number])}
                className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white focus:border-yellow-400 focus:outline-none"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    Within {r} miles
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-stone-300">
                Anything you&apos;d like? <span className="font-normal text-stone-500">(optional)</span>
              </span>
              <input
                value={prefs}
                maxLength={300}
                onChange={(e) => setPrefs(e.target.value)}
                placeholder="e.g. no seafood, burgers for lunch, skip breakfast"
                className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white placeholder:text-stone-500 focus:border-yellow-400 focus:outline-none"
              />
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 text-lg font-black text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-70"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          {loading ? "Finding freebies near you…" : plan ? "Generate again" : "Generate my day"}
        </button>
        {loading && (
          <p className="mt-2 text-center text-xs text-stone-500">
            Checking real locations and drive times. This takes a few seconds.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
      </section>

      {/* ── The plan ──────────────────────────────────────────────────── */}
      {plan && (
        <section id="your-plan" className="mt-10 scroll-mt-6">
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-400">
            {VETERANS_DAY.label}
          </p>
          <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            Your day near {plan.origin.label}
          </h2>
          {plan.summary && <p className="mt-2 text-stone-300">{plan.summary}</p>}

          {stops.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-stone-300">
              <p className="font-semibold text-white">
                We didn&apos;t find participating restaurants within {plan.radiusMi} miles that fit the rest of
                the day from {formatTime(plan.startMin)}.
              </p>
              <p className="mt-2 text-sm">
                Try a wider distance or an earlier start time above. We only list places we can actually locate —
                the full list of national offers is further down this page.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-stone-500">
                {stops.length} {stops.length === 1 ? "stop" : "stops"} · starting {formatTime(plan.startMin)} ·
                drive times are estimates
              </p>

              {lateCount > 0 && (
                <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {lateCount === 1 ? "One stop is" : `${lateCount} stops are`} now past the offer&apos;s hours.
                  Swap or remove the marked {lateCount === 1 ? "stop" : "stops"}.
                </p>
              )}

              <ol className="mt-6 space-y-4">
                {timed.map((stop) => (
                  <StopCard
                    key={`${stop.slot}-${stop.place.id}`}
                    stop={stop}
                    detailsOpen={openDetails === stop.place.id}
                    onToggleDetails={() => setOpenDetails(openDetails === stop.place.id ? null : stop.place.id)}
                    swapOpen={swapping === stop.place.id}
                    onToggleSwap={() => setSwapping(swapping === stop.place.id ? null : stop.place.id)}
                    alternatives={alternativesFor(
                      stops.find((s) => s.place.id === stop.place.id)!,
                      stops,
                      plan.places
                    ).filter((p) => !usedPlaceIds.has(p.id))}
                    onSwap={(place) => swap(stops.find((s) => s.place.id === stop.place.id)!, place)}
                    onRemove={() => edit(stops.filter((s) => s.place.id !== stop.place.id))}
                  />
                ))}
              </ol>
            </>
          )}

          {/* Empty food slots */}
          {openSlots.length > 0 && (
            <div className="mt-5">
              <div className="flex flex-wrap gap-2">
                {openSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setAdding(adding === slot ? null : slot)}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                      adding === slot
                        ? "border-yellow-400 text-yellow-300"
                        : "border-slate-700 text-stone-300 hover:border-yellow-400"
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add {slotLabel(slot).toLowerCase()}
                  </button>
                ))}
              </div>
              {adding && (
                <PlacePicker
                  title={`${slotLabel(adding)} options near you`}
                  places={plan.places
                    .filter((p) => canFill(p.offerId, adding) && !usedOfferIds.has(p.offerId))
                    .sort((a, b) => a.distanceMi - b.distanceMi)}
                  onPick={(place) => addToSlot(adding, place)}
                />
              )}
            </div>
          )}

          {notice && (
            <p role="status" className="mt-4 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-stone-200">
              {notice}
            </p>
          )}

          {plan.tips.length > 0 && stops.length > 0 && (
            <ul className="mt-5 space-y-1 text-sm text-stone-400">
              {plan.tips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          )}

          {/* ── Change request ───────────────────────────────────────── */}
          {stops.length > 0 && (
            <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="font-bold text-white">Want something different?</h3>
              <p className="mt-1 text-sm text-stone-400">
                Tap <strong className="text-stone-200">Swap</strong> on any stop to pick another location, or tell
                us what to change and we&apos;ll rework the plan.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={change}
                  maxLength={300}
                  onChange={(e) => setChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyChange()}
                  placeholder="e.g. Italian for dinner, no doughnuts, skip the afternoon treat"
                  className="h-11 shrink-0 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm sm:flex-1 text-white placeholder:text-stone-500 focus:border-yellow-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={applyChange}
                  disabled={changing || !change.trim()}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-yellow-400 px-4 text-sm font-bold text-yellow-300 hover:bg-yellow-400/10 disabled:opacity-50"
                >
                  {changing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Update my plan
                </button>
              </div>
            </div>
          )}

          {/* ── Take it with you ─────────────────────────────────────── */}
          {stops.length > 0 && (
            <div className="mt-6 rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-5">
              <h3 className="font-bold text-white">Take your plan with you</h3>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {route && (
                  <a
                    href={route}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-yellow-400 sm:flex-1 px-4 text-sm font-bold text-gray-950 hover:bg-yellow-300"
                  >
                    <Route className="h-4 w-4" /> Open the whole route in Maps
                  </a>
                )}
                <button
                  type="button"
                  onClick={downloadCalendar}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-600 sm:flex-1 px-4 text-sm font-bold text-white hover:border-yellow-400"
                >
                  <CalendarPlus className="h-4 w-4" /> Add to my calendar
                </button>
              </div>

              <div className="mt-4 border-t border-yellow-400/20 pt-4">
                <label htmlFor="plan-email" className="text-sm font-semibold text-stone-200">
                  Email this plan to myself
                </label>
                <p className="text-xs text-stone-500">
                  Every stop with its time, the offer, and buttons for directions. One email — we won&apos;t add
                  you to a list.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="plan-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailState === "sent") setEmailState("idle");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && sendEmail()}
                    placeholder="you@example.com"
                    className="h-11 shrink-0 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm sm:flex-1 text-white placeholder:text-stone-500 focus:border-yellow-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={sendEmail}
                    disabled={emailState !== "idle"}
                    className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-bold text-gray-950 hover:bg-stone-200 disabled:opacity-70"
                  >
                    {emailState === "sending" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {emailState === "sent" ? "Sent" : emailState === "sending" ? "Sending…" : "Email my plan"}
                  </button>
                </div>
                {emailState === "sent" && (
                  <p role="status" className="mt-2 text-sm text-emerald-300">
                    Sent to {email.trim()}. Check your inbox (and spam folder) in a minute.
                  </p>
                )}
                {emailError && (
                  <p role="alert" className="mt-2 text-sm text-red-300">
                    {emailError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Not food ─────────────────────────────────────────────── */}
          {extras.length > 0 && (
            <div className="mt-10">
              <h3 className="text-xl font-black text-white">More near you — not food</h3>
              <p className="mt-1 text-sm text-stone-400">
                Haircuts, car washes, vouchers and military discounts close by. Add one to your day and we&apos;ll
                find where it fits.
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {extras.map((place) => (
                  <ExtraCard
                    key={place.id}
                    place={place}
                    detailsOpen={openDetails === place.id}
                    onToggleDetails={() => setOpenDetails(openDetails === place.id ? null : place.id)}
                    onAdd={stops.length > 0 ? () => addExtra(place) : undefined}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function OfferDetails({ place }: { place: Place }) {
  const offer = getOffer(place.offerId);
  if (!offer) return null;
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-stone-300">
      <p>{offer.details}</p>
      <p>
        <span className="font-semibold text-stone-200">Who qualifies:</span> {offer.eligibility}
      </p>
      <p>
        <span className="font-semibold text-stone-200">Offer hours:</span> {offer.windowNote}
      </p>
      {offer.redeemLater && <p>{offer.redeemLater}</p>}
      <p className="text-xs text-stone-500">
        Participating locations only — a quick call is the surest way to confirm.
      </p>
      <a
        href={offer.website}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-yellow-300 hover:underline"
      >
        {offer.brand} website <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function ActionRow({
  place,
  detailsOpen,
  onToggleDetails,
  children,
}: {
  place: Place;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  children?: React.ReactNode;
}) {
  const subtle =
    "flex h-10 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-sm font-semibold text-stone-200 hover:border-yellow-400";
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a
        href={directionsUrl(place)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-10 items-center gap-1.5 rounded-lg bg-yellow-400 px-4 text-sm font-bold text-gray-950 hover:bg-yellow-300"
      >
        <Navigation className="h-4 w-4" /> Directions
      </a>
      <button type="button" onClick={onToggleDetails} aria-expanded={detailsOpen} className={subtle}>
        <Info className="h-4 w-4" /> Offer details
      </button>
      {place.phone && (
        <a href={`tel:+1${place.phone.replace(/\D/g, "")}`} className={subtle}>
          <Phone className="h-4 w-4" /> Call
        </a>
      )}
      {children}
    </div>
  );
}

function StopCard({
  stop,
  detailsOpen,
  onToggleDetails,
  swapOpen,
  onToggleSwap,
  alternatives,
  onSwap,
  onRemove,
}: {
  stop: TimedStop;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  swapOpen: boolean;
  onToggleSwap: () => void;
  alternatives: Place[];
  onSwap: (place: Place) => void;
  onRemove: () => void;
}) {
  const offer = getOffer(stop.place.offerId);
  if (!offer) return null;
  const kind = stop.slot === "extra" && offer.extraType ? EXTRA_TYPE_LABEL[offer.extraType] : slotLabel(stop.slot);
  const subtle =
    "flex h-10 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-sm font-semibold text-stone-200 hover:border-yellow-400";

  return (
    <li className="flex gap-3 sm:gap-5">
      <div className="w-[4.75rem] shrink-0 pt-4 text-right sm:w-24">
        <p className="whitespace-nowrap text-[15px] font-black text-yellow-400 sm:text-lg">{formatTime(stop.arrive)}</p>
        <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-stone-500">
          <Car className="h-3 w-3" /> ~{stop.driveMin} min
        </p>
      </div>
      <div
        className={`min-w-0 flex-1 rounded-xl border bg-slate-900/60 p-4 ${
          stop.late ? "border-amber-500/60" : "border-slate-800"
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-stone-500">{kind}</p>
        <p className="mt-1 text-lg font-black text-white">{offer.brand}</p>
        <p className="font-bold text-yellow-300">{offer.headline}</p>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-stone-400">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {placeLine(stop.place)}
            {stop.place.address && <> · {stop.place.distanceMi.toFixed(1)} mi from start</>}
          </span>
        </p>
        {stop.why && <p className="mt-2 text-sm italic text-stone-400">{stop.why}</p>}
        {offer.redeemLater && <p className="mt-2 text-sm text-stone-300">{offer.redeemLater}</p>}
        {stop.late && (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            You&apos;d arrive after this offer&apos;s hours ({offer.windowNote}). Swap or remove this stop.
          </p>
        )}

        <ActionRow place={stop.place} detailsOpen={detailsOpen} onToggleDetails={onToggleDetails}>
          <button type="button" onClick={onToggleSwap} aria-expanded={swapOpen} className={subtle}>
            <ArrowLeftRight className="h-4 w-4" /> Swap
          </button>
          <button type="button" onClick={onRemove} className={subtle} aria-label={`Remove ${offer.brand}`}>
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        </ActionRow>

        {detailsOpen && <OfferDetails place={stop.place} />}
        {swapOpen &&
          (alternatives.length ? (
            <PlacePicker title={`Swap ${offer.brand} for…`} places={alternatives} onPick={onSwap} />
          ) : (
            <p className="mt-3 text-sm text-stone-400">
              No other {kind.toLowerCase()} options within your distance. Try a wider distance above.
            </p>
          ))}
      </div>
    </li>
  );
}

function PlacePicker({
  title,
  places,
  onPick,
}: {
  title: string;
  places: Place[];
  onPick: (place: Place) => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950 p-3">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-500">{title}</p>
      <ul className="mt-2 max-h-80 divide-y divide-slate-800 overflow-y-auto">
        {places.map((place) => {
          const offer = getOffer(place.offerId);
          if (!offer) return null;
          return (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => onPick(place)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-900"
              >
                <span className="min-w-0">
                  <span className="block font-bold text-white">{offer.brand}</span>
                  <span className="block text-sm text-yellow-300">{offer.headline}</span>
                  <span className="block truncate text-xs text-stone-500">{placeLine(place)}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-stone-300">
                  {place.distanceMi.toFixed(1)} mi
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ExtraCard({
  place,
  detailsOpen,
  onToggleDetails,
  onAdd,
}: {
  place: Place;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onAdd?: () => void;
}) {
  const offer = getOffer(place.offerId);
  if (!offer) return null;
  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
        {offer.extraType ? EXTRA_TYPE_LABEL[offer.extraType] : "Offer"}
      </p>
      <p className="mt-1 text-lg font-black text-white">{offer.brand}</p>
      <p className="font-bold text-yellow-300">{offer.headline}</p>
      <p className="mt-1 flex items-start gap-1.5 text-sm text-stone-400">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {placeLine(place)}
          {place.address && <> · {place.distanceMi.toFixed(1)} mi</>}
        </span>
      </p>
      <p className="mt-1 text-xs text-stone-500">Hours: {offer.windowNote}</p>
      <ActionRow place={place} detailsOpen={detailsOpen} onToggleDetails={onToggleDetails}>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-sm font-semibold text-stone-200 hover:border-yellow-400"
          >
            <Plus className="h-4 w-4" /> Add to my day
          </button>
        )}
      </ActionRow>
      {detailsOpen && <OfferDetails place={place} />}
    </li>
  );
}
