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
} from "lucide-react";
import {
  listAffiliateApplications,
  type AdminApplicationRow,
} from "@/app/actions/affiliate-program";
import type { AffiliateApplicationStatus } from "@/types/affiliate";

// ═══════════════════════════════════════════════════════════════════════════
// /dashboard/admin/affiliates — Affiliate Application Queue (admin only)
//
// Server-side admin guard lives in listAffiliateApplications. If the
// caller isn't admin the action returns an error; we surface that here.
// Each row is a link to the per-application detail page where admin
// approves or rejects.
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "pending" | "approved" | "rejected" | "withdrawn" | "all";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "pending", label: "Pending", icon: Clock },
  { id: "approved", label: "Approved", icon: CheckCircle2 },
  { id: "rejected", label: "Rejected", icon: XCircle },
  { id: "withdrawn", label: "Withdrawn", icon: Inbox },
  { id: "all", label: "All", icon: History },
];

export default function AdminAffiliatesPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<AdminApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (target: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAffiliateApplications({
        status: target === "all" ? "all" : (target as AffiliateApplicationStatus),
      });
      if (res.error) {
        setError(res.error);
        setRows([]);
      } else {
        setRows(res.rows);
      }
    } catch (err) {
      console.error("[AdminAffiliates] load failed:", err);
      setError("Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

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
          <h1 className="mt-2 text-xl font-bold sm:text-2xl">Affiliate Applications</h1>
          <p className="mt-1 text-xs text-stone-500">
            Review and approve installers applying to become affiliates. Each agreement is
            negotiated individually.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 space-y-4">
        {/* Tabs */}
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

function ApplicationRow({ row }: { row: AdminApplicationRow }) {
  const name =
    row.applicant.business_name ||
    [row.applicant.first_name, row.applicant.last_name].filter(Boolean).join(" ") ||
    "Unnamed installer";
  const submitted = new Date(row.submitted_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const whyExcerpt = String(
    (row.application_data as { why?: unknown })?.why ?? ""
  )
    .slice(0, 140);
  const audience = String(
    (row.application_data as { audience_size?: unknown })?.audience_size ?? "—"
  );

  return (
    <a
      href={`/dashboard/admin/affiliates/${row.id}`}
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
          {row.applicant.completed_jobs != null && row.applicant.completed_jobs > 0 && (
            <span className="text-[10px] text-stone-500">
              {row.applicant.completed_jobs} jobs
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-stone-400">{row.applicant.email}</p>
        {whyExcerpt && (
          <p className="mt-2 line-clamp-2 text-xs text-stone-300">{whyExcerpt}</p>
        )}
        <p className="mt-2 text-[10px] text-stone-500">
          Submitted {submitted} &middot; Audience: <span className="capitalize">{audience}</span>
        </p>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-stone-600" />
    </a>
  );
}

function StatusPill({ status }: { status: AffiliateApplicationStatus }) {
  const map: Record<AffiliateApplicationStatus, { bg: string; fg: string; label: string }> = {
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
