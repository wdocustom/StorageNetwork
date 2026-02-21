"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { DollarSign, Info } from "lucide-react";

const BOUNTY_PER_JOB = 15;

interface NetworkPassiveIncomeProps {
  userId: string;
}

export default function NetworkPassiveIncome({ userId }: NetworkPassiveIncomeProps) {
  const supabase = getSupabaseBrowserClient();
  const [paidCount, setPaidCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    async function fetchBounties() {
      const { count, error } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("referring_installer_id", userId)
        .eq("bounty_status", "paid");

      if (!error && count !== null) {
        setPaidCount(count);
      }
      setLoading(false);
    }

    fetchBounties();
  }, [supabase, userId]);

  // Don't render if no bounties yet
  if (!loading && paidCount === 0) return null;

  const totalEarnings = paidCount * BOUNTY_PER_JOB;

  return (
    <div className="rounded-xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/5 to-slate-900 p-4 text-center">
      <div className="mb-1 flex items-center justify-center gap-1.5">
        <DollarSign className="h-5 w-5 text-yellow-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
          Network Passive Income
        </span>
        <div className="relative">
          <button
            onClick={() => setShowTooltip(!showTooltip)}
            className="rounded-full p-0.5 text-stone-600 transition-colors hover:text-stone-400"
          >
            <Info className="h-3 w-3" />
          </button>
          {showTooltip && (
            <div className="absolute bottom-full left-1/2 z-10 mb-2 w-52 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-left shadow-xl">
              <p className="text-[11px] leading-relaxed text-stone-300">
                Earnings from out-of-state customers who used your link. You earn ${BOUNTY_PER_JOB} for each booked job.
              </p>
              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
            </div>
          )}
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-20 mx-auto animate-pulse rounded bg-slate-800" />
      ) : (
        <>
          <p className="text-2xl font-black text-yellow-400">
            ${totalEarnings.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-stone-600">
            {paidCount} referral{paidCount !== 1 ? "s" : ""} · ${BOUNTY_PER_JOB} each
          </p>
        </>
      )}
    </div>
  );
}
