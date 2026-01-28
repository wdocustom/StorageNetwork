"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  Briefcase,
  Calculator,
  BookOpen,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Settings,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface Profile {
  id: string;
  email: string;
  business_name: string | null;
  is_pro: boolean;
  subscription_tier?: string;
  stripe_account_id?: string | null;
  slug?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard — Mobile-First Tile Grid
// ═══════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const supabase = getSupabaseBrowserClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const [profileRes, leadsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("installer_id", user.id)
        .eq("status", "new"),
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (leadsRes.count !== null) setNewLeadCount(leadsRes.count);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  const tier = profile?.subscription_tier || (profile?.is_pro ? "pro" : "free");
  const hasStripe = !!profile?.stripe_account_id;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="The Shelf Dude"
              className="h-10 w-10"
            />
            <div>
              <h1 className="text-sm font-bold uppercase tracking-wider text-white">
                Partner Network
              </h1>
              <p className="text-[11px] text-stone-500">
                {profile?.business_name ?? profile?.email}
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
          {/* Pro Status */}
          <div className="flex items-center gap-1.5">
            <div
              className={`h-2 w-2 rounded-full ${
                tier === "pro" ? "bg-yellow-400" : "bg-stone-600"
              }`}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              {tier === "pro" ? (
                <span className="text-yellow-400">Pro Active</span>
              ) : (
                "Free Plan"
              )}
            </span>
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

      {/* ── Tile Grid ───────────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="mx-auto grid w-full max-w-lg gap-4">
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

          {/* CALCULATOR Tile */}
          <a
            href="/dashboard/calculator"
            className="group relative flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-yellow-400/30 hover:bg-slate-800 active:scale-[0.98]"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 transition-colors group-hover:bg-blue-500/20">
              <Calculator className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">Calculator</h2>
              <p className="text-sm text-stone-500">Quick Quote Tool</p>
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

          {/* Share Your Booking Link */}
          {profile && (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-4 text-center">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-stone-600">
                Your Booking Link
              </p>
              <p className="select-all break-all text-sm font-medium text-yellow-400">
                {typeof window !== "undefined" ? window.location.origin : ""}/book/{profile.slug || profile.id}
              </p>
              <p className="mt-2 text-[11px] text-stone-600">
                Share with your own clients — deposits go directly to your
                Stripe account.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-slate-800 px-4 py-3 text-center text-[10px] text-stone-700">
        The Shelf Dude Partner Network &copy;{" "}
        {new Date().getFullYear()} WDO Custom
      </footer>
    </div>
  );
}
