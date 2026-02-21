"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  ArrowLeft,
  DollarSign,
  Loader2,
  CheckCircle2,
  Clock,
  MapPin,
  Zap,
  ArrowRight,
  Share2,
  Globe,
  Wallet,
  TrendingUp,
  Lock,
} from "lucide-react";
import { createProCheckoutSession } from "@/app/actions/pro-subscription";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface ReferralItem {
  id: string;
  bounty_status: string;
  bounty_amount: number | null;
  deposit_amount: number | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  estimated_price: number | null;
  created_at: string;
  deposit_paid: boolean;
  // The installer who received the job
  installer_id: string | null;
  installer_profile?: {
    business_name: string | null;
    city: string | null;
    state: string | null;
  } | null;
}

/** Estimate the bounty for a pending referral: 30% of deposit, min $15 */
function estimateBounty(ref: ReferralItem): number {
  if (ref.bounty_status === "paid" && typeof ref.bounty_amount === "number") {
    return ref.bounty_amount;
  }
  const deposit = ref.deposit_amount ?? (ref.estimated_price ? ref.estimated_price * 0.15 : 0);
  return Math.max(Math.round(deposit * 0.30 * 100) / 100, 15);
}

// ═══════════════════════════════════════════════════════════════════════════
// Referrals Page — Shows all leads this installer referred
// ═══════════════════════════════════════════════════════════════════════════

