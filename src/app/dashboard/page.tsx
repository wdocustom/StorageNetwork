"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { siteConfig } from "@/config/site";
import { checkProTrial, type TrialStatus } from "@/app/actions/pro-trial";
import { stampLastLogin } from "@/app/actions/profile";
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
  DollarSign,
  Trophy,
  Megaphone,
  CalendarOff,
  BarChart3,
  Users,
  Activity,
  Gift,
} from "lucide-react";
import SetupChecklist from "@/components/dashboard/SetupChecklist";
import ActionNudge from "@/components/dashboard/ActionNudge";
import LiveLeaderboard from "@/components/dashboard/LiveLeaderboard";
import NetworkPassiveIncome from "@/components/dashboard/NetworkPassiveIncome";
import PromoBanner from "@/components/dashboard/PromoBanner";
import ProPill from "@/components/dashboard/ProPill";
import { getInstallerLink } from "@/lib/utils";

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  business_name: string | null;
  is_pro: boolean;
  is_admin?: boolean;
  subscription_tier?: string;
  stripe_account_id?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
}

export default function DashboardPage() {
  const supabase = getSupabaseBrowserClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [hasRecentPosts, setHasRecentPosts] = useState(false);
  const [totalSales, setTotalSales] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    stampLastLogin(user.id);

    checkProTrial(user.id).then((status) => {
      setTrialStatus(status);
      if (status.trialExpired && !status.softLocked && profile?.is_pro) {
        supabase.from("profiles").select("is_pro").eq("id", user.id).single().then(({ data }) => {
          if (data && !data.is_pro && profile) {
            setProfile({ ...profile, is_pro: false });
          }
        });
      }
    });

    const [profileRes, leadsRes, paidLeadsRes, recentPostsRes] = await Promise.all([
      supabase.from("profiles").select("id, email, first_name, business_name, is_pro, is_admin, subscription_tier, stripe_account_id, slug, city, state").eq("id", user.id).single(),
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
      supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    if (profileRes.error) {
      console.error("[Dashboard] Profile query failed:", profileRes.error.message, profileRes.error.code);
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr) {
        const retry = await supabase.from("profiles").select("id, email, first_name, business_name, is_pro, is_admin, subscription_tier, stripe_account_id, slug, city, state").eq("id", user.id).single();
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
    if (recentPostsRes.count && recentPostsRes.count > 0) setHasRecentPosts(true);

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
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  const hasStripe = !!profile?.stripe_account_id;
  const welcomeName = profile?.business_name || profile?.first_name || "Partner";
  const leadLink = profile ? getInstallerLink(profile) : "";

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between md:max-w-3xl lg:max-w-4xl">
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
        <div className="mx-auto flex max-w-lg items-center justify-center gap-4 md:max-w-3xl lg:max-w-4xl">
          <div className="flex items-center gap-1.5">
            {trialStatus?.onTrial ? (
              <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${trialStatus.jobCapReached ? "bg-amber-400/15 text-amber-400" : "bg-purple-400/15 text-purple-400"}`}>
                {trialStatus.jobCapReached ? "TRIAL · JOB CAP REACHED" : `TRIAL · ${trialStatus.jobsRemaining} ${trialStatus.jobsRemaining === 1 ? "JOB" : "JOBS"} TO GO`}
              </span>
            ) : (
              <ProPill link={leadLink} />
            )}
          </div>

          <div className="h-3 w-px bg-slate-700" />

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

      {/* ── Conditional Banners ────────────────────────────────────── */}
      {!hasStripe && (
        <div className="shrink-0 border-b border-amber-400/20 bg-amber-400/5 px-4 py-2.5">
          <div className="mx-auto flex max-w-lg items-center justify-between md:max-w-3xl lg:max-w-4xl">
            <p className="text-xs text-amber-300">
              <span className="font-bold">Complete your profile</span> to get
              paid &mdash; connect Stripe in{" "}
              <a href="/dashboard/profile" className="font-bold underline hover:text-amber-200">Settings</a>.
            </p>
          </div>
        </div>
      )}

      {profile && (!profile.city || !profile.state) && (
        <div className="shrink-0 border-b border-red-400/20 bg-red-400/5 px-4 py-2.5">
          <div className="mx-auto flex max-w-lg items-center justify-between md:max-w-3xl lg:max-w-4xl">
            <p className="text-xs text-red-300">
              <span className="font-bold">Incomplete Profile:</span> City & State are required.{" "}
              <a href="/dashboard/profile" className="font-bold underline hover:text-red-200">Update now</a>.
            </p>
          </div>
        </div>
      )}

      {trialStatus?.onTrial && !trialStatus?.jobCapReached && (
        <div className="shrink-0 border-b border-purple-400/20 bg-purple-400/5 px-4 py-3">
          <div className="mx-auto max-w-lg text-center md:max-w-3xl lg:max-w-4xl">
            <p className="text-sm font-bold text-purple-300">
              Pro Trial{trialStatus.partnerName ? ` — courtesy of ${trialStatus.partnerName}` : ""}
            </p>
            <p className="text-xs text-purple-400/70 mt-0.5">
              {trialStatus.jobsRemaining} trial {trialStatus.jobsRemaining === 1 ? "job" : "jobs"} remaining ·{" "}
              <a href="/upgrade" className="font-bold underline hover:text-purple-200">Subscribe anytime</a>
            </p>
          </div>
        </div>
      )}

      {trialStatus?.onTrial && trialStatus?.jobCapReached && (
        <div className="shrink-0 border-b border-amber-400/20 bg-amber-400/5 px-4 py-3">
          <div className="mx-auto max-w-lg text-center md:max-w-3xl lg:max-w-4xl">
            <p className="text-sm font-bold text-amber-300">
              All 3 trial jobs used — subscribe to accept new bookings
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Your existing jobs and dashboard are unaffected ·{" "}
              <a href="/upgrade" className="font-bold underline hover:text-amber-200">Subscribe Now</a>
            </p>
          </div>
        </div>
      )}

      {trialStatus?.softLocked && (
        <div className="shrink-0 border-b border-amber-400/20 bg-amber-400/5 px-4 py-3">
          <div className="mx-auto max-w-lg text-center md:max-w-3xl lg:max-w-4xl">
            <p className="text-sm font-bold text-amber-300">
              Your trial has ended — finish your {trialStatus.activeJobsCount} active {trialStatus.activeJobsCount === 1 ? "job" : "jobs"}
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              New bookings are paused. Subscribe to keep your account fully active ·{" "}
              <a href="/upgrade" className="font-bold underline hover:text-amber-200">Subscribe Now</a>
            </p>
          </div>
        </div>
      )}

      {trialStatus?.trialExpired && !trialStatus?.softLocked && (
        <div className="shrink-0 border-b border-red-400/20 bg-red-400/5 px-4 py-3">
          <div className="mx-auto max-w-lg text-center md:max-w-3xl lg:max-w-4xl">
            <p className="text-sm font-bold text-red-300">
              Your trial has ended
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">
              Subscribe to reactivate your account, portfolio, and booking links ·{" "}
              <a href="/upgrade" className="font-bold underline hover:text-red-200">Subscribe Now</a>
            </p>
          </div>
        </div>
      )}

      {/* ── Main Content ────────────────────────────────────────────── */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-lg space-y-4 md:max-w-3xl lg:max-w-4xl">

          {/* ── Promo Banner (inline, dismissible) ─────────────────── */}
          <PromoBanner
            isPro={profile?.is_pro}
            isTrialActive={trialStatus?.onTrial}
            hasStripeConnected={!!profile?.stripe_account_id}
          />

          {/* ── Setup Checklist (self-hides when complete) ─────────── */}
          {profile && (
            <SetupChecklist userId={profile.id} bookingLink={leadLink} />
          )}

          {/* ── Stats Strip ────────────────────────────────────────── */}
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
            <div className="flex flex-1 items-center justify-around">
              <div className="text-center">
                <p className="text-lg font-black text-white">${totalSales.toLocaleString()}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Revenue</p>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="text-center">
                <p className="text-lg font-black text-white">{completedCount}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Jobs Done</p>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="text-center">
                <p className="text-lg font-black text-white">{newLeadCount}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">New Leads</p>
              </div>
            </div>
            <a
              href="/dashboard/sales"
              className="ml-3 shrink-0 rounded-lg p-2 text-stone-600 transition-colors hover:bg-slate-800 hover:text-yellow-400"
              title="Sales details"
            >
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          {/* ── Tier 1: Primary Actions ────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Jobs / Leads */}
            <a
              href="/dashboard/leads"
              className="group relative flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400 transition-colors group-hover:bg-yellow-400/20">
                <Briefcase className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-white">Jobs / Leads</h2>
                <p className="text-sm text-stone-500">View incoming work orders</p>
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

            {/* Create Quote */}
            <a
              href="/dashboard/build"
              className="group relative flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 transition-colors group-hover:bg-blue-500/20">
                <HardHat className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-white">Create Quote</h2>
                <p className="text-sm text-stone-500">Manual entry & price estimation</p>
              </div>
              <ChevronRight className="h-5 w-5 text-stone-600 transition-colors group-hover:text-yellow-400" />
            </a>

            {/* Marketing */}
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
          </div>

          {/* ── Action Nudge (contextual coaching) ─────────────────── */}
          {profile && <ActionNudge userId={profile.id} />}

          {/* ── Tier 2: Secondary Tools ────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {/* Analytics */}
            <a
              href="/dashboard/analytics"
              className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 transition-colors group-hover:bg-purple-500/20">
                <BarChart3 className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-white">Analytics</span>
            </a>

            {/* Schedule */}
            <a
              href="/dashboard/schedule"
              className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 transition-colors group-hover:bg-red-500/20">
                <CalendarOff className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-white">Schedule</span>
            </a>

            {/* Community */}
            <a
              href="/community"
              className="group relative flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 via-slate-900 to-slate-900 p-4 transition-all hover:border-yellow-400/50 hover:from-yellow-500/10 active:scale-[0.98]"
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400 transition-colors group-hover:bg-yellow-400/20">
                <Users className="h-5 w-5" />
                {hasRecentPosts && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                  </span>
                )}
              </div>
              <span className="text-sm font-bold text-white">Community</span>
            </a>

            {/* Plans & Guides */}
            <a
              href="/dashboard/guides"
              className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 transition-colors group-hover:bg-emerald-500/20">
                <BookOpen className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-white">Guides</span>
            </a>

            {/* Tote Rentals — closing-gift fulfillment */}
            <a
              href="/dashboard/tote-rentals"
              className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 transition-colors group-hover:bg-amber-500/20">
                <Gift className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-white">Tote Rentals</span>
            </a>
          </div>

          {/* ── Platform Analytics (admin-only) ────────────────────── */}
          {profile?.is_admin && (
            <a
              href="/dashboard/platform-analytics"
              className="group flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 via-slate-900 to-slate-900 p-4 transition-all hover:border-cyan-400/50 hover:from-cyan-500/10 active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 transition-colors group-hover:bg-cyan-500/20">
                <Activity className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-white">Platform Analytics</span>
              <span className="ml-auto rounded bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-cyan-400">
                Admin
              </span>
            </a>
          )}

          {/* ── Leaderboard ────────────────────────────────────────── */}
          {profile && <LiveLeaderboard userId={profile.id} />}

          {/* ── Network Passive Income ─────────────────────────────── */}
          {profile && <NetworkPassiveIncome userId={profile.id} />}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-slate-800 px-4 py-3 text-center text-[10px] text-stone-700">
        {siteConfig.name} &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
