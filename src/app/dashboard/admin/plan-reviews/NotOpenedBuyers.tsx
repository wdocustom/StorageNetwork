"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { listNotOpenedBuyers, sendCheckInNow, type NotOpenedBuyer } from "@/app/actions/plan-check-ins";

// Plan buyers who haven't opened their plans (all three records agree), with
// the check-ins they've had. Review emails never go to these buyers; check-ins
// go out at 14 and 30 days, or send the first one now.

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function NotOpenedBuyers() {
  const [data, setData] = useState<{ buyers: NotOpenedBuyer[]; opened: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = () =>
    listNotOpenedBuyers().then((r) => (r.ok ? setData({ buyers: r.buyers, opened: r.opened }) : setError(r.error)));
  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!data) return <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />;

  return (
    <div>
      <p className="mb-4 text-sm text-stone-400">
        Last 45 days: <strong className="text-white">{data.opened}</strong> buyer{data.opened === 1 ? " has" : "s have"} opened their plans,{" "}
        <strong className="text-white">{data.buyers.length}</strong> haven&apos;t. &ldquo;Haven&apos;t&rdquo; means device records, plan activity
        and page views all show nothing after the checkout page. They get no review email; a check-in with their link goes out at 14 and 30
        days.
      </p>
      {data.buyers.length === 0 ? (
        <p className="text-sm text-stone-500">Everyone has opened their plans.</p>
      ) : (
        <div className="space-y-3">
          {data.buyers.map((b) => {
            const key = `${b.email}|${b.product}`;
            return (
              <div key={key} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-white">{b.name || b.email}</p>
                    {b.name && <p className="truncate text-xs text-stone-500">{b.email}</p>}
                    <p className="mt-1 text-xs text-stone-400">
                      {b.designName}
                      {b.product === "mini" ? " (Mini)" : ""} · bought {fmt(b.purchasedAt)} · {b.days} days ago
                    </p>
                    <p className="mt-1 text-xs text-amber-300">{b.reason}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {b.sent.length
                        ? b.sent.map((s) => `${s.stage === 1 ? "1st" : "2nd"} check-in sent ${fmt(s.at)}`).join(" · ")
                        : `No check-in yet (first goes out at 14 days)`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a
                      href={`mailto:${b.email}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-stone-300 hover:bg-slate-700"
                    >
                      <Mail className="h-3.5 w-3.5" /> Email
                    </a>
                    {b.sent.length === 0 && (
                      <button
                        type="button"
                        disabled={busy === key}
                        onClick={async () => {
                          setBusy(key);
                          const r = await sendCheckInNow(b.email, b.product);
                          setBusy(null);
                          setNotes((n) => ({ ...n, [key]: r.ok ? "Check-in sent." : r.error ?? "Couldn't send." }));
                          if (r.ok) load();
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-yellow-300 disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" /> {busy === key ? "Sending…" : "Send check-in now"}
                      </button>
                    )}
                  </div>
                </div>
                {notes[key] && <p className="mt-2 text-xs text-emerald-300">{notes[key]}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
