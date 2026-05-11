import Image from "next/image";
import { Lock, FileText } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// LockedBlueprintsTeaser — Premium teaser for Material List, Module Layout,
// and Cut Plan features. Shown on /build page in place of the real
// components, which are only unlocked on paid job tickets.
// ═══════════════════════════════════════════════════════════════════════════

export default function LockedBlueprintsTeaser() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400/10">
          <Lock className="h-5 w-5 text-yellow-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">
            Pro Blueprints &amp; Cut Plans
          </h2>
          <p className="text-[11px] text-stone-400">
            Unlocked automatically when your customer pays their deposit
          </p>
        </div>
      </div>

      {/* Subtext */}
      <p className="mb-5 text-xs leading-relaxed text-stone-500">
        Exact material lists, module layouts, and board-by-board cut plans are
        automatically generated and unlocked in your Dashboard the moment your
        customer pays their deposit.
      </p>

      {/* Example images grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Material List & Module Layout example */}
        <div className="group relative overflow-hidden rounded-lg border border-slate-700/50">
          <div className="relative">
            <Image
              src="/images/example-material-list.webp"
              alt="Material List & Module Layout preview"
              width={600}
              height={400}
              className="w-full object-cover opacity-50 blur-[1px] transition-all group-hover:opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Lock className="mb-2 h-6 w-6 text-stone-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Material List &amp; Layout
              </span>
            </div>
          </div>
        </div>

        {/* Cut Plan example */}
        <div className="group relative overflow-hidden rounded-lg border border-slate-700/50">
          <div className="relative">
            <Image
              src="/images/example-cut-plan.webp"
              alt="Cut Plan preview"
              width={600}
              height={400}
              className="w-full object-cover opacity-50 blur-[1px] transition-all group-hover:opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Lock className="mb-2 h-6 w-6 text-stone-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Board-by-Board Cut Plan
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-4 flex items-center justify-center">
        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-xs font-semibold text-stone-500">
          <FileText className="h-3.5 w-3.5" />
          Unlocked on Paid Job Ticket
        </span>
      </div>
    </section>
  );
}
