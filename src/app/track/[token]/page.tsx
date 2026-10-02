"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle2, Circle, Phone, CalendarClock, MapPin, RefreshCw } from "lucide-react";
import { getTrackingPage, type TrackingPageData } from "@/app/actions/install-tracking";

// ═══════════════════════════════════════════════════════════════════════════
// Track Your Install — /track/[token]
//
// Linked from the booking confirmation, the "built" email and the
// day-before reminder. Shows the install date, the steps the
// installer has marked (built → loaded up → on the way → installed), what's
// due at install, and a link to change the date while that's still allowed.
// No GPS and no polling — customers are told to keep it open on install day
// and tap Refresh to see "loaded up" / "on the way".
// ═══════════════════════════════════════════════════════════════════════════

const STEPS: Array<{ id: string; label: string }> = [
  { id: "scheduled", label: "Scheduled" },
  { id: "built", label: "Built" },
  { id: "loaded", label: "Loaded up" },
  { id: "on_the_way", label: "On the way" },
  { id: "installed", label: "Installed" },
];

function money(n: number) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clock(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "7:42 AM" today, "Oct 6, 7:42 AM" otherwise. */
function stepTime(iso: string, now: Date) {
  const d = new Date(iso);
  return d.toDateString() === now.toDateString()
    ? clock(d)
    : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${clock(d)}`;
}

/** "just now" / "12 min ago" / "3 hr ago" for the last 12 hours, else null. */
function ago(iso: string, now: Date) {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 0 || mins >= 12 * 60) return null;
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)} hr ago`;
}

function prettyDate(date: string, time?: string | null) {
  const d = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return time === "morning" || time === "afternoon" ? `${d} (${time})` : d;
}

export default function TrackInstallPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<TrackingPageData | null>(null);
  const [error, setError] = useState("");

  const [refreshing, setRefreshing] = useState(false);
  // When the page last fetched, so the customer can tell how fresh it is.
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  // Re-renders the "12 min ago" labels; no network, just the clock.
  const [now, setNow] = useState(() => new Date());

  function load() {
    return getTrackingPage(token).then((r) => {
      if (r.data) {
        setData(r.data);
        setCheckedAt(new Date());
        setNow(new Date());
      } else setError(r.error || "This link isn't valid.");
    });
  }

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-400" />
          <h1 className="mb-2 text-lg font-bold text-white">Link Not Valid</h1>
          <p className="text-sm text-stone-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-yellow-400" />
      </div>
    );
  }

  // Index of the furthest step reached.
  const current = data.installed
    ? 4
    : data.stage === "on_the_way"
      ? 3
      : data.stage === "loaded"
        ? 2
        : data.stage === "built"
          ? 1
          : data.scheduledDate
            ? 0
            : -1;

  const headline = data.installed
    ? "Installed!"
    : data.stage === "on_the_way"
      ? `${data.installerName} is on the way`
      : data.stage === "loaded"
        ? "Loaded up"
        : data.stage === "built"
          ? "Your rack is built"
          : data.scheduledDate
            ? "You're scheduled"
            : "Pick your install date";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/landing_page_logo.png" alt="storage-network.app" className="mb-5 h-12 w-auto" />
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">{data.installerName}</p>
        <h1 className="mb-1 mt-1 text-2xl font-black text-white">{headline}</h1>
        {data.scheduledDate && (
          <p className="mb-6 flex items-center gap-1.5 text-sm text-yellow-400">
            <CalendarClock className="h-4 w-4" />
            {prettyDate(data.scheduledDate, data.timePreference)}
          </p>
        )}

        {/* Steps */}
        <ol className="mb-6 space-y-3">
          {STEPS.map((step, i) => {
            const done = i <= current;
            const active = i === current && !data.installed;
            // When the installer marked it (skipped steps have no time).
            const at =
              done && step.id !== "scheduled"
                ? data.stepTimes?.[step.id as keyof TrackingPageData["stepTimes"]] ?? null
                : null;
            const rel = at ? ago(at, now) : null;
            return (
              <li key={step.id} className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className={`h-5 w-5 shrink-0 ${active ? "text-yellow-400" : "text-emerald-400"}`} />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-slate-700" />
                )}
                <span className={`text-sm ${done ? "font-semibold text-white" : "text-stone-600"}`}>{step.label}</span>
                {at && (
                  <span className="ml-auto text-right text-[11px] leading-tight text-stone-500">
                    {stepTime(at, now)}
                    {rel && <span className={active ? " text-yellow-400/80" : " text-stone-600"}> · {rel}</span>}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {!data.installed && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
            <div>
              <p className="text-xs text-stone-300">
                On install day, keep this page open and refresh it to see when {data.installerName} is loaded up and on the way.
              </p>
              {checkedAt && <p className="mt-1 text-[10px] text-stone-500">Last checked {clock(checkedAt)}</p>}
            </div>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold text-gray-950 hover:bg-yellow-300 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        )}

        {!data.installed && (
          <div className="mb-5 space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm">
            {data.address && (
              <p className="flex items-start gap-2 text-stone-300">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
                {data.address}
              </p>
            )}
            {data.balanceDue > 0 && (
              <p className="flex justify-between text-stone-400">
                <span>Balance due at install</span>
                <span className="font-semibold text-white">{money(data.balanceDue)}</span>
              </p>
            )}
            {data.stage !== "on_the_way" && (
              <p className="text-xs text-stone-500">Please clear the wall and floor where your rack is going.</p>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          {data.scheduleUrl && !data.installed && (
            <a
              href={data.scheduleUrl}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-center text-sm font-semibold text-stone-200 hover:bg-slate-700"
            >
              {data.scheduledDate ? "Change Date" : "Pick Your Install Date"}
            </a>
          )}
          {data.installerPhone && (
            <a
              href={`tel:${data.installerPhone}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-yellow-400 hover:text-yellow-300"
            >
              <Phone className="h-3.5 w-3.5" />
              {data.installerPhone}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
