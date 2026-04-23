"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  getPartnerDashboard,
  getAdminPlatformUsers,
  getAdminReferralBounties,
  toggleInstallerSuspension,
  type PartnerCommission,
  type ReferralRow,
  type PlatformUser,
  type ReferrerSummary,
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
  Shield,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronUp,
  Banknote,
  Clock,
  MapPin,
  ToggleLeft,
  ToggleRight,
  Ban,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import ProPill from "@/components/dashboard/ProPill";

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

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const [suspendingUser, setSuspendingUser] = useState<string | null>(null);

  // Bounty admin state
  const [bountyReferrers, setBountyReferrers] = useState<ReferrerSummary[]>([]);
  const [bountyTotals, setBountyTotals] = useState<{ totalPaid: number; totalPending: number; totalReferrals: number } | null>(null);
  const [bountyLoading, setBountyLoading] = useState(false);
  const [bountySearch, setBountySearch] = useState("");
  const [expandedReferrer, setExpandedReferrer] = useState<string | null>(null);

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

      // If admin, load all platform users + bounty data
      if (result.isAdmin) {
        setIsAdmin(true);
        setAdminLoading(true);
        setBountyLoading(true);

        const [adminResult, bountyResult] = await Promise.all([
          getAdminPlatformUsers(user.id),
          getAdminReferralBounties(user.id),
        ]);

        if (adminResult.success) {
          setPlatformUsers(adminResult.users ?? []);
        }
        if (bountyResult.success) {
          setBountyReferrers(bountyResult.referrers ?? []);
          setBountyTotals(bountyResult.totals ?? null);
        }

        setAdminLoading(false);
        setBountyLoading(false);
      }
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

  function handleCopyBookingLink(link: string, userId: string) {
    navigator.clipboard.writeText(link);
    setCopiedLink(userId);
    setTimeout(() => setCopiedLink(null), 2500);
  }

  async function handleToggleSuspension(u: PlatformUser) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setSuspendingUser(u.id);
    const result = await toggleInstallerSuspension(user.id, u.id, !u.is_suspended);
    if (result.success) {
      setPlatformUsers((prev) =>
        prev.map((p) =>
          p.id === u.id
            ? {
                ...p,
                is_suspended: !u.is_suspended,
                suspension_reason: !u.is_suspended ? "manual" : null,
              }
            : p
        )
      );
    }
    setSuspendingUser(null);
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
          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="rounded-full bg-red-500/10 px-3 py-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
                  Admin
                </span>
              </div>
            )}
            <ProPill />
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
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          ref.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : ref.status === "pending"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-slate-700 text-stone-400"
                        }`}
                      >
                        {ref.status}
                      </span>
                      {ref.is_pro ? (
                        <span className="inline-flex w-fit rounded-full bg-yellow-400/10 px-2 py-0.5 text-[9px] font-bold text-yellow-400">
                          PRO
                        </span>
                      ) : (
                        <span className="inline-flex w-fit rounded-full bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-stone-600">
                          FREE
                        </span>
                      )}
                    </div>
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

        {/* ═══════════════════════════════════════════════════════════════
            ADMIN: All Platform Users (admin only)
        ═══════════════════════════════════════════════════════════════ */}
        {isAdmin && (
          <section className="rounded-2xl border border-red-500/20 bg-gradient-to-b from-red-500/5 to-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  All Platform Users
                </h2>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-stone-400">
                  {platformUsers.length}
                </span>
              </div>
              <div className="flex gap-2 text-[10px] font-bold">
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                  {platformUsers.filter((u) => u.is_pro).length} Pro
                </span>
                <span className="rounded-full bg-slate-700 px-2 py-0.5 text-stone-400">
                  {platformUsers.filter((u) => !u.is_pro).length} Free
                </span>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
              <input
                type="text"
                placeholder="Search by name, business, email, or slug..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-stone-500 focus:border-yellow-400/50 focus:outline-none"
              />
            </div>

            {adminLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
              </div>
            ) : (
              <div className="space-y-2">
                {platformUsers
                  .filter((u) => {
                    if (!adminSearch) return true;
                    const q = adminSearch.toLowerCase();
                    return (
                      (u.first_name?.toLowerCase().includes(q)) ||
                      (u.last_name?.toLowerCase().includes(q)) ||
                      (u.business_name?.toLowerCase().includes(q)) ||
                      (u.email?.toLowerCase().includes(q)) ||
                      (u.slug?.toLowerCase().includes(q))
                    );
                  })
                  .map((u) => {
                    const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ") || "No Name";
                    const isExpanded = expandedUser === u.id;

                    return (
                      <div
                        key={u.id}
                        className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50"
                      >
                        {/* Row Header — always visible */}
                        <button
                          onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-white">
                                {fullName}
                              </p>
                              {u.is_pro && (
                                <span className="flex-shrink-0 rounded bg-yellow-400/10 px-1.5 py-0.5 text-[9px] font-bold text-yellow-400">
                                  PRO
                                </span>
                              )}
                              {u.is_partner && (
                                <span className="flex-shrink-0 rounded bg-blue-400/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
                                  PARTNER
                                </span>
                              )}
                              {u.is_suspended && (
                                <span className="flex-shrink-0 rounded bg-red-400/10 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                                  LOCKED
                                </span>
                              )}
                              {u.trial_expired && (
                                <span className="flex-shrink-0 rounded bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                                  TRIAL EXPIRED
                                </span>
                              )}
                              <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                u.stripe_connected
                                  ? "bg-emerald-400/10 text-emerald-400"
                                  : "bg-red-400/10 text-red-400"
                              }`}>
                                STRIPE
                              </span>
                            </div>
                            <p className="truncate text-[11px] text-stone-500">
                              {u.business_name || u.email || "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <div>
                              <p className="text-xs font-bold text-stone-300">
                                {u.completed_jobs} jobs
                              </p>
                              <p className="text-[10px] text-stone-500">
                                {u.last_login_at
                                  ? `Active ${new Date(u.last_login_at).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })}`
                                  : "Never logged in"}
                              </p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-stone-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-stone-500" />
                            )}
                          </div>
                        </button>

                        {/* Expanded Detail Panel */}
                        {isExpanded && (
                          <div className="border-t border-slate-700 bg-slate-900/50 px-4 py-4">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Email</p>
                                <p className="text-stone-300">{u.email || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Phone</p>
                                <p className="text-stone-300">{u.phone || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Location</p>
                                <p className="text-stone-300">
                                  {[u.city, u.state].filter(Boolean).join(", ") || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Slug</p>
                                <p className="font-mono text-stone-300">{u.slug || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Completed Jobs</p>
                                <p className="text-stone-300">{u.completed_jobs}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Job Score</p>
                                <p className="text-stone-300">{u.job_score}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Last Login</p>
                                <p className="text-stone-300">
                                  {u.last_login_at
                                    ? new Date(u.last_login_at).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })
                                    : "Never"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Joined</p>
                                <p className="text-stone-300">
                                  {new Date(u.created_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                            </div>

                            {/* Booking Link */}
                            <div className="mt-3">
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                                Booking Link
                              </p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
                                  <p className="truncate font-mono text-[11px] text-blue-400">
                                    {u.booking_link}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleCopyBookingLink(u.booking_link, u.id)}
                                  className="flex-shrink-0 rounded-lg bg-slate-700 p-2 text-stone-400 transition-colors hover:bg-slate-600 hover:text-white"
                                >
                                  {copiedLink === u.id ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <a
                                  href={u.booking_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0 rounded-lg bg-slate-700 p-2 text-stone-400 transition-colors hover:bg-slate-600 hover:text-white"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>

                            {/* Trial-expired soft lock banner */}
                            {u.trial_expired && (
                              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                                <p className="text-xs font-semibold text-amber-300">
                                  Pro trial expired — no active subscription
                                </p>
                                <p className="mt-0.5 text-[10px] text-stone-400">
                                  Their booking link falls back to generic platform branding (no logo, no custom pricing).
                                  They need to subscribe or have their trial extended to re-enable their branded page.
                                </p>
                              </div>
                            )}

                            {/* Account Lock Toggle */}
                            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Ban className="h-3.5 w-3.5 text-stone-500" />
                                <div>
                                  <p className="text-xs font-semibold text-stone-300">
                                    Account Lock
                                  </p>
                                  <p className="text-[10px] text-stone-500">
                                    {u.is_suspended
                                      ? u.suspension_reason === "payment"
                                        ? "Locked — subscription payment issue"
                                        : "Locked — manual admin hold"
                                      : "Account is active"}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleToggleSuspension(u)}
                                disabled={suspendingUser === u.id}
                                className="p-1 transition-colors hover:opacity-80 disabled:opacity-40"
                                title={u.is_suspended ? "Unlock account" : "Lock account"}
                              >
                                {suspendingUser === u.id ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-stone-500" />
                                ) : u.is_suspended ? (
                                  <ToggleRight className="h-6 w-6 text-red-400" />
                                ) : (
                                  <ToggleLeft className="h-6 w-6 text-stone-500" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ADMIN: Network Referral Bounties (admin only)
        ═══════════════════════════════════════════════════════════════ */}
        {isAdmin && (
          <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-amber-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Network Referral Bounties
                </h2>
              </div>
              {bountyTotals && (
                <div className="flex gap-2 text-[10px] font-bold">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                    ${bountyTotals.totalPaid.toFixed(2)} Paid
                  </span>
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-400">
                    ~${bountyTotals.totalPending.toFixed(2)} Pending
                  </span>
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-stone-400">
                    {bountyTotals.totalReferrals} Total
                  </span>
                </div>
              )}
            </div>

            {/* KPI row */}
            {bountyTotals && (
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <p className="text-lg font-black text-emerald-400">${bountyTotals.totalPaid.toFixed(2)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Total Paid</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                  <p className="text-lg font-black text-amber-400">~${bountyTotals.totalPending.toFixed(2)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Est. Pending</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-center">
                  <p className="text-lg font-black text-white">{bountyTotals.totalReferrals}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Total Referrals</p>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
              <input
                type="text"
                placeholder="Search referrer by name or business..."
                value={bountySearch}
                onChange={(e) => setBountySearch(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-stone-500 focus:border-amber-400/50 focus:outline-none"
              />
            </div>

            {bountyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              </div>
            ) : bountyReferrers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 py-12 text-center">
                <Banknote className="mx-auto mb-3 h-8 w-8 text-stone-600" />
                <p className="text-sm font-medium text-stone-400">No referral bounties yet</p>
                <p className="mt-1 text-xs text-stone-600">Bounties appear when installers refer out-of-area customers.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bountyReferrers
                  .filter((r) => {
                    if (!bountySearch) return true;
                    const q = bountySearch.toLowerCase();
                    return (
                      r.name.toLowerCase().includes(q) ||
                      (r.business?.toLowerCase().includes(q))
                    );
                  })
                  .map((referrer) => {
                    const isExpanded = expandedReferrer === referrer.installer_id;

                    return (
                      <div
                        key={referrer.installer_id}
                        className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50"
                      >
                        {/* Row header */}
                        <button
                          onClick={() => setExpandedReferrer(isExpanded ? null : referrer.installer_id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-white">
                                {referrer.name}
                              </p>
                              {referrer.is_pro ? (
                                <span className="flex-shrink-0 rounded bg-yellow-400/10 px-1.5 py-0.5 text-[9px] font-bold text-yellow-400">
                                  PRO
                                </span>
                              ) : (
                                <span className="flex-shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-stone-400">
                                  FREE
                                </span>
                              )}
                            </div>
                            {referrer.business && (
                              <p className="truncate text-[11px] text-stone-500">{referrer.business}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className="text-xs font-bold text-emerald-400">
                                ${referrer.total_earned.toFixed(2)}
                              </p>
                              <p className="text-[10px] text-stone-500">earned</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-amber-400">
                                {referrer.pending_count}
                              </p>
                              <p className="text-[10px] text-stone-500">pending</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-stone-300">
                                {referrer.total_referrals}
                              </p>
                              <p className="text-[10px] text-stone-500">total</p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-stone-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-stone-500" />
                            )}
                          </div>
                        </button>

                        {/* Expanded: individual leads */}
                        {isExpanded && (
                          <div className="border-t border-slate-700 bg-slate-900/50">
                            {/* Summary stats */}
                            <div className="grid grid-cols-4 gap-2 border-b border-slate-700/50 px-4 py-3">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Paid</p>
                                <p className="text-sm font-bold text-emerald-400">{referrer.paid_count}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Pending</p>
                                <p className="text-sm font-bold text-amber-400">{referrer.pending_count}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Total Earned</p>
                                <p className="text-sm font-bold text-emerald-400">${referrer.total_earned.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Est. Pending</p>
                                <p className="text-sm font-bold text-amber-400">~${referrer.total_pending_value.toFixed(2)}</p>
                              </div>
                            </div>

                            {/* Lead table header */}
                            <div className="grid grid-cols-12 gap-1 border-b border-slate-700/50 bg-slate-800/30 px-4 py-2">
                              <span className="col-span-3 text-[9px] font-bold uppercase tracking-widest text-stone-500">Assigned To</span>
                              <span className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-stone-500">Location</span>
                              <span className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-stone-500">Deposit</span>
                              <span className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-stone-500">Bounty</span>
                              <span className="col-span-1 text-[9px] font-bold uppercase tracking-widest text-stone-500">Status</span>
                              <span className="col-span-2 text-right text-[9px] font-bold uppercase tracking-widest text-stone-500">Date</span>
                            </div>

                            {/* Lead rows */}
                            {referrer.leads.map((lead) => (
                              <div
                                key={lead.id}
                                className="grid grid-cols-12 items-center gap-1 border-b border-slate-800/50 px-4 py-2.5 last:border-0"
                              >
                                <div className="col-span-3 min-w-0">
                                  <p className="truncate text-xs font-medium text-stone-300">
                                    {lead.installer_name}
                                  </p>
                                  {lead.installer_business && (
                                    <p className="truncate text-[10px] text-stone-500">{lead.installer_business}</p>
                                  )}
                                </div>
                                <div className="col-span-2">
                                  <p className="flex items-center gap-1 text-[11px] text-stone-400">
                                    <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                                    {[lead.customer_city, lead.customer_state].filter(Boolean).join(", ") || "—"}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <p className={`text-xs font-mono ${lead.deposit_paid ? "text-emerald-400" : "text-stone-400"}`}>
                                    ${lead.deposit_amount.toFixed(2)}
                                  </p>
                                  <p className="text-[10px] text-stone-500">
                                    {lead.deposit_paid ? "Paid" : "Unpaid"}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <p className={`text-xs font-mono font-bold ${
                                    lead.bounty_status === "paid"
                                      ? "text-emerald-400"
                                      : lead.bounty_status === "pending"
                                      ? "text-amber-400"
                                      : "text-stone-500"
                                  }`}>
                                    {lead.bounty_status === "paid" && lead.bounty_amount != null
                                      ? `$${lead.bounty_amount.toFixed(2)}`
                                      : lead.bounty_status === "pending"
                                      ? `~$${Math.max(15, lead.deposit_amount * 0.3).toFixed(2)}`
                                      : "—"}
                                  </p>
                                </div>
                                <div className="col-span-1">
                                  <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                    lead.bounty_status === "paid"
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : lead.bounty_status === "pending"
                                      ? "bg-amber-500/10 text-amber-400"
                                      : "bg-slate-700 text-stone-400"
                                  }`}>
                                    {lead.bounty_status}
                                  </span>
                                </div>
                                <div className="col-span-2 text-right">
                                  <p className="flex items-center justify-end gap-1 text-[11px] text-stone-500">
                                    <Clock className="h-2.5 w-2.5" />
                                    {new Date(lead.created_at).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "2-digit",
                                    })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        )}

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
