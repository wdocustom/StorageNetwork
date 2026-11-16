"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Platform Analytics → Plans → "Buyer activity"
//
// What buyers do with their DIY plans after paying: who opened them and how
// fast, who used the 3D guide and how far they got, PDF downloads, checklist
// use, more plans built, and who hasn't opened anything yet (worth a nudge).
// Tap a buyer for their full timeline.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { ChevronDown, Gift, Loader2 } from "lucide-react";
import { getPlanBuyerActivity, getPlanBuyerTimeline } from "@/app/actions/plan-buyer-activity";
import {
  PLAN_ACTIVITY_SINCE,
  formatDuration,
  type BuyerActivityReport,
  type BuyerActivitySummary,
  type TimelineEntry,
} from "@/lib/plan-activity-analytics";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const sinceLabel = new Date(`${PLAN_ACTIVITY_SINCE}T12:00:00Z`).toLocaleDateString(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function ago(iso: string | null): string {
  if (!iso) return "never";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return shortDate(iso);
}

function minutesLabel(min: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.round(min / 60)} hr`;
  return `${Math.round(min / 1440)} days`;
}

function Timeline({ email }: { email: string }) {
  const [rows, setRows] = useState<TimelineEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getPlanBuyerTimeline(email)
      .then((res) => {
        if (!live) return;
        if (res.success) setRows(res.data);
        else setError(res.error);
      })
      .catch(() => live && setError("Couldn't load this buyer's activity."));
    return () => {
      live = false;
    };
  }, [email]);

  if (error) return <p className="py-2 text-xs text-red-300">{error}</p>;
  if (!rows) return <Loader2 className="my-3 h-4 w-4 animate-spin text-stone-500" />;
  if (!rows.length) return <p className="py-2 text-xs text-stone-500">No activity recorded yet.</p>;
  return (
    <ol className="mt-2 max-h-80 space-y-1.5 overflow-y-auto border-l border-slate-700 pl-3">
      {rows.map((r, i) => (
        <li key={`${r.at}-${i}`} className="text-[11px] leading-snug">
          <span className="text-stone-500">{dateTime(r.at)}</span>{" "}
          <span className="font-semibold text-stone-200">{r.label}</span>
          {r.detail && <span className="text-stone-400"> · {r.detail}</span>}
          <span className="text-stone-600">
            {" "}
            · {r.plan}
            {r.device ? ` · ${r.device}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

function BuyerRow({ b }: { b: BuyerActivitySummary }) {
  const [open, setOpen] = useState(false);
  const facts = [
    b.opens ? `${b.opens} open${b.opens === 1 ? "" : "s"}` : "not opened",
    b.devices > 1 ? `${b.devices} devices` : null,
    b.guideOpens ? `guide ×${b.guideOpens}${b.guideSeconds ? ` (${formatDuration(b.guideSeconds)})` : ""}` : null,
    b.furthestStep ? `furthest: ${b.furthestStep}` : null,
    b.sectionsFinished ? `${b.sectionsFinished} section${b.sectionsFinished === 1 ? "" : "s"} done` : null,
    b.pdfDownloads ? `PDF ×${b.pdfDownloads}` : null,
    b.shopProgress ? `shopping ${b.shopProgress}` : null,
    b.plansBuilt ? `+${b.plansBuilt} plan${b.plansBuilt === 1 ? "" : "s"} built` : null,
  ].filter(Boolean);

  return (
    <li className="py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-200">
            <span className="truncate">{b.email}</span>
            {b.gifted && <Gift className="h-3 w-3 shrink-0 text-yellow-400" aria-label="Gift" />}
          </span>
          <span className="mt-0.5 block text-[11px] text-stone-500">{facts.join(" · ")}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-stone-400">
          {ago(b.lastActiveAt)}
          <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} aria-hidden />
        </span>
      </button>
      {open && <Timeline email={b.email} />}
    </li>
  );
}

export default function PlanBuyerActivity({ range }: { range: number }) {
  const [data, setData] = useState<BuyerActivityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let live = true;
    setError(null);
    getPlanBuyerActivity(range)
      .then((res) => {
        if (!live) return;
        if (res.success) setData(res.data);
        else setError(res.error);
      })
      .catch(() => live && setError("Couldn't load buyer activity."));
    return () => {
      live = false;
    };
  }, [range]);

  const card = "rounded-xl border border-slate-800 bg-slate-900 p-5";
  const title = "mb-3 text-xs font-bold uppercase tracking-wider text-stone-400";

  if (error) return <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>;
  if (!data) {
    return (
      <div className={`${card} flex justify-center`}>
        <Loader2 className="h-5 w-5 animate-spin text-stone-500" />
      </div>
    );
  }

  const opened = data.engagement[0];
  const rows = showAll ? data.rows : data.rows.slice(0, 25);

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Buyer activity</h3>
          <span className="text-[10px] text-stone-600">Recorded since {sinceLabel}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-stone-500">Buyers</p>
            <p className="text-xl font-black text-white">{data.buyers}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-stone-500">Opened</p>
            <p className="text-xl font-black text-white">{opened ? `${opened.pct}%` : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-stone-500">Time to open</p>
            <p className="text-xl font-black text-white">{minutesLabel(data.medianMinutesToOpen)}</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {data.engagement.map((s) => (
            <li key={s.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-stone-300">{s.label}</span>
                <span className="tabular-nums text-stone-400">
                  <span className="font-bold text-white">{s.count}</span> · {s.pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-yellow-400" style={{ width: `${s.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] text-stone-600">
          Of the buyers who purchased in this period. Time to open is the median from paying to first opening a plan.
        </p>
      </div>

      {data.neverOpened.length > 0 && (
        <div className={card}>
          <h3 className={title}>Haven&apos;t opened their plans yet</h3>
          <ul className="divide-y divide-slate-800 text-xs">
            {data.neverOpened.map((n) => (
              <li key={n.email} className="flex flex-wrap items-center justify-between gap-x-3 py-1.5">
                <span className="flex items-center gap-1.5 text-stone-200">
                  {n.email}
                  {n.gifted && <Gift className="h-3 w-3 text-yellow-400" aria-label="Gift" />}
                </span>
                <span className="text-stone-500">bought {ago(n.purchasedAt)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-stone-600">Worth a nudge: their access email may be in spam.</p>
        </div>
      )}

      <div className={card}>
        <h3 className={title}>Buyers by last activity</h3>
        {data.rows.length === 0 ? (
          <p className="text-sm text-stone-500">No buyer activity in this period yet.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-800">
              {rows.map((b) => (
                <BuyerRow key={b.email} b={b} />
              ))}
            </ul>
            {data.rows.length > rows.length && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-3 text-xs font-semibold text-yellow-400 hover:text-yellow-300"
              >
                Show all {data.rows.length}
              </button>
            )}
          </>
        )}
        <p className="mt-3 text-[10px] text-stone-600">Tap a buyer for their full timeline. Devices are numbered per buyer.</p>
      </div>
    </div>
  );
}
