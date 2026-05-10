"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  DollarSign,
  Handshake,
  Loader2,
  Mail,
  Sparkles,
  Users,
} from "lucide-react";
import {
  getMyAffiliatePortalData,
  type AffiliatePortalData,
} from "@/app/actions/affiliate-program";
import {
  formatAgreementConfig,
  formatAgreementDuration,
} from "@/types/affiliate";

// ═══════════════════════════════════════════════════════════════════════════
// /dashboard/affiliate/portal — Private Partner Portal
//
// The privacy-isolation moment from the original brief: every affiliate
// sees ONLY their own terms, recruits, and earnings. The data fetcher
// (getMyAffiliatePortalData) scopes everything to auth.uid(). RLS is the
// defense-in-depth backstop.
//
// Sections rendered:
//   • Hero with one-line cut summary + duration
//   • Earnings (paid + pending) — empty zeroes until Phase 5 wires payouts
//   • Recruits list — empty until Phase 6 wires signup attribution
//   • Refer-an-installer placeholder card — Phase 6 fills this in
//   • Link back to the full agreement document
// ═══════════════════════════════════════════════════════════════════════════

export default function AffiliatePortalPage() {
  const params = useSearchParams();
  const justAccepted = params.get("accepted") === "1";

  const [data, setData] = useState<AffiliatePortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getMyAffiliatePortalData();
      if (cancelled) return;
      if (res.error || !res.data) {
        setError(res.error || "Could not load your portal.");
      } else {
        setData(res.data);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
          {error}
        </div>
      </Shell>
    );
  }

  // No agreement at all — this user shouldn't be on the portal yet.
  // Send them to apply.
  if (!data?.agreement) {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h1 className="mb-2 text-lg font-bold text-white">Not an affiliate yet</h1>
          <p className="mb-4 text-sm text-stone-400">
            You don&rsquo;t have an affiliate agreement on file. Apply to join the program.
          </p>
          <a
            href="/dashboard/affiliate/apply"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300"
          >
            <Handshake className="h-4 w-4" /> Apply to Be an Affiliate
          </a>
        </div>
      </Shell>
    );
  }

  const agreement = data.agreement;

  // Proposed but not yet accepted — bounce them to the acceptance page.
  if (agreement.status === "proposed") {
    return (
      <Shell>
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-400" />
            <h1 className="text-lg font-bold text-white">Your agreement is ready</h1>
          </div>
          <p className="mb-4 text-sm text-stone-300">
            We&rsquo;ve drafted a custom agreement. Review and accept to unlock your portal.
          </p>
          <a
            href={`/dashboard/affiliate/agreement/${agreement.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300"
          >
            Review &amp; Accept
          </a>
        </div>
      </Shell>
    );
  }

  // Active — the live portal.
  const summary = formatAgreementConfig(agreement.agreement_config);
  const duration = formatAgreementDuration(agreement.duration_months);
  const acceptedDate = agreement.accepted_at
    ? new Date(agreement.accepted_at).toLocaleDateString()
    : null;
  const activeRecruits = data.recruits.filter((r) => r.is_pro).length;

  return (
    <Shell>
      {justAccepted && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <p className="text-sm font-bold text-white">Welcome aboard.</p>
          </div>
          <p className="mt-1 text-xs text-stone-300">
            Your agreement is active. Recruit installers using the tools below — we handle
            the payouts.
          </p>
        </div>
      )}

      {/* Hero — agreement summary */}
      <section className="rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/10 to-slate-900 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Handshake className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">
            Affiliate Portal
          </span>
        </div>
        <p className="text-base font-bold text-white leading-snug">{summary}</p>
        <p className="mt-2 text-[11px] text-stone-400">
          Term: <span className="text-stone-200">{duration}</span>
          {acceptedDate && (
            <> &middot; Accepted {acceptedDate}</>
          )}
        </p>
        <a
          href={`/dashboard/affiliate/agreement/${agreement.id}`}
          className="mt-3 inline-block text-[11px] text-yellow-400 underline-offset-2 hover:underline"
        >
          View full agreement →
        </a>
      </section>

      {/* Earnings */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Earnings
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Paid" value={`$${(data.earnings.total_paid_cents / 100).toFixed(2)}`} />
          <Stat
            label="Pending"
            value={`$${(data.earnings.total_pending_cents / 100).toFixed(2)}`}
            secondary={`${data.earnings.payout_count} payout${data.earnings.payout_count === 1 ? "" : "s"}`}
          />
        </div>
        {data.earnings.payout_count === 0 && (
          <p className="mt-3 text-[11px] text-stone-500">
            Payouts hit your connected Stripe account automatically each time a recruit&rsquo;s
            subscription invoice clears. Nothing to collect manually.
          </p>
        )}
      </section>

      {/* Recruits */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-stone-300" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-300">
            Your Recruits
          </h2>
          <span className="ml-auto text-[11px] text-stone-500">
            {activeRecruits} active &middot; {data.recruits.length} total
          </span>
        </div>
        {data.recruits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
            <p className="text-sm text-stone-400">No recruits yet.</p>
            <p className="mt-1 text-[11px] text-stone-500">
              Once an installer signs up through your link or invite, they&rsquo;ll show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.recruits.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{r.name}</p>
                  <p className="text-[11px] text-stone-500">
                    Joined {new Date(r.joined_at).toLocaleDateString()}
                    {r.completed_jobs != null && r.completed_jobs > 0 && (
                      <> &middot; {r.completed_jobs} completed jobs</>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    r.is_pro
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-stone-700/40 text-stone-400"
                  }`}
                >
                  {r.is_pro ? "PRO" : "TRIAL"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Refer-an-installer — Phase 6 fills this in */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-stone-300" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-300">
            Refer an Installer
          </h2>
          <span className="ml-auto rounded-full bg-yellow-400/15 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
            COMING SOON
          </span>
        </div>
        <p className="text-sm text-stone-400">
          Send a personalized invite to an installer you think would be a fit. We&rsquo;ll
          email them on your behalf with a tracked link, and any signup attributes back to
          you for the full agreement term.
        </p>
        <button
          disabled
          className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-2.5 text-sm font-semibold text-stone-500"
        >
          <Clock className="h-3.5 w-3.5" /> Available shortly
        </button>
      </section>
    </Shell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs text-stone-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-4">{children}</main>
    </div>
  );
}

function Stat({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
      {secondary && <p className="mt-0.5 text-[11px] text-stone-500">{secondary}</p>}
    </div>
  );
}
