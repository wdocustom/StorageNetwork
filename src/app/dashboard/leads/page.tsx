"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  Loader2,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";

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
}

// ═══════════════════════════════════════════════════════════════════════════
// Jobs / Leads List — Unified view of all active jobs
// ═══════════════════════════════════════════════════════════════════════════

type TabKey = "active" | "past";

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

    const { data } = await supabase
      .from("leads")
      .select(
        "id, customer_name, customer_email, address, status, source, estimated_price, deposit_paid, balance_due, created_at, scheduled_at"
      )
      .eq("installer_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setLeads(data as LeadItem[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  // Show ALL leads except paid/archived — stop hiding failed webhook data
  const activeLeads = leads.filter(
    (l) => !["paid", "archived"].includes(l.status)
  );
  const pastLeads = leads.filter((l) => l.status === "paid" || l.status === "completed");
  const filtered = tab === "active" ? activeLeads : pastLeads;
  const grouped = tab === "active" ? groupByDate(filtered) : null;

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
              {tab === "active" ? "No active jobs" : "No past jobs"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {tab === "active"
                ? "Leads from the network and your lead link will appear here."
                : "Completed and paid jobs will show up here."}
            </p>
          </div>
        ) : tab === "active" && grouped ? (
          /* ── Date-grouped active jobs ────────────────────────────────── */
          <div className="space-y-6">
            {Object.entries(grouped).map(([dateString, jobs]) => (
              <div key={dateString}>
                <h3 className="mb-3 border-b border-slate-700 pb-2 text-sm font-semibold uppercase tracking-wider text-stone-400">
                  {dateString}
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

function JobCard({ lead }: { lead: LeadItem }) {
  return (
    <a
      href={`/dashboard/leads/${lead.id}`}
      className="group block rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all hover:border-slate-700 active:scale-[0.99]"
    >
      {/* Top row: name + source badge */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-white">
            {lead.customer_name}
          </p>
          {lead.address && (
            <p className="mt-0.5 truncate text-sm text-stone-500">
              {lead.address}
            </p>
          )}
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
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Source Badge Component
// ═══════════════════════════════════════════════════════════════════════════

function SourceBadge({ source }: { source: string }) {
  if (source === "partner_link") {
    return (
      <span className="ml-2 shrink-0 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-400">
        My Client
      </span>
    );
  }

  // Default: platform / network lead
  return (
    <span className="ml-2 shrink-0 rounded-full bg-yellow-400/20 px-2.5 py-0.5 text-[10px] font-bold text-yellow-400">
      Network Lead
    </span>
  );
}
