"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Close your open quotes — every unpaid quote from the last 30 days, hottest
// first, each with a ready follow-up message (matched to how far the
// customer got) carrying their pay link. Text opens the installer's own
// messages app pre-filled; nothing is sent on their behalf.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { Check, ChevronDown, Copy, Mail, MessageSquare, Target } from "lucide-react";
import type { OpenQuote, QuoteHeat } from "@/lib/server/marketing";
import { logActivityClient } from "@/lib/activity-client";
import { formatCurrency } from "@/utils/paymentHelpers";

const HEAT: Record<QuoteHeat, { label: string; tone: string }> = {
  payment: { label: "At payment", tone: "bg-emerald-500/15 text-emerald-400" },
  review: { label: "Started booking", tone: "bg-sky-500/15 text-sky-400" },
  opened: { label: "Opened", tone: "bg-yellow-400/15 text-yellow-400" },
  sent: { label: "Not opened yet", tone: "bg-slate-700 text-stone-400" },
};

const SHOW = 5;

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

function messageFor(q: OpenQuote, me: string, link: string): string {
  const hi = `Hi ${firstName(q.customerName)}, it's ${me}.`;
  switch (q.heat) {
    case "payment":
    case "review":
      return `${hi} Looks like you were almost done booking — did anything hold you up? Happy to adjust the design or answer any questions. Here's your link to finish: ${link}`;
    case "opened":
      return `${hi} Saw you had a chance to look at your quote — any questions I can answer, or anything you'd like changed? When you're ready, here's your link to lock in an install date: ${link}`;
    case "sent":
      return `${hi} Just making sure your quote${q.built ? ` for the ${q.built}` : ""} came through. Here it is: ${link} You can see the design and pick an install date right from there.`;
  }
}

function sinceLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`;
}

export default function CloseQuotes({ quotes, me, baseUrl }: { quotes: OpenQuote[]; me: string; baseUrl: string }) {
  const [showAll, setShowAll] = useState(false);
  const [followed, setFollowed] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const waiting = useMemo(() => quotes.reduce((s, q) => s + q.total, 0), [quotes]);
  const shown = showAll ? quotes : quotes.slice(0, SHOW);

  function mark(q: OpenQuote, channel: string) {
    setFollowed((f) => ({ ...f, [q.id]: new Date().toISOString() }));
    logActivityClient({ action: "quote_followup", pagePath: "/dashboard/marketing", detail: { lead_id: q.id, channel } });
  }

  return (
    <section id="quotes" className="scroll-mt-20 rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">Close your open quotes</h2>
        </div>
        {quotes.length > 0 && (
          <p className="text-[11px] text-stone-400">
            <span className="font-bold text-emerald-400">{formatCurrency(waiting)}</span> waiting · {quotes.length}{" "}
            {quotes.length === 1 ? "quote" : "quotes"}
          </p>
        )}
      </div>

      {quotes.length === 0 ? (
        <p className="px-4 py-5 text-sm text-stone-400">
          No open quotes from the last 30 days — every quote you&apos;ve sent has booked or expired. Build one from the
          Quote tab and it&apos;ll show up here until it&apos;s paid.
        </p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {shown.map((q) => {
            const link = `${baseUrl}/pay/${q.id}`;
            const msg = messageFor(q, me, link);
            const last = followed[q.id] ?? q.lastFollowUpAt;
            const heat = HEAT[q.heat];
            return (
              <li key={q.id} className="space-y-2.5 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{q.customerName}</p>
                    <p className="truncate text-xs text-stone-500">
                      {formatCurrency(q.total)}
                      {q.built && ` · ${q.built}`} · sent {sinceLabel(q.sentAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${heat.tone}`}>
                    {heat.label}
                    {q.views > 1 && q.heat !== "sent" ? ` · ${q.views}×` : ""}
                  </span>
                </div>

                <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs leading-relaxed text-stone-300">{msg}</p>

                <div className="flex flex-wrap items-center gap-2">
                  {q.phone && (
                    <a
                      href={`sms:${q.phone}?&body=${encodeURIComponent(msg)}`}
                      onClick={() => mark(q, "text")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Text
                    </a>
                  )}
                  {q.email && (
                    <a
                      href={`mailto:${q.email}?subject=${encodeURIComponent(`Your quote from ${me}`)}&body=${encodeURIComponent(msg)}`}
                      onClick={() => mark(q, "email")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700"
                    >
                      <Mail className="h-3.5 w-3.5" /> Email
                    </a>
                  )}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg).catch(() => {});
                      setCopied(q.id);
                      setTimeout(() => setCopied(null), 2000);
                      mark(q, "copy");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700"
                  >
                    {copied === q.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === q.id ? "Copied" : "Copy"}
                  </button>
                  {last && <span className="ml-auto text-[10px] text-stone-500">Followed up {sinceLabel(last)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {quotes.length > SHOW && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-slate-800 py-2.5 text-[11px] font-semibold text-stone-400 transition hover:text-white"
        >
          {showAll ? "Show fewer" : `Show all ${quotes.length}`}
          <ChevronDown className={`h-3.5 w-3.5 transition ${showAll ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>
  );
}