export default function ReferralsPage() {
  const supabase = getSupabaseBrowserClient();
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [userId, setUserId] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");

  const fetchReferrals = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    setUserId(user.id);

    // Check Pro status
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", user.id)
      .single();

    setIsPro(!!profile?.is_pro);

    const { data } = await supabase
      .from("leads")
      .select(
        "id, bounty_status, bounty_amount, deposit_amount, address_city, address_state, address_zip, estimated_price, created_at, deposit_paid, installer_id"
      )
      .eq("referring_installer_id", user.id)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      // Fetch installer profiles for each referral
      const installerIds = Array.from(new Set(data.map((r) => r.installer_id).filter(Boolean))) as string[];
      let profileMap: Record<string, { business_name: string | null; city: string | null; state: string | null }> = {};

      if (installerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, business_name, city, state")
          .in("id", installerIds);

        if (profiles) {
          profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
        }
      }

      const enriched = data.map((r) => ({
        ...r,
        installer_profile: r.installer_id ? profileMap[r.installer_id] || null : null,
      }));

      setReferrals(enriched as ReferralItem[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  async function handleUpgrade() {
    setUpgradeLoading(true);
    setUpgradeError("");
    const result = await createProCheckoutSession(userId);
    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setUpgradeError(result.error || "Failed to start checkout");
      setUpgradeLoading(false);
    }
  }

  const paidReferrals = referrals.filter((r) => r.bounty_status === "paid");
  const pendingCount = referrals.filter((r) => r.bounty_status === "pending").length;
  const totalEarnings = paidReferrals.reduce(
    (sum, r) => sum + (typeof r.bounty_amount === "number" ? r.bounty_amount : 15),
    0
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <a
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-stone-400 hover:text-yellow-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold uppercase tracking-wider text-white">
                Network Referrals
              </h1>
              <span className="rounded bg-yellow-400/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-yellow-400">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-stone-500">
              {referrals.length} total referral{referrals.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </header>

      {/* ── Summary Stats ──────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-4">
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-3">
          <div className="rounded-xl border border-yellow-400/20 bg-slate-900 p-3 text-center">
            <DollarSign className="mx-auto mb-1 h-4 w-4 text-yellow-400" />
            <p className="text-lg font-black text-yellow-400">
              ${Math.round(totalEarnings * 100 / 100).toLocaleString()}
            </p>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">
              Earned
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
            <CheckCircle2 className="mx-auto mb-1 h-4 w-4 text-emerald-400" />
            <p className="text-lg font-black text-white">{paidReferrals.length}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">
              Paid
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
            <Clock className="mx-auto mb-1 h-4 w-4 text-amber-400" />
            <p className="text-lg font-black text-white">{pendingCount}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">
              Pending
            </p>
          </div>
        </div>
      </div>

      {/* ── How It Works ───────────────────────────────────────────── */}
      <div className="border-b border-slate-800 px-4 py-5">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400">
            How Network Bounties Work
          </h2>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400/10 text-[10px] font-bold text-yellow-400">
                1
              </div>
              <p className="text-xs leading-relaxed text-stone-400">
                <span className="text-stone-200">You share your link</span> — on social media, your website, TikTok, anywhere. Your link works nationwide, not just in your service area.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400/10 text-[10px] font-bold text-yellow-400">
                2
              </div>
              <p className="text-xs leading-relaxed text-stone-400">
                <span className="text-stone-200">A customer outside your area configures a unit</span> — when they enter an installation address that&apos;s outside your service radius, we automatically connect them with the nearest local installer.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400/10 text-[10px] font-bold text-yellow-400">
                3
              </div>
              <p className="text-xs leading-relaxed text-stone-400">
                <span className="text-stone-200">They book and pay a deposit</span> — the local installer handles the job. You automatically receive <span className="font-semibold text-yellow-400">30% of the deposit</span> (min $15) deposited directly to your Stripe account.
              </p>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-stone-600">
            No extra work required. Every customer you drive to the network — even outside your area — earns you money.
          </p>
        </div>
      </div>

      {/* ── Pro Upsell — only shown to free-plan installers ──────── */}
      {!isPro && (
        <div className="border-b border-slate-800 px-4 py-6">
          <div className="mx-auto max-w-2xl">
            <div className="overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-slate-900 to-slate-900">
              {/* Upsell Header */}
              <div className="border-b border-yellow-500/20 bg-yellow-400/5 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/15">
                    <TrendingUp className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-white">
                        Unlock Network Bounties
                      </h3>
                      <Lock className="h-3.5 w-3.5 text-yellow-400/60" />
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Turn every link share into passive income
                    </p>
                  </div>
                </div>
              </div>

              {/* Selling Points */}
              <div className="space-y-4 px-5 py-5">
                <p className="text-sm leading-relaxed text-stone-300">
                  Pro members earn <span className="font-bold text-yellow-400">30% of the deposit</span> every time
                  someone outside their service area books through their link. You don&apos;t lift a finger — another
                  installer handles the job. You get paid.
                </p>

                <div className="space-y-3">
                  {[
                    {
                      icon: Globe,
                      title: "No Territory Limits",
                      desc: "Your link works nationwide. Share it on Facebook, Instagram, TikTok, your website — anywhere.",
                    },
                    {
                      icon: Share2,
                      title: "Share Once, Earn Forever",
                      desc: "One social post can drive referrals for months. No cap on how many you earn.",
                    },
                    {
                      icon: Wallet,
                      title: "Direct to Your Stripe",
                      desc: "Bounties deposit automatically. No invoicing, no chasing payments.",
                    },
                    {
                      icon: DollarSign,
                      title: "Minimum $15 Per Referral",
                      desc: "A $500 deposit earns you $150. A $1,000 deposit? $300. Guaranteed minimum.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10">
                        <item.icon className="h-4 w-4 text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{item.title}</p>
                        <p className="text-[11px] leading-relaxed text-stone-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Example Earnings */}
                <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400/70">
                    Example monthly earnings
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-lg font-black text-white">$150</p>
                      <p className="text-[10px] text-stone-500">5 referrals</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-yellow-400">$450</p>
                      <p className="text-[10px] text-stone-500">15 referrals</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-emerald-400">$1,500</p>
                      <p className="text-[10px] text-stone-500">50 referrals</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-stone-600">
                    Based on avg. $100 deposit × 30% bounty
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div className="border-t border-yellow-500/20 bg-slate-900/50 px-5 py-4">
                <button
                  onClick={handleUpgrade}
                  disabled={upgradeLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-widest text-gray-950 shadow-lg shadow-yellow-400/25 transition-all hover:bg-yellow-300 hover:shadow-yellow-400/40 disabled:opacity-50"
                >
                  {upgradeLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Upgrade to Pro — $99/mo
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                {upgradeError && (
                  <p className="mt-2 text-center text-xs text-red-400">{upgradeError}</p>
                )}
                <p className="mt-2 text-center text-[10px] text-stone-600">
                  Cancel anytime. Also includes 5% fees, custom branding, custom pricing & more.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Referral List ──────────────────────────────────────────── */}
      <main className="mx-auto max-w-2xl px-4 py-4">
        {referrals.length === 0 ? (
          <div className="py-12 text-center">
            <DollarSign className="mx-auto mb-3 h-10 w-10 text-stone-700" />
            <p className="text-sm font-semibold text-stone-400">
              No referrals yet
            </p>
            <p className="mt-1 text-xs text-stone-600">
              {isPro
                ? "Share your link — when a customer books outside your area, it'll show up here."
                : "Upgrade to Pro to start earning passive income from network referrals."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {referrals.map((ref) => {
              const bountyAmt = estimateBounty(ref);
              return (
                <div
                  key={ref.id}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                >
                  <div className="flex items-start justify-between">
                    {/* Location & installer info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-stone-500" />
                        <p className="text-sm font-semibold text-white">
                          {[ref.address_city, ref.address_state]
                            .filter(Boolean)
                            .join(", ") ||
                            (ref.address_zip
                              ? `ZIP ${ref.address_zip}`
                              : "Location pending")}
                        </p>
                      </div>
                      {ref.installer_profile && (
                        <p className="mt-1 ml-5.5 text-xs text-stone-500">
                          Handled by{" "}
                          <span className="text-stone-400">
                            {ref.installer_profile.business_name ||
                              [ref.installer_profile.city, ref.installer_profile.state]
                                .filter(Boolean)
                                .join(", ") ||
                              "Local installer"}
                          </span>
                        </p>
                      )}
                      <p className="mt-1 ml-5.5 text-[10px] text-stone-600">
                        {new Date(ref.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {ref.estimated_price
                          ? ` · $${ref.estimated_price.toLocaleString()} job`
                          : ""}
                      </p>
                    </div>

                    {/* Bounty status badge */}
                    <div className="shrink-0 ml-3">
                      {ref.bounty_status === "paid" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          +${bountyAmt}
                        </span>
                      ) : ref.bounty_status === "pending" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          <Clock className="h-3 w-3" />
                          ~${bountyAmt}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                          No bounty
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
