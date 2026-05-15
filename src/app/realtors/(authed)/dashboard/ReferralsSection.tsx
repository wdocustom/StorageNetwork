// ═══════════════════════════════════════════════════════════════════════════
// ReferralsSection — Realtor dashboard tile for the referral program
//
// Surfaces the realtor's share link + lifetime conversion stats. Booked
// jobs from this realtor's referrals waive the installer's platform fee
// AND credit the realtor 5 totes per converted lead (migration 119).
// ═══════════════════════════════════════════════════════════════════════════

import { Link2, Sparkles } from "lucide-react";
import { getRealtorReferralStats } from "@/app/actions/realtor-referrals";
import { CopyShareLinkButton } from "./CopyShareLinkButton";

export async function ReferralsSection() {
  const result = await getRealtorReferralStats();

  if (!result.success || !result.stats) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-bold">Referrals</h2>
        <p className="mt-2 text-sm text-stone-400">
          Referral codes are loading. Refresh the page in a moment.
        </p>
      </div>
    );
  }

  const { shareUrl, conversionCount, totesEarned } = result.stats;

  return (
    <div className="rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/5 to-slate-900/40 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-400" />
            <h2 className="text-lg font-bold">Referrals</h2>
          </div>
          <p className="text-sm leading-relaxed text-stone-400">
            Share your link with anyone who needs a storage build. When they
            book with a network installer, you earn{" "}
            <span className="font-bold text-yellow-300">5 free totes</span>{" "}
            credited straight to your gift inventory.
          </p>
        </div>
      </div>

      {/* ── Share link ────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-stretch gap-2 rounded-xl border border-slate-700/60 bg-slate-950/60 p-2">
        <div className="flex flex-1 items-center gap-2 px-2 text-xs text-stone-300 sm:text-sm">
          <Link2 className="h-4 w-4 shrink-0 text-stone-500" />
          <span className="truncate font-mono">{shareUrl}</span>
        </div>
        <CopyShareLinkButton url={shareUrl} />
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Converted referrals" value={conversionCount} />
        <StatTile label="Totes earned" value={totesEarned} accent />
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-wider text-stone-500">{label}</p>
      <p
        className={
          "mt-1 text-2xl font-black " +
          (accent ? "text-yellow-300" : "text-white")
        }
      >
        {value}
      </p>
    </div>
  );
}
