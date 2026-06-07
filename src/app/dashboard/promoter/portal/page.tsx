"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  CreditCard,
  DollarSign,
  Handshake,
  Link2,
  Loader2,
  Megaphone,
  Sparkles,
} from "lucide-react";
import {
  getMyPromoterPortalData,
  type PromoterPortalData,
} from "@/app/actions/promoter-program";
import { formatPromoterAgreementConfig } from "@/types/promoter";
import type { PromoterPayout, PromoterPayoutStatus } from "@/types/promoter";

// ═══════════════════════════════════════════════════════════════════════════
// /dashboard/promoter/portal — Private Promoter Portal
//
// Mirrors /dashboard/affiliate/portal + the realtor referrals section:
// share link, individualized cut summary, lifetime stats, payout history,
// and Stripe Connect status. Every promoter sees only their own data — the
// data fetcher scopes everything to auth.uid(); RLS is the backstop.
// ═══════════════════════════════════════════════════════════════════════════

export default function PromoterPortalPage() {
  const params = useSearchParams();
  const justAccepted = params.get("accepted") === "1";

  const [data, setData] = useState<PromoterPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  async function handleCopyShareLink(link: string) {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Storage Network — Build Plans",
          text: "Build your own tote storage system — check out these plans:",
          url: link,
        });
        return;
      }
    } catch {
      // User dismissed the share sheet — fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.warn("[PromoterPortal] copy failed:", err);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getMyPromoterPortalData();
      if (cancelled) return;
      if (!res.success || !res.data) {
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
  if (!data?.agreement) {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h1 className="mb-2 text-lg font-bold text-white">Not a promoter yet</h1>
          <p className="mb-4 text-sm text-stone-400">
            You don&rsquo;t have a promoter agreement on file. Apply to join the program.
          </p>
          <a
            href="/dashboard/promoter/apply"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300"
          >
            <Megaphone className="h-4 w-4" /> Apply to Be a Promoter
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
            We&rsquo;ve drafted a custom commission agreement. Review and accept to unlock
            your portal and referral link.
          </p>
          <a
            href={`/dashboard/promoter/agreement/${agreement.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300"
          >
            Review &amp; Accept
          </a>
        </div>
      </Shell>
    );
  }

  // Active (or paused) — the live portal.
  const summary = formatPromoterAgreementConfig(agreement.agreement_config);
  const acceptedDate = agreement.accepted_at
    ? new Date(agreement.accepted_at).toLocaleDateString()
    : null;

  return (
    <Shell>
      {justAccepted && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <p className="text-sm font-bold text-white">Welcome aboard.</p>
          </div>
          <p className="mt-1 text-xs text-stone-300">
            Your agreement is active. Share your link below — we handle the payouts.
          </p>
        </div>
      )}

      {agreement.status === "paused" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Your agreement is currently paused — new sales through your link won&rsquo;t earn a
          commission until it&rsquo;s reactivated. Reach out to support with questions.
        </div>
      )}

      {/* Hero — agreement summary */}
      <section className="rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/10 to-slate-900 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">
            Promoter Portal
          </span>
        </div>
        <p className="text-base font-bold text-white leading-snug">{summary}</p>
        {acceptedDate && (
          <p className="mt-2 text-[11px] text-stone-400">
            Accepted <span className="text-stone-200">{acceptedDate}</span>
          </p>
        )}
        <a
          href={`/dashboard/promoter/agreement/${agreement.id}`}
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
          <Stat label="Paid out" value={formatCents(data.paidCommissionCents)} />
          <Stat label="Pending" value={formatCents(data.pendingCommissionCents)} />
          <Stat label="Sales driven" value={`${data.conversionCount}`} />
          <Stat label="Total sale volume" value={formatCents(data.lifetimeSaleCents)} />
        </div>
        {data.conversionCount === 0 && (
          <p className="mt-3 text-[11px] text-stone-500">
            Commissions hit your connected Stripe account automatically each time someone
            buys plans through your link. Nothing to collect manually.
          </p>
        )}
      </section>

      {/* Referral link */}
      <section className="rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/5 to-slate-900 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-yellow-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-yellow-400">
            Your Referral Link
          </h2>
        </div>
        <p className="mb-3 text-xs text-stone-400">
          Share this anywhere — social, video descriptions, bio links. Anyone who buys
          plans through it attributes the sale back to you.
        </p>
        <button
          onClick={() => handleCopyShareLink(data.shareUrl)}
          className="group flex w-full items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-left transition-colors hover:border-yellow-400 hover:bg-slate-800"
        >
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-yellow-400">
            {data.shareUrl}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 group-hover:text-yellow-400">
            {linkCopied ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Share
              </>
            )}
          </span>
        </button>
        <p className="mt-2 text-[10px] text-stone-500">
          On mobile this opens the share sheet. On desktop it copies to clipboard.
        </p>
      </section>

      {/* Stripe Connect status */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-stone-300" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-300">
            Payouts
          </h2>
        </div>
        {data.stripeConnected ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <p className="text-sm text-emerald-200">
              Your Stripe account is connected — commissions transfer automatically.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <p className="text-sm text-amber-200">
                Connect a Stripe account to receive your commissions. Until then, payouts
                will be held and retried once you&rsquo;re connected.
              </p>
            </div>
            <a
              href="/dashboard/profile"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300"
            >
              <Handshake className="h-4 w-4" /> Connect Stripe in Profile
            </a>
          </>
        )}
      </section>

      {/* Payout history */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-stone-300" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-300">
            Payout History
          </h2>
          <span className="ml-auto text-[11px] text-stone-500">
            {data.payouts.length} sale{data.payouts.length === 1 ? "" : "s"}
          </span>
        </div>
        {data.payouts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
            <p className="text-sm text-stone-400">No sales yet.</p>
            <p className="mt-1 text-[11px] text-stone-500">
              Once someone buys plans through your link, it&rsquo;ll show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.payouts.map((p) => (
              <PayoutRow key={p.id} payout={p} />
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}

// ── Payout row ─────────────────────────────────────────────────────────────

function PayoutRow({ payout }: { payout: PromoterPayout }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">
          {formatCents(payout.commission_cents)}{" "}
          <span className="text-xs font-normal text-stone-500">
            of {formatCents(payout.sale_amount_cents)} sale
          </span>
        </p>
        <p className="text-[11px] text-stone-500">
          {new Date(payout.created_at).toLocaleDateString()}
          {payout.plan_id && <> &middot; {payout.plan_id}</>}
        </p>
      </div>
      <PayoutPill status={payout.status} />
    </div>
  );
}

function PayoutPill({ status }: { status: PromoterPayoutStatus }) {
  const map: Record<PromoterPayoutStatus, { bg: string; fg: string; label: string }> = {
    pending:    { bg: "bg-stone-700/40",   fg: "text-stone-400",   label: "PENDING" },
    processing: { bg: "bg-blue-500/15",    fg: "text-blue-300",    label: "PROCESSING" },
    paid:       { bg: "bg-emerald-500/15", fg: "text-emerald-300", label: "PAID" },
    failed:     { bg: "bg-red-500/15",     fg: "text-red-300",     label: "FAILED" },
    refunded:   { bg: "bg-amber-500/15",   fg: "text-amber-300",   label: "REFUNDED" },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${s.bg} ${s.fg}`}
    >
      {s.label}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}
