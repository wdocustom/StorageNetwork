import { Star } from "lucide-react";
import Stars from "@/components/reviews/Stars";
import type { RatingSummary as Summary } from "@/lib/reviews";

/** Big average + stars + count, with the 5→1 distribution bars beside it. */
export default function RatingSummary({ summary, noun = "review" }: { summary: Summary; noun?: string }) {
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="shrink-0 text-center">
        <p className="text-4xl font-black leading-none text-white">{summary.average.toFixed(1)}</p>
        <Stars rating={summary.average} size="md" className="mt-1.5" />
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {summary.total} {noun}
          {summary.total === 1 ? "" : "s"}
        </p>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {summary.distribution.map((d) => (
          <div key={d.stars} className="flex items-center gap-2">
            <span className="w-3 text-right text-[10px] text-slate-500">{d.stars}</span>
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" aria-hidden />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-yellow-400" style={{ width: `${d.pct}%` }} />
            </div>
            <span className="w-5 text-right text-[10px] text-slate-600">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
