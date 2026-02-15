"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  getPartnerDashboard,
  type PartnerCommission,
  type ReferralRow,
} from "@/app/actions/partner";
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  Users,
  DollarSign,
  Award,
  Copy,
  CheckCircle2,
  Link2,
  AlertCircle,
} from "lucide-react";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Partner Dashboard — "The Elite View"
//
// High-end financial dashboard for affiliate partners.
// Shows tier, active referrals, projected commission, and installer ledger.
// Dark Industrial theme: Slate-950, Slate-900, Yellow-400.
// ═══════════════════════════════════════════════════════════════════════════

export default function PartnerDashboardPage() {
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partner, setPartner] = useState<{
    id: string;
    name: string;
    company: string;
    slug: string;
  } | null>(null);
  const [commission, setCommission] = useState<PartnerCommission | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const result = await getPartnerDashboard(user.id);

    if (result.success) {
      setPartner(result.partner ?? null);
      setCommission(result.commission ?? null);
      setReferrals(result.referrals ?? []);
      setTotalReferrals(result.totalReferrals ?? 0);
    } else {
      setError(result.error || "Failed to load partner data.");
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleCopyLink() {
    if (!partner) return;
    const link = `${siteConfig.baseUrl}/join/${partner.slug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ── Loading State ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  // ── Error / Not Authorized ─────────────────────────────────────────────
  if (error || !partner || !commission) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h1 className="mb-2 text-xl font-bold text-white">Access Denied</h1>
        <p className="mb-6 max-w-sm text-center text-sm text-stone-400">
          {error || "You are not authorized to view the Partner Portal."}
        </p>
        <a
          href="/dashboard"
          className="rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          Back to Dashboard
        </a>
      </div>
    );
  }

  const activeCount = Number(commission.active_count);
  const tierRate = Number(commission.tier_rate);
  const projected = Number(commission.projected_monthly);
  const pendingCount = referrals.filter((r) => r.status === "pending").length;
  const inactiveCount = referrals.filter((r) => r.status === "inactive").length;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <a
            href="/dashboard/profile"
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex-1">
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Partner Portal
            </h1>
            <p className="text-[11px] text-stone-500">
              {partner.company}
            </p>
          </div>
          <div className="rounded-full bg-yellow-400/10 px-3 py-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
              Affiliate Partner
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 p-4">
        {/* ═══════════════════════════════════════════════════════════════
            HERO: Referral Link
        ═══════════════════════════════════════════════════════════════ */}
        <section className="overflow-hidden rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/5 to-slate-900">
          <div className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-yellow-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                Your Referral Link
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3">
                <p className="truncate font-mono text-sm text-white">
                  {siteConfig.baseUrl}/join/{partner.slug}
                </p>
              </div>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 rounded-lg bg-yellow-400 px-5 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Share this link. When installers sign up and subscribe to Pro, you earn commission.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            KPI CARDS
        ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Current Tier */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                Current Tier
              </span>
            </div>
            <p className="text-lg font-extrabold text-white">
              ${tierRate}
            </p>
            <p className="text-[11px] text-stone-500">per active Pro</p>
          </div>

          {/* Active Pro Referrals */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                Active Pros
              </span>
            </div>
            <p className="text-lg font-extrabold text-emerald-400">
              {activeCount}
            </p>
            <p className="text-[11px] text-stone-500">paying subscribers</p>
          </div>

          {/* Projected Monthly */}
          <div className="rounded-2xl border border-yellow-400/20 bg-gradient-to-b from-yellow-400/5 to-slate-900 p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                Monthly
              </span>
            </div>
            <p className="text-lg font-extrabold text-yellow-400">
              ${projected.toLocaleString()}
            </p>
            <p className="text-[11px] text-stone-500">projected commission</p>
          </div>

          {/* Pipeline */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                Pipeline
              </span>
            </div>
            <p className="text-lg font-extrabold text-white">
              {totalReferrals}
            </p>
            <p className="text-[11px] text-stone-500">
              total referrals
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            TIER BREAKDOWN
        ═══════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Award className="h-4 w-4 text-yellow-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Commission Tiers
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`rounded-xl border p-4 ${
                activeCount <= 50
                  ? "border-yellow-400/30 bg-yellow-400/5"
                  : "border-slate-700 bg-slate-800/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">Tier 1</span>
                {activeCount <= 50 && (
                  <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                    CURRENT
                  </span>
                )}
              </div>
              <p className="mt-1 text-2xl font-black text-white">$35</p>
              <p className="text-xs text-stone-500">per active Pro (1–50)</p>
            </div>
            <div
              className={`rounded-xl border p-4 ${
                activeCount > 50
                  ? "border-yellow-400/30 bg-yellow-400/5"
                  : "border-slate-700 bg-slate-800/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">Tier 2</span>
                {activeCount > 50 && (
                  <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                    CURRENT
                  </span>
                )}
              </div>
              <p className="mt-1 text-2xl font-black text-white">$25</p>
              <p className="text-xs text-stone-500">per active Pro (51+)</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-stone-500">
            Commission is calculated on active Pro subscribers only.
            Free-tier installers do not count toward your payout.
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            INSTALLER LEDGER
        ═══════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-yellow-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Installer Ledger
              </h2>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                {activeCount} Active
              </span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-400">
                  {pendingCount} Pending
                </span>
              )}
              {inactiveCount > 0 && (
                <span className="rounded-full bg-slate-700 px-2.5 py-1 text-[10px] font-bold text-stone-400">
                  {inactiveCount} Inactive
                </span>
              )}
            </div>
          </div>

          {referrals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 py-12 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-stone-600" />
              <p className="text-sm font-medium text-stone-400">
                No referrals yet
              </p>
              <p className="mt-1 text-xs text-stone-600">
                Share your referral link to start building your network.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-700">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 border-b border-slate-700 bg-slate-800/50 px-4 py-2.5">
                <span className="col-span-5 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                  Installer
                </span>
                <span className="col-span-3 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                  Join Date
                </span>
                <span className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                  Status
                </span>
                <span className="col-span-2 text-right text-[10px] font-bold uppercase tracking-widest text-stone-500">
                  Value
                </span>
              </div>

              {/* Table Rows */}
              {referrals.map((ref) => (
                <div
                  key={ref.id}
                  className="grid grid-cols-12 items-center gap-2 border-b border-slate-800 px-4 py-3 last:border-0"
                >
                  {/* Name */}
                  <div className="col-span-5">
                    <p className="text-sm font-medium text-white">
                      {ref.installer_name}
                    </p>
                    {ref.installer_business && (
                      <p className="text-[11px] text-stone-500">
                        {ref.installer_business}
                      </p>
                    )}
                  </div>

                  {/* Join Date */}
                  <div className="col-span-3">
                    <p className="text-xs text-stone-400">
                      {new Date(ref.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="col-span-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        ref.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : ref.status === "pending"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-slate-700 text-stone-400"
                      }`}
                    >
                      {ref.status}
                    </span>
                  </div>

                  {/* Per-installer Value */}
                  <div className="col-span-2 text-right">
                    <span
                      className={`font-mono text-sm font-bold ${
                        ref.status === "active"
                          ? "text-yellow-400"
                          : "text-stone-600"
                      }`}
                    >
                      {ref.status === "active" ? `$${tierRate}` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Fine Print ──────────────────────────────────────────────── */}
        <div className="pb-8 text-center">
          <p className="text-xs text-stone-600">
            Commissions are calculated monthly based on active Pro subscribers.
            Free-tier installers are excluded. Rate adjusts automatically at 50+ referrals.
          </p>
        </div>
      </main>
    </div>
  );
}
