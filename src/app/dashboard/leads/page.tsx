"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  Loader2,
  Trash2,
  X,
  PenLine,
  Link,
} from "lucide-react";
import { deleteUnpaidQuote } from "@/app/actions/jobs";
import StatusBadge from "@/components/ui/StatusBadge";
import ProPill from "@/components/dashboard/ProPill";
import { maskName } from "@/lib/mask";
// TODO: Re-enable calendar after fixing re-render issues
// import JobCalendar from "@/components/calendar/JobCalendar";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface LeadItem {
  id: string;
  customer_name: string;
  customer_email: string | null;
  address: string | null;
  status: string;
  source: string;
  estimated_price: number | null;
  deposit_paid: boolean;
  balance_due: number | null;
  created_at: string;
  scheduled_at: string | null;
  viewed_at: string | null;
  view_count: number | null;
  last_step_reached: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Jobs / Leads List — Unified view of all active jobs
// ═══════════════════════════════════════════════════════════════════════════

type TabKey = "active" | "past" | "unpaid";

// Group jobs by scheduled date
function groupByDate(jobs: LeadItem[]): Record<string, LeadItem[]> {
  const groups: Record<string, LeadItem[]> = {};
  const unscheduled: LeadItem[] = [];

  for (const job of jobs) {
    if (job.scheduled_at) {
      const dateStr = new Date(
        job.scheduled_at + (job.scheduled_at.includes("T") ? "" : "T12:00:00")
      ).toLocaleDateString("en-US", {
        weekday: "long",
        month: "numeric",
        day: "numeric",
        year: "numeric",
      });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(job);
    } else {
      unscheduled.push(job);
    }
  }

  // Sort groups by actual date (soonest first)
  const sorted: Record<string, LeadItem[]> = {};
  const entries = Object.entries(groups).sort((a, b) => {
    const dateA = a[1][0]?.scheduled_at ?? "";
    const dateB = b[1][0]?.scheduled_at ?? "";
    return dateA.localeCompare(dateB);
  });
  for (const [key, val] of entries) sorted[key] = val;

  if (unscheduled.length > 0) {
    sorted["Unscheduled"] = unscheduled;
  }

  return sorted;
}

