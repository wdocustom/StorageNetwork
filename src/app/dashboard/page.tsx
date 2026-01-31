"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { siteConfig } from "@/config/site";
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
} from "lucide-react";

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

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const [profileRes, leadsRes, paidLeadsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("installer_id", user.id)
        .eq("status", "new"),
      supabase
        .from("leads")
        .select("estimated_price, balance_due, payout_status")
        .eq("installer_id", user.id)
        .in("payout_status", ["paid"]),
    ]);

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

  const tier = profile?.subscription_tier || (profile?.is_pro ? "pro" : "free");
  const hasStripe = !!profile?.stripe_account_id;

  // Dynamic welcome name
  const welcomeName = profile?.business_name || profile?.first_name || "Partner";

  // Links
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const leadLink = `${baseUrl}/design?installer_id=${profile?.id}`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={siteConfig.logoPath}
              alt={siteConfig.name}
              className="h-10 w-10"
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
