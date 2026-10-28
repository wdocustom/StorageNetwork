"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Today — the installer's active jobs, sorted into what needs doing:
//
//   install date passed → installing today / this week → needs a date →
//   waiting on final payment
//
// Rows come from the server; only "what is today" is decided here, in the
// installer's own timezone (install dates are calendar dates, see
// utils/installDate). The first render uses the server's date so hydration
// matches, then corrects to the device's date.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarPlus, CheckCircle2, ChevronRight, Hammer, Wallet } from "lucide-react";
import type { TodayJob } from "@/lib/server/dashboard-today";
import { formatInstallDate, todayInstallDateKey, toInstallDateKey } from "@/utils/installDate";
import { formatCurrency } from "@/utils/paymentHelpers";

const WEEK_DAYS = 7;

type Kind = "overdue" | "today" | "upcoming" | "unscheduled" | "payment";

const KIND: Record<Kind, { icon: typeof Hammer; tone: string; order: number }> = {
  overdue: { icon: AlertTriangle, tone: "text-amber-400 bg-amber-400/10", order: 0 },
  today: { icon: Hammer, tone: "text-yellow-400 bg-yellow-400/10", order: 1 },
  upcoming: { icon: CalendarClock, tone: "text-sky-400 bg-sky-400/10", order: 2 },
  unscheduled: { icon: CalendarPlus, tone: "text-purple-400 bg-purple-400/10", order: 3 },
  payment: { icon: Wallet, tone: "text-emerald-400 bg-emerald-400/10", order: 4 },
};

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function classify(job: TodayJob, today: string): Kind | null {
  if (job.status === "payment_pending") return "payment";
  const key = toInstallDateKey(job.scheduled_at);
  if (!key) return "unscheduled";
  if (key < today) return "overdue";
  if (key === today) return "today";
  if (key < addDays(today, WEEK_DAYS)) return "upcoming";
  return null; // later — counted, not listed
}

function describe(kind: Kind, job: TodayJob): string {
  switch (kind) {
    case "overdue":
      return `Install was ${formatInstallDate(job.scheduled_at)} — wrap it up`;
    case "today":
      return "Installing today";
    case "upcoming":
      return `Install ${formatInstallDate(job.scheduled_at)}`;
    case "unscheduled":
      return job.status === "new" ? "New booking — pick an install date" : "Needs an install date";
    case "payment":
      return job.balance_due ? `Waiting on final payment · ${formatCurrency(job.balance_due)}` : "Waiting on final payment";
  }
}

export default function TodayJobs({ jobs, serverToday }: { jobs: TodayJob[]; serverToday: string }) {
  const [today, setToday] = useState(serverToday);
  useEffect(() => setToday(todayInstallDateKey()), []);

  const { rows, later } = useMemo(() => {
    const rows: { job: TodayJob; kind: Kind }[] = [];
    let later = 0;
    for (const job of jobs) {
      const kind = classify(job, today);
      if (kind) rows.push({ job, kind });
      else later += 1;
    }
    rows.sort(
      (a, b) =>
        KIND[a.kind].order - KIND[b.kind].order ||
        (toInstallDateKey(a.job.scheduled_at) ?? "").localeCompare(toInstallDateKey(b.job.scheduled_at) ?? ""),
    );
    return { rows, later };
  }, [jobs, today]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white">Your jobs</h2>
        <Link href="/dashboard/leads" className="text-[11px] font-semibold text-stone-400 transition hover:text-yellow-400">
          All jobs
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <p className="text-sm text-stone-300">
            {later > 0 ? "Nothing due this week." : "You're all caught up — no active jobs."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-800">
          {rows.map(({ job, kind }) => {
            const { icon: Icon, tone } = KIND[kind];
            return (
              <li key={job.id}>
                <Link
                  href={`/dashboard/leads/${job.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-800/60 active:bg-slate-800"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">{job.customer_name || "Customer"}</span>
                    <span className="block truncate text-xs text-stone-400">{describe(kind, job)}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-600" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {later > 0 && (
        <Link
          href="/dashboard/leads"
          className="block border-t border-slate-800 px-4 py-2.5 text-center text-[11px] font-semibold text-stone-500 transition hover:text-yellow-400"
        >
          + {later} scheduled after this week
        </Link>
      )}
    </section>
  );
}
