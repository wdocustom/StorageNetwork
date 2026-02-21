"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { DollarSign, Info, ChevronRight } from "lucide-react";

const BOUNTY_PER_JOB = 15;

interface NetworkPassiveIncomeProps {
  userId: string;
}

export default function NetworkPassiveIncome({ userId }: NetworkPassiveIncomeProps) {
  const supabase = getSupabaseBrowserClient();
  const [paidCount, setPaidCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    async function fetchBounties() {
      const [paidRes, pendingRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("referring_installer_id", userId)
          .eq("bounty_status", "paid"),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("referring_installer_id", userId)
          .eq("bounty_status", "pending"),
      ]);

      if (!paidRes.error && paidRes.count !== null) setPaidCount(paidRes.count);
      if (!pendingRes.error && pendingRes.count !== null) setPendingCount(pendingRes.count);
      setLoading(false);
    }

    fetchBounties();
  }, [supabase, userId]);

  const totalEarnings = paidCount * BOUNTY_PER_JOB;
  const hasActivity = paidCount > 0 || pendingCount > 0;

  return (
    <a
      href="/dashboard/referrals"
      className="group block rounded-xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/5 to-slate-900 p-4 text-center transition-all hover:border-yellow-400/40 hover:from-yellow-400/10"
    >
      <div className="mb-1 flex items-center justify-center gap-1.5">
        <DollarSign className="h-5 w-5 text-yellow-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
          Network Passive Income
        </span>
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowTooltip(!showTooltip);
            }}
            className="rounded-full p-0.5 text-stone-600 transition-colors hover:text-stone-400"
          >
            <Info className="h-3 w-3" />
          </button>
          {showTooltip && (
            <div className="absolute bottom-full left-1/2 z-10 mb-2 w-52 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-left shadow-xl">
              <p className="text-[11px] leading-relaxed text-stone-300">
                Share your link anywhere. When someone outside your area books with a local installer, you earn ${BOUNTY_PER_JOB}.
              </p>
              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
            </div>
          )}
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-20 mx-auto animate-pulse rounded bg-slate-800" />
      ) : hasActivity ? (
        <>
          <p className="text-2xl font-black text-yellow-400">
            ${totalEarnings.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-stone-600">
            {paidCount} paid{pendingCount > 0 ? ` · ${pendingCount} pending` : ""} · ${BOUNTY_PER_JOB} each
          </p>
        </>
      ) : (
        <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
          Earn ${BOUNTY_PER_JOB} every time someone outside your area uses your link and books with a local installer.
        </p>
      )}
      <div className="mt-2 flex items-center justify-center gap-1 text-[10px] font-semibold text-stone-600 transition-colors group-hover:text-yellow-400">
        {hasActivity ? "View Referrals" : "Learn How It Works"}
        <ChevronRight className="h-3 w-3" />
      </div>
    </a>
  );
}