export default function LeadsListPage() {
  const supabase = getSupabaseBrowserClient();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [unpaidLeads, setUnpaidLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("active");

  const fetchLeads = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Fetch active + past jobs:
    // deposit_paid = true (active/past), OR status is paid/completed (past jobs
    // that may have skipped the deposit flow, e.g. unpaid quotes marked paid)
    const { data } = await supabase
      .from("leads")
      .select(
        "id, customer_name, customer_email, address, status, source, estimated_price, deposit_paid, balance_due, created_at, scheduled_at"
      )
      .eq("installer_id", user.id)
      .or('deposit_paid.eq.true,status.in.("paid","completed")')
      .not("status", "in", '("cancelled","archived","pending_payment","expired")')
      .order("created_at", { ascending: false });

    if (data) setLeads(data as LeadItem[]);

    // Fetch unpaid quotes (pending_payment + waitlisted + recently expired,
    // deposit not paid). Pending/waitlisted quotes show regardless of age;
    // expired quotes only show if created in the last 60 days so years of
    // historical clutter doesn't dump into the dashboard at once. The rows
    // beyond 60 days stay in the DB — nothing is deleted, they're just
    // hidden from the active workspace.
    const sixtyDaysAgo = new Date(
      Date.now() - 60 * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data: unpaid } = await supabase
      .from("leads")
      .select(
        "id, customer_name, customer_email, address, status, source, estimated_price, deposit_paid, balance_due, created_at, scheduled_at, viewed_at, view_count, last_step_reached"
      )
      .eq("installer_id", user.id)
      .eq("deposit_paid", false)
      .or(
        `status.in.("pending_payment","waitlisted"),and(status.eq.expired,created_at.gte.${sixtyDaysAgo})`
      )
      .order("created_at", { ascending: false });

    if (unpaid) setUnpaidLeads(unpaid as LeadItem[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Memoize filtered leads - must be BEFORE any early returns (rules of hooks)
  const activeLeads = useMemo(
    () => leads.filter((l) => !["paid", "archived"].includes(l.status)),
    [leads]
  );
  const pastLeads = useMemo(
    () => leads.filter((l) => l.status === "paid" || l.status === "completed"),
    [leads]
  );
  const filtered = tab === "active" ? activeLeads : tab === "past" ? pastLeads : unpaidLeads;
  const grouped = useMemo(
    () => (tab === "active" ? groupByDate(filtered) : null),
    [tab, filtered]
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
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Jobs / Leads
            </h1>
            <p className="text-[10px] text-stone-500">
              {leads.length} total
            </p>
          </div>
          <ProPill />
        </div>
      </header>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-2xl">
          <button
            onClick={() => setTab("active")}
            className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-colors ${
              tab === "active"
                ? "border-b-2 border-yellow-400 text-yellow-400"
                : "text-stone-500 hover:text-stone-300"
            }`}
          >
            Active Jobs{" "}
            {activeLeads.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-yellow-400/20 px-1.5 text-[10px] font-bold text-yellow-400">
                {activeLeads.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("unpaid")}
            className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-colors ${
              tab === "unpaid"
                ? "border-b-2 border-orange-400 text-orange-400"
                : "text-stone-500 hover:text-stone-300"
            }`}
          >
            Unpaid{" "}
            {unpaidLeads.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-400/20 px-1.5 text-[10px] font-bold text-orange-400">
                {unpaidLeads.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("past")}
            className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-colors ${
              tab === "past"
                ? "border-b-2 border-yellow-400 text-yellow-400"
                : "text-stone-500 hover:text-stone-300"
            }`}
          >
            Past Jobs{" "}
            {pastLeads.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-stone-700 px-1.5 text-[10px] font-bold text-stone-400">
                {pastLeads.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-2xl p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900">
              <Briefcase className="h-10 w-10 text-stone-600" />
            </div>
            <p className="text-lg font-bold text-stone-400">
              {tab === "active" ? "No active jobs" : tab === "unpaid" ? "No unpaid quotes" : "No past jobs"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {tab === "active"
                ? "Leads from the network and your lead link will appear here."
                : tab === "unpaid"
                ? "Quotes awaiting deposit payment and waitlisted leads will appear here."
                : "Completed and paid jobs will show up here."}
            </p>
          </div>
        ) : tab === "unpaid" ? (
          /* ── Flat list for unpaid quotes ────────────────────────────── */
          <ul className="space-y-3">
            {filtered.map((lead) => (
              <JobCard key={lead.id} lead={lead} showDelete onDelete={fetchLeads} />
            ))}
          </ul>
        ) : tab === "active" && grouped ? (
          /* ── Date-grouped active jobs ────────────────────────────────── */
          <div className="space-y-6">
            {Object.entries(grouped).map(([dateString, jobs]) => (
              <div key={dateString}>
                <h3 className="mb-3 border-b border-slate-700 pb-2 text-sm font-semibold uppercase tracking-wider text-stone-400">
                  {dateString}
                  <span className="ml-2 text-yellow-400">({jobs.length})</span>
                </h3>
                <ul className="space-y-3">
                  {jobs.map((lead) => (
                    <JobCard key={lead.id} lead={lead} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          /* ── Flat list for past jobs ──────────────────────────────────── */
          <ul className="space-y-3">
            {filtered.map((lead) => (
              <JobCard key={lead.id} lead={lead} />
            ))}
          </ul>
        )}

        {/* Back link */}
        <div className="mt-8 pb-8 text-center">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-yellow-400"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// JobCard Component — Single lead row
// ═══════════════════════════════════════════════════════════════════════════

function JobCard({ lead, showDelete, onDelete }: { lead: LeadItem; showDelete?: boolean; onDelete?: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  async function handleCopyPayLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/payment/collect/${lead.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this payment link:", url);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteUnpaidQuote(lead.id);
    setDeleting(false);
    if (result.success) {
      setConfirmDelete(false);
      onDelete?.();
    }
  }

  return (
    <li className="group relative rounded-xl border border-slate-800 bg-slate-900 transition-all hover:border-slate-700">
      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-900/95 backdrop-blur-sm">
          <div className="text-center">
            <p className="mb-3 text-sm font-bold text-red-400">Delete this quote?</p>
            <p className="mb-4 text-xs text-stone-400">
              {lead.status === "waitlisted" ? maskName(lead.customer_name) : lead.customer_name} — ${lead.estimated_price?.toLocaleString() ?? "0"}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-stone-300 transition-colors hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-400 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <a
        href={`/dashboard/leads/${lead.id}`}
        className="block p-4 active:scale-[0.99]"
      >
        {/* Top row: name + pills */}
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-base font-bold text-white">
                {lead.status === "waitlisted" ? maskName(lead.customer_name) : lead.customer_name}
              </p>
              <QuoteStagePill lead={lead} />
            </div>
            {lead.status === "waitlisted" ? (
              <p className="mt-0.5 truncate text-xs font-semibold text-amber-400">
                Waitlisted — subscribe to unlock details
              </p>
            ) : lead.address ? (
              <p className="mt-0.5 truncate text-sm text-stone-500">
                {lead.address}
              </p>
            ) : null}
          </div>
          <SourceBadge source={lead.source} />
        </div>

        {/* Bottom row: revenue + badge + date */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {lead.estimated_price ? (
              <span className="text-lg font-bold text-yellow-400">
                ${lead.estimated_price.toLocaleString()}
              </span>
            ) : (
              <span className="text-sm text-stone-500">No quote</span>
            )}
            <StatusBadge status={lead.status} depositPaid={lead.deposit_paid} />
          </div>
          <div className="flex items-center gap-1 text-xs text-stone-500">
            {new Date(lead.created_at).toLocaleDateString()}
            <ChevronRight className="h-3 w-3 transition-colors group-hover:text-yellow-400" />
          </div>
        </div>

        {/* Collect amount hint */}
        {lead.balance_due && lead.balance_due > 0 && (
          <div className="mt-2 rounded-lg bg-slate-800 px-3 py-1.5 text-center text-xs font-semibold text-stone-400">
            Collect on completion:{" "}
            <span className="text-white">
              ${lead.balance_due.toLocaleString()}
            </span>
          </div>
        )}
      </a>

      {/* Edit + Delete buttons for unpaid quotes */}
      {showDelete && (
        <div className="flex border-t border-slate-800">
          <a
            href={`/dashboard/build?edit=${lead.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex flex-1 items-center justify-center gap-2 border-r border-slate-800 px-4 py-2.5 text-xs font-semibold text-yellow-400/70 transition-colors hover:bg-yellow-400/10 hover:text-yellow-400"
          >
            <PenLine className="h-3.5 w-3.5" />
            Edit Quote
          </a>
          <button
            onClick={handleCopyPayLink}
            className="flex flex-1 items-center justify-center gap-2 border-r border-slate-800 px-4 py-2.5 text-xs font-semibold text-emerald-400/70 transition-colors hover:bg-emerald-400/10 hover:text-emerald-400"
          >
            <Link className="h-3.5 w-3.5" />
            {linkCopied ? "Copied!" : "Pay Link"}
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true); }}
            className="flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Quote
          </button>
        </div>
      )}
    </li>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Quote Stage Pill — Shows pay link engagement status for unpaid quotes
// ═══════════════════════════════════════════════════════════════════════════

function QuoteStagePill({ lead }: { lead: LeadItem }) {
  // Only shown for unpaid quotes (pending_payment / waitlisted)
  if (lead.deposit_paid) return null;

  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Abandoned: viewed or not, but 3+ days old with no deposit
  if (daysSinceCreation >= 3) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
        Abandoned
      </span>
    );
  }

  // Viewed: customer opened the pay link
  if (lead.viewed_at) {
    const stepLabel = lead.last_step_reached === "payment"
      ? "At Payment"
      : lead.last_step_reached === "review"
        ? "Reviewing"
        : "Viewed";
    return (
      <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-bold text-blue-400">
        {stepLabel}
        {(lead.view_count ?? 0) > 1 && (
          <span className="ml-1 text-blue-400/60">({lead.view_count}x)</span>
        )}
      </span>
    );
  }

  // Quote Sent: no views yet, less than 3 days old
  return (
    <span className="inline-flex items-center rounded-full bg-yellow-500/15 px-2.5 py-0.5 text-[10px] font-bold text-yellow-400">
      Quote Sent
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Source Badge Component
// ═══════════════════════════════════════════════════════════════════════════

function SourceBadge({ source }: { source: string }) {
  if (source === "partner_link" || source === "installer_manual") {
    return (
      <span className="ml-2 shrink-0 rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-400">
        Direct Lead
      </span>
    );
  }

  return (
    <span className="ml-2 shrink-0 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-400">
      Network Lead
    </span>
  );
}
