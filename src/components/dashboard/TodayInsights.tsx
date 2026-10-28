import Link from "next/link";
import { BarChart3, ChevronRight, Eye, Lightbulb, Send, TrendingDown, TrendingUp } from "lucide-react";
import { INSIGHT_DAYS, loadTodayInsights, type TodayInsights as Insights } from "@/lib/server/dashboard-insights";

// ═══════════════════════════════════════════════════════════════════════════
// Today → Analytics peek (server component, streamed under Suspense).
// Two numbers that matter and one next step; the full picture is a tap away.
// ═══════════════════════════════════════════════════════════════════════════

const CARD = "rounded-2xl border border-slate-800 bg-slate-900";

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export default async function TodayInsights({ userId, slug }: { userId: string; slug: string | null }) {
  return <TodayInsightsCard i={await loadTodayInsights(userId, slug)} />;
}

export function TodayInsightsCard({ i }: { i: Insights }) {

  const trend =
    i.profileViews !== null && i.profileViewsPrev
      ? Math.round(((i.profileViews - i.profileViewsPrev) / i.profileViewsPrev) * 100)
      : null;
  const close = pct(i.booked, i.linksSent);

  // One next step, most actionable first.
  const next =
    i.openedNotBooked > 0
      ? {
          text: `${i.openedNotBooked} ${i.openedNotBooked === 1 ? "customer opened their quote" : "customers opened their quotes"} but ${i.openedNotBooked === 1 ? "hasn't" : "haven't"} booked — a quick follow-up closes jobs.`,
          cta: "Follow up",
          href: "/dashboard/leads?tab=unpaid",
        }
      : i.linksSent === 0
        ? { text: `No quote links sent in the last ${INSIGHT_DAYS} days.`, cta: "Build a quote", href: "/dashboard/build" }
        : i.profileViews === 0
          ? { text: "Nobody has visited your profile lately — share your link.", cta: "Share", href: "/dashboard/marketing" }
          : null;

  return (
    <section className={CARD}>
      <Link
        href="/dashboard/analytics"
        className="flex items-center justify-between border-b border-slate-800 px-4 py-3 transition hover:bg-slate-800/40"
      >
        <span className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">Analytics</span>
          <span className="text-[10px] text-stone-500">Last {INSIGHT_DAYS} days</span>
        </span>
        <span className="flex items-center gap-0.5 text-[11px] font-semibold text-stone-400">
          Open
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </Link>

      <div className="grid grid-cols-2 divide-x divide-slate-800">
        {/* Profile views */}
        <div className="px-4 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
            <Eye className="h-3 w-3" /> Profile views
          </p>
          {i.profileViews === null ? (
            <Link href="/dashboard/profile" className="mt-1 block text-xs font-semibold text-yellow-400">
              Set up your profile
            </Link>
          ) : (
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{i.profileViews.toLocaleString()}</span>
              {trend !== null && trend !== 0 && (
                <span
                  className={`flex items-center gap-0.5 text-[11px] font-bold ${trend > 0 ? "text-emerald-400" : "text-red-400"}`}
                >
                  {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(trend)}%
                </span>
              )}
            </p>
          )}
          {i.profileViewsPrev !== null && (
            <p className="mt-1 text-[10px] text-stone-500">
              {i.profileViewsPrev.toLocaleString()} the {INSIGHT_DAYS} days before
            </p>
          )}
        </div>

        {/* Quote links → booked */}
        <div className="px-4 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
            <Send className="h-3 w-3" /> Links → booked
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{close}%</span>
            <span className="text-[11px] text-stone-400">
              {i.booked} of {i.linksSent}
            </span>
          </p>
          {i.linksSent > 0 && (
            <div className="mt-2 space-y-1" aria-label={`${i.linksSent} sent, ${i.linksOpened} opened, ${i.booked} booked`}>
              {[
                { label: "Sent", n: i.linksSent, tone: "bg-slate-600" },
                { label: "Opened", n: i.linksOpened, tone: "bg-sky-500" },
                { label: "Booked", n: i.booked, tone: "bg-emerald-500" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full ${s.tone}`} style={{ width: `${pct(s.n, i.linksSent)}%` }} />
                  </div>
                  <span className="w-14 text-right text-[10px] text-stone-500">
                    {s.n} {s.label.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {next && (
        <Link
          href={next.href}
          className="flex items-center gap-3 border-t border-slate-800 px-4 py-3 transition hover:bg-slate-800/40"
        >
          <Lightbulb className="h-4 w-4 shrink-0 text-yellow-400" />
          <span className="min-w-0 flex-1 text-xs text-stone-300">{next.text}</span>
          <span className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-white">{next.cta}</span>
        </Link>
      )}
    </section>
  );
}

/** Placeholder while the numbers stream in. */
export function TodayInsightsSkeleton() {
  return (
    <section className={`${CARD} animate-pulse`} aria-busy="true">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <BarChart3 className="h-4 w-4 text-purple-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-white">Analytics</span>
      </div>
      <div className="grid grid-cols-2 gap-4 px-4 py-4">
        <div className="h-10 rounded bg-slate-800" />
        <div className="h-10 rounded bg-slate-800" />
      </div>
    </section>
  );
}
