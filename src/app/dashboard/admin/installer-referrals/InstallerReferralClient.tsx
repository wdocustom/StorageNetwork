"use client";

import { useState, useTransition } from "react";
import { Search, Copy, CheckCircle2, Link2 } from "lucide-react";
import {
  searchInstallersForReferral,
  type InstallerReferralProfile,
  type AdminProfileInfo,
} from "@/app/actions/admin-installer-referrals";

const BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}`
    : "";

function buildReferralLink(
  adminProfile: AdminProfileInfo,
  installer: InstallerReferralProfile
): string {
  const base = BASE_URL || "";
  const adminParam = adminProfile.ref_slug
    ? `ref=${encodeURIComponent(adminProfile.ref_slug)}`
    : `installer_id=${adminProfile.id}`;
  return `${base}/design?${adminParam}&ref_installer=${installer.id}`;
}

export default function InstallerReferralClient({
  adminProfile,
}: {
  adminProfile: AdminProfileInfo;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InstallerReferralProfile[]>([]);
  const [searched, setSearched] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearched(false);
    startTransition(async () => {
      const res = await searchInstallersForReferral(query);
      setResults(res.installers ?? []);
      setSearched(true);
    });
  }

  function copyLink(installer: InstallerReferralProfile) {
    const link = buildReferralLink(adminProfile, installer);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(installer.id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  }

  return (
    <div className="space-y-8">
      {/* Admin booking link info */}
      <div className="rounded-xl border border-yellow-400/20 bg-slate-900 p-5">
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-yellow-400">
          Your Booking Endpoint
        </p>
        <p className="text-sm text-stone-300">
          All referral links point to{" "}
          <span className="font-mono text-yellow-400">
            {adminProfile.ref_slug
              ? `/design?ref=${adminProfile.ref_slug}`
              : `/design?installer_id=${adminProfile.id}`}
          </span>
          , so customers are always routed to you.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-stone-400 space-y-2">
        <p className="font-semibold text-white text-xs uppercase tracking-wider mb-3">How it works</p>
        <p>1. Search for the referring installer below (by name, email, or ZIP code).</p>
        <p>2. Copy their unique referral link and send it to them.</p>
        <p>3. They share the link with customers who want rack builds.</p>
        <p>
          4. When a customer books through that link,{" "}
          <span className="text-yellow-400 font-semibold">they earn 30% of the deposit (min $15)</span>{" "}
          paid directly to their Stripe account — same as the standard network bounty.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or ZIP…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-4 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !query.trim()}
          className="rounded-lg bg-yellow-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-yellow-300 disabled:opacity-40"
        >
          {isPending ? "Searching…" : "Search"}
        </button>
      </form>

      {/* Results */}
      {searched && results.length === 0 && (
        <p className="text-sm text-stone-500">No installers found. Try a different search.</p>
      )}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((inst) => {
            const link = buildReferralLink(adminProfile, inst);
            const isCopied = copiedId === inst.id;
            return (
              <div
                key={inst.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">
                      {inst.business_name ||
                        [inst.first_name, inst.last_name].filter(Boolean).join(" ") ||
                        "Unnamed installer"}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {inst.email}
                      {inst.service_zip ? ` · ZIP ${inst.service_zip}` : ""}
                      {inst.is_pro ? " · Pro" : ""}
                      {inst.completed_jobs ? ` · ${inst.completed_jobs} jobs` : ""}
                    </p>
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-stone-600" />
                      <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-stone-400">
                        {link}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyLink(inst)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                      isCopied
                        ? "bg-emerald-400/10 text-emerald-400"
                        : "bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20"
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy link
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
