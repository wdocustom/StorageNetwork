"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  XCircle,
  History,
  Users,
  Ban,
  ShieldCheck,
} from "lucide-react";
import {
  listPromoterApplications,
  listPromoters,
  setPromoterSuspended,
  type AdminPromoterApplicationRow,
  type AdminPromoterRosterRow,
} from "@/app/actions/admin-promoter-management";
import type { PromoterApplicationStatus } from "@/types/promoter";

// ═══════════════════════════════════════════════════════════════════════════
// /dashboard/admin/promoters — Promoter Application Queue + Roster (admin only)
//
// Mirrors /dashboard/admin/affiliates. Server-side admin guard lives in the
// list actions — if the caller isn't admin, they return an error we surface
// here. Each application row links to the per-application detail page where
// admin proposes an INDIVIDUALIZED commission percentage.
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "pending" | "approved" | "rejected" | "withdrawn" | "all" | "roster";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "pending", label: "Pending", icon: Clock },
  { id: "approved", label: "Approved", icon: CheckCircle2 },
  { id: "rejected", label: "Rejected", icon: XCircle },
  { id: "withdrawn", label: "Withdrawn", icon: Inbox },
  { id: "all", label: "All Apps", icon: History },
  { id: "roster", label: "Roster", icon: Users },
];

export default function AdminPromotersPage() {
  const [tab, setTab] = useState<Tab>("pending");

  const [rows, setRows] = useState<AdminPromoterApplicationRow[]>([]);
  const [roster, setRoster] = useState<AdminPromoterRosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (target: Tab) => {
    setLoading(true);
    setError(null);
    try {
      if (target === "roster") {
        const res = await listPromoters();
        if (res.error) {
          setError(res.error);
          setRoster([]);
        } else {
          setRoster(res.rows);
        }
      } else {
        const res = await listPromoterApplications({
          status: target === "all" ? "all" : (target as PromoterApplicationStatus),
        });
        if (res.error) {
          setError(res.error);
          setRows([]);
        } else {
          setRows(res.rows);
        }
      }
    } catch (err) {
      console.error("[AdminPromoters] load failed:", err);
      setError("Could not load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function handleToggleSuspend(row: AdminPromoterRosterRow) {
    const next = !row.isSuspended;
    const reason = next ? window.prompt("Reason for suspension (optional):") ?? undefined : undefined;
    const res = await setPromoterSuspended(row.promoterId, next, reason);
    if (res.success) {
      await load("roster");
    } else {
      alert(res.error || "Could not update suspension status.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs text-stone-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </a>
          <h1 className="mt-2 text-xl font-bold sm:text-2xl">Promoter Program</h1>
          <p className="mt-1 text-xs text-stone-500">
            Review applications and propose individualized commission agreements. Each
            promoter&rsquo;s cut is negotiated and set per-person.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 space-y-4">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  tab === t.id
                    ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                    : "border-slate-700 bg-slate-900 text-stone-400 hover:border-slate-600"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
          </div>
        ) : tab === "roster" ? (
          roster.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
              <Users className="mx-auto mb-2 h-6 w-6 text-stone-600" />
              <p className="text-sm text-stone-400">No promoters yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {roster.map((r) => (
                <RosterRow key={r.agreementId} row={r} onToggleSuspend={handleToggleSuspend} />
              ))}
            </div>
          )
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
            <Inbox className="mx-auto mb-2 h-6 w-6 text-stone-600" />
            <p className="text-sm text-stone-400">No {tab !== "all" ? tab : ""} applications.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <ApplicationRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ApplicationRow({ row }: { row: AdminPromoterApplicationRow }) {
  const name =
    row.applicant.business_name ||
    [row.applicant.first_name, row.applicant.last_name].filter(Boolean).join(" ") ||
    "Unnamed installer";
  const submitted = new Date(row.submitted_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const howToPromote = String(
    (row.application_data as { how_to_promote?: unknown })?.how_to_promote ?? ""
  ).slice(0, 140);
  const audience = String(
    (row.application_data as { audience_size?: unknown })?.audience_size ?? "—"
  );

  return (
    <a
      href={`/dashboard/admin/promoters/${row.id}`}
      className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-colors hover:border-yellow-400/40"
    >
      <StatusPill status={row.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-sm font-bold text-white">{name}</p>
          {row.applicant.is_pro && (
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
              PRO
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-stone-400">{row.applicant.email}</p>
        {howToPromote && (
          <p className="mt-2 line-clamp-2 text-xs text-stone-300">{howToPromote}</p>
        )}
        <p className="mt-2 text-[10px] text-stone-500">
          Submitted {submitted} &middot; Audience: <span className="capitalize">{audience}</span>
        </p>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-stone-600" />
    </a>
  );
}

function RosterRow({
  row,
  onToggleSuspend,
}: {
  row: AdminPromoterRosterRow;
  onToggleSuspend: (row: AdminPromoterRosterRow) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-sm font-bold text-white">{row.name || "Unnamed installer"}</p>
          {row.isSuspended && (
            <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
              SUSPENDED
            </span>
          )}
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
              row.agreementStatus === "active"
                ? "bg-emerald-500/15 text-emerald-300"
                : row.agreementStatus === "paused"
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-slate-700/40 text-stone-400"
            }`}
          >
            {row.agreementStatus}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-stone-400">{row.email}</p>
        <p className="mt-2 text-xs text-stone-300">
          <span className="font-bold text-yellow-400">{row.percent ?? "—"}%</span> commission
          &middot; {row.conversionCount} sale{row.conversionCount === 1 ? "" : "s"} &middot;{" "}
          {formatCents(row.lifetimeCommissionCents)} earned ({formatCents(row.paidCommissionCents)} paid)
        </p>
        {row.shareCode && (
          <p className="mt-1 font-mono text-[10px] text-stone-500">/promo/{row.shareCode}</p>
        )}
      </div>
      <button
        onClick={() => onToggleSuspend(row)}
        className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
          row.isSuspended
            ? "border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/20"
            : "border-red-900/50 text-red-400 hover:bg-red-900/20"
        }`}
      >
        {row.isSuspended ? (
          <>
            <ShieldCheck className="h-3.5 w-3.5" /> Reinstate
          </>
        ) : (
          <>
            <Ban className="h-3.5 w-3.5" /> Suspend
          </>
        )}
      </button>
    </div>
  );
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function StatusPill({ status }: { status: PromoterApplicationStatus }) {
  const map: Record<PromoterApplicationStatus, { bg: string; fg: string; label: string }> = {
    pending:   { bg: "bg-yellow-400/15",  fg: "text-yellow-400",  label: "PENDING" },
    approved:  { bg: "bg-emerald-500/15", fg: "text-emerald-400", label: "APPROVED" },
    rejected:  { bg: "bg-red-500/15",     fg: "text-red-400",     label: "REJECTED" },
    withdrawn: { bg: "bg-slate-700/40",   fg: "text-stone-400",   label: "WITHDRAWN" },
  };
  const s = map[status];
  return (
    <span
      className={`mt-0.5 inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${s.bg} ${s.fg}`}
    >
      {s.label}
    </span>
  );
}
