"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { siteConfig } from "@/config/site";
import { checkProTrial, type TrialStatus } from "@/app/actions/pro-trial";
import {
  Briefcase,
  HardHat,
  BookOpen,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Settings,
  Copy,
  Check,
  Link2,
  DollarSign,
  Package,
  Trophy,
  Megaphone,
  CalendarOff,
  BarChart3,
  Users,
  Zap,
} from "lucide-react";
import MissionBriefing from "@/components/dashboard/MissionBriefing";
import NetworkPassiveIncome from "@/components/dashboard/NetworkPassiveIncome";
import { getInstallerLink } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  business_name: string | null;
  is_pro: boolean;
  subscription_tier?: string;
  stripe_account_id?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard — Mobile-First Tile Grid
// ═══════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const supabase = getSupabaseBrowserClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Check and enforce Pro trial expiry (runs on every dashboard load)
    checkProTrial(user.id).then((status) => {
      setTrialStatus(status);
      // If trial just expired, the server action already reverted is_pro.
      // Reload profile to reflect the change.
      if (!status.onTrial && profile?.is_pro) {
        supabase.from("profiles").select("is_pro").eq("id", user.id).single().then(({ data }) => {
          if (data && !data.is_pro && profile) {
            setProfile({ ...profile, is_pro: false });
          }
        });
      }
    });

    const [profileRes, leadsRes, paidLeadsRes] = await Promise.all([
      supabase.from("profiles").select("id, email, first_name, business_name, is_pro, subscription_tier, stripe_account_id, slug, city, state").eq("id", user.id).single(),
      // Only count leads with deposit paid (exclude unpaid quotes)
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("installer_id", user.id)
        .eq("deposit_paid", true)
        .in("status", ["new", "open"]),
      supabase
        .from("leads")
        .select("estimated_price, balance_due, payout_status")
        .eq("installer_id", user.id)
        .in("payout_status", ["paid"]),
    ]);

    if (profileRes.error) {
      console.error("[Dashboard] Profile query failed:", profileRes.error.message, profileRes.error.code);
      // Retry once after refreshing session
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr) {
        const retry = await supabase.from("profiles").select("id, email, first_name, business_name, is_pro, subscription_tier, stripe_account_id, slug, city, state").eq("id", user.id).single();
        if (retry.data) {
          console.log("[Dashboard] Retry succeeded after session refresh");
          setProfile(retry.data as Profile);
        } else if (retry.error) {
          console.error("[Dashboard] Retry also failed:", retry.error.message);
        }
      }
    }

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (leadsRes.count !== null) setNewLeadCount(leadsRes.count);

    // Aggregate sales from paid jobs
    if (paidLeadsRes.data) {
      const sales = paidLeadsRes.data.reduce(
        (sum: number, l: { balance_due: number | null }) => sum + (l.balance_due || 0),
        0
      );
      setTotalSales(Math.round(sales));
      setCompletedCount(paidLeadsRes.data.length);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function copyToClipboard(link: string, linkType: string) {
    navigator.clipboard.writeText(link);
    setCopiedLink(linkType);
    setTimeout(() => setCopiedLink(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  // is_pro is the DB source of truth — subscription_tier can be stale/cached
  const tier = profile?.is_pro ? "pro" : (profile?.subscription_tier === "pro" ? "pro" : "free");
  const hasStripe = !!profile?.stripe_account_id;

  // Dynamic welcome name
  const welcomeName = profile?.business_name || profile?.first_name || "Partner";

  // Links — uses slug (Pro) or UUID (Basic) automatically
  const leadLink = profile ? getInstallerLink(profile) : "";

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={siteConfig.logoPath}
              alt={siteConfig.name}
              width={56}
              height={56}
              className="h-14 w-auto flex-shrink-0 object-contain"
            />
            <div>
              <h1 className="text-sm font-bold uppercase tracking-wider text-white">
                Welcome, {welcomeName}
              </h1>
              <p className="text-[11px] text-stone-500">
                {siteConfig.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="/dashboard/profile"
              className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </a>
            <button
              onClick={handleSignOut}
              className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Status Bar ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-800 bg-slate-900/50 px-4 py-2.5">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-4">
          {/* Plan Status */}
          <div className="flex items-center gap-1.5">
            {tier === "pro" && trialStatus?.onTrial ? (
              <span className="rounded bg-purple-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-purple-400">
                PRO TRIAL · {trialStatus.daysRemaining}D LEFT
              </span>
            ) : tier === "pro" ? (
              <span className="rounded bg-yellow-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-yellow-400">
                PRO PLAN
              </span>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-stone-600" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Free Plan
                </span>
              </>
            )}
          </div>

          <div className="h-3 w-px bg-slate-700" />

          {/* Stripe Status */}
          <div className="flex items-center gap-1.5">
            {hasStripe ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            ) : (
              <AlertCircle className="h-3 w-3 text-amber-400" />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              {hasStripe ? (
                <span className="text-emerald-400">Stripe Connected</span>
              ) : (
                <span className="text-amber-400">Stripe Pending</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stripe Profile Banner ─────────────────────────────────── */}
      {!hasStripe && (
        <div className="shrink-0 border-b border-amber-400/20 bg-amber-400/5 px-4 py-2.5">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <p className="text-xs text-amber-300">
              <span className="font-bold">Complete your profile</span> to get
              paid &mdash; connect Stripe in{" "}
              <a
                href="/dashboard/profile"
                className="font-bold underline hover:text-amber-200"
              >
                Settings
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {/* ── Incomplete Profile Banner ──────────────────────────────── */}
      {profile && (!profile.city || !profile.state) && (
        <div className="shrink-0 border-b border-red-400/20 bg-red-400/5 px-4 py-2.5">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <p className="text-xs text-red-300">
              <span className="font-bold">Incomplete Profile:</span> City & State are required.{" "}
              <a
                href="/dashboard/profile"
                className="font-bold underline hover:text-red-200"
              >
                Update now
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {/* ── Pro Trial Banner ──────────────────────────────────────── */}
      {trialStatus?.onTrial && (
        <div className="shrink-0 border-b border-purple-400/20 bg-purple-400/5 px-4 py-3">
          <div className="mx-auto max-w-lg text-center">
            <p className="text-sm font-bold text-purple-300">
              7-Day Pro Trial{trialStatus.partnerName ? ` — courtesy of ${trialStatus.partnerName}` : ""}
            </p>
            <p className="text-xs text-purple-400/70 mt-0.5">
              {trialStatus.daysRemaining} {trialStatus.daysRemaining === 1 ? "day" : "days"} remaining · All Pro features unlocked ·{" "}
              <a
                href="/dashboard/profile"
                className="font-bold underline hover:text-purple-200"
              >
                Subscribe to keep Pro
              </a>
            </p>
          </div>
        </div>
      )}

      {/* ── Tile Grid ───────────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="mx-auto grid w-full max-w-lg gap-4">
          {/* ── Mission Briefing (new installers only) ────────────── */}
          {completedCount === 0 && profile && (
            <MissionBriefing userId={profile.id} slug={profile.slug} isPro={profile.is_pro} />
          )}

          {/* ── Sales Stats Bar ─────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
              <DollarSign className="mx-auto mb-1 h-5 w-5 text-yellow-400" />
              <p className="text-xl font-black text-white">
                ${totalSales.toLocaleString()}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                Total Sales
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
              <Trophy className="mx-auto mb-1 h-5 w-5 text-emerald-400" />
              <p className="text-xl font-black text-white">
                {completedCount}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                Jobs Done
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
              <Package className="mx-auto mb-1 h-5 w-5 text-blue-400" />
              <p className="text-xl font-black text-white">
                {newLeadCount}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                New Leads
              </p>
            </div>
          </div>

          {/* ── Network Passive Income ─────────────────────────────── */}
          {profile && <NetworkPassiveIncome userId={profile.id} />}

          {/* JOBS / LEADS Tile */}
          <a
            href="/dashboard/leads"
            className="group relative flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400 transition-colors group-hover:bg-yellow-400/20">
              <Briefcase className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">Jobs / Leads</h2>
              <p className="text-sm text-stone-500">
                View incoming work orders
              </p>
            </div>
            <div className="flex items-center gap-2">
              {newLeadCount > 0 && (
                <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white">
                  {newLeadCount}
                </span>
              )}
              <ChevronRight className="h-5 w-5 text-stone-600 transition-colors group-hover:text-yellow-400" />
            </div>
          </a>

          {/* CREATE QUOTE Tile */}
          <a
            href="/dashboard/build"
            className="group relative flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 transition-colors group-hover:bg-blue-500/20">
              <HardHat className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">CREATE QUOTE</h2>
              <p className="text-sm text-stone-500">Manual entry & price estimation</p>
            </div>
            <ChevronRight className="h-5 w-5 text-stone-600 transition-colors group-hover:text-yellow-400" />
          </a>

          {/* MARKETING Tile */}
          <a
            href="/dashboard/marketing"
            className="group relative flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 transition-colors group-hover:bg-amber-500/20">
              <Megaphone className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">Marketing</h2>
              <p className="text-sm text-stone-500">Your link & social tools</p>
            </div>
            <ChevronRight className="h-5 w-5 text-stone-600 transition-colors group-hover:text-yellow-400" />
          </a>

          {/* PRO COMMUNITY Tile */}
          <a
            href={tier === "pro" ? "/community" : "/community/upgrade"}
            className={`group relative flex items-center gap-5 rounded-2xl border p-6 transition-all active:scale-[0.98] ${
              tier === "pro"
                ? "border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 via-slate-900 to-slate-900 hover:border-yellow-400/50 hover:from-yellow-500/10"
                : "border-slate-800 bg-slate-900 hover:border-yellow-400/30 hover:bg-slate-800"
            }`}
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400 transition-colors group-hover:bg-yellow-400/20">
              <Users className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Community</h2>
                <span className="rounded bg-yellow-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-yellow-400">
                  PRO
                </span>
              </div>
              <p className="text-sm text-stone-500">
                {tier === "pro"
                  ? "Discuss, share builds & get advice"
                  : "Upgrade to join the Pro community"}
              </p>
            </div>
            {tier === "pro" ? (
              <ChevronRight className="h-5 w-5 text-stone-600 transition-colors group-hover:text-yellow-400" />
            ) : (
              <Zap className="h-5 w-5 text-yellow-400/50" />
            )}
          </a>

          {/* ANALYTICS Tile */}
          <a
            href="/dashboard/analytics"
            className="group relative flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 transition-colors group-hover:bg-purple-500/20">
              <BarChart3 className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">Analytics</h2>
              <p className="text-sm text-stone-500">Views, conversions & traffic</p>
            </div>
            <ChevronRight className="h-5 w-5 text-stone-600 transition-colors group-hover:text-yellow-400" />
          </a>

          {/* Schedule Settings */}
          <a
            href="/dashboard/schedule"
            className="group relative flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 transition-colors group-hover:bg-red-500/20">
              <CalendarOff className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">Schedule</h2>
              <p className="text-sm text-stone-500">Blackout dates & availability</p>
            </div>
            <ChevronRight className="h-5 w-5 text-stone-600 transition-colors group-hover:text-yellow-400" />
          </a>

          {/* PLANS & GUIDES Tile */}
          <a
            href="/dashboard/guides"
            className="group relative flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 transition-colors group-hover:bg-emerald-500/20">
              <BookOpen className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">Plans & Guides</h2>
              <p className="text-sm text-stone-500">Training Library</p>
            </div>
            <ChevronRight className="h-5 w-5 text-stone-600 transition-colors group-hover:text-yellow-400" />
          </a>

          {/* Your Links Section */}
          {profile && (
            <div className="space-y-3">
              {/* Lead/Affiliate Link */}
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="h-3 w-3 text-blue-400" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-600">
                      My Lead Link
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(leadLink, "lead")}
                    className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-slate-600"
                  >
                    {copiedLink === "lead" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="select-all break-all text-sm font-medium text-blue-400">
                  {leadLink}
                </p>
                <p className="mt-2 text-[11px] text-stone-600">
                  Share anywhere — tracks leads for 30 days via cookie.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-slate-800 px-4 py-3 text-center text-[10px] text-stone-700">
        {siteConfig.name} &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
