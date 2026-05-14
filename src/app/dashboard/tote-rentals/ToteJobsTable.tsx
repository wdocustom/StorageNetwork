"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Loader2,
  Package,
  Truck,
  DollarSign,
} from "lucide-react";

import {
  markGiftDelivered,
  markGiftReturned,
  type InstallerToteJob,
} from "@/app/actions/realtor-gift-fulfillment";

// ═══════════════════════════════════════════════════════════════════════════
// Tote Jobs — three-tab table (Active / Delivered / Complete) with inline
// milestone action buttons. Uses React transitions so the row optimistically
// flips on click and reverts on error.
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "active" | "delivered" | "complete";

const TAB_LABEL: Record<Tab, string> = {
  active: "To deliver",
  delivered: "Out for pickup",
  complete: "Complete",
};

const STATUS_BY_TAB: Record<Tab, string[]> = {
  active: ["assigned"],
  delivered: ["delivered"],
  complete: ["returned"],
};

export function ToteJobsTable({ jobs }: { jobs: InstallerToteJob[] }) {
  const [tab, setTab] = useState<Tab>("active");
  // Optimistic overrides — flipped on action click, removed on server response.
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const visible = useMemo(() => {
    return jobs.filter((j) => STATUS_BY_TAB[tab].includes(overrides[j.id] || j.status));
  }, [jobs, tab, overrides]);

  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = { active: 0, delivered: 0, complete: 0 };
    for (const j of jobs) {
      const s = overrides[j.id] || j.status;
      if (s === "assigned") counts.active++;
      else if (s === "delivered") counts.delivered++;
      else if (s === "returned") counts.complete++;
    }
    return counts;
  }, [jobs, overrides]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => {
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                isActive
                  ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300"
                  : "border-slate-800 bg-slate-900/40 text-stone-300 hover:border-slate-700"
              }`}
            >
              {TAB_LABEL[t]}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  isActive ? "bg-yellow-400/20 text-yellow-200" : "bg-slate-800 text-stone-400"
                }`}
              >
                {tabCounts[t]}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-6 py-12 text-center text-sm text-stone-400">
          Nothing in this state yet.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              optimisticStatus={overrides[job.id]}
              onOptimistic={(next) =>
                setOverrides((prev) => ({ ...prev, [job.id]: next }))
              }
              onRevert={() =>
                setOverrides((prev) => {
                  const next = { ...prev };
                  delete next[job.id];
                  return next;
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({
  job,
  optimisticStatus,
  onOptimistic,
  onRevert,
}: {
  job: InstallerToteJob;
  optimisticStatus: string | undefined;
  onOptimistic: (nextStatus: string) => void;
  onRevert: () => void;
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const currentStatus = optimisticStatus || job.status;

  function flip(action: "delivered" | "returned") {
    setError("");
    const nextStatus = action === "delivered" ? "delivered" : "returned";
    onOptimistic(nextStatus);
    startTransition(async () => {
      const result =
        action === "delivered" ? await markGiftDelivered(job.id) : await markGiftReturned(job.id);
      if (!result.ok) {
        setError(result.error || "Couldn't update.");
        onRevert();
      }
    });
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-baseline gap-3">
            <Link
              href={`/dashboard/tote-rentals/${job.id}`}
              className="inline-flex items-center gap-1.5 text-base font-bold text-white hover:text-yellow-300"
            >
              {job.recipient_name}
              <ArrowRight className="h-3.5 w-3.5 text-stone-500" />
            </Link>
            <span className="text-xs text-stone-500">{job.recipient_email}</span>
            {job.pickup_early_requested_at && currentStatus === "delivered" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                <Bell className="h-3 w-3" />
                Ready for pickup
              </span>
            )}
          </div>
          <p className="mb-3 text-sm text-stone-300">
            {job.package_name}
            <span className="text-stone-500"> &middot; {job.tote_count} totes &middot; {job.duration_days}-day rental</span>
          </p>

          <PayoutBadge cents={job.payout_cents} paidAt={job.paid_at} status={currentStatus} />

          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <WindowRow icon={<Truck className="h-4 w-4" />} label="Delivery" start={job.delivery_window_start} end={job.delivery_window_end} />
            <WindowRow icon={<Package className="h-4 w-4" />} label="Pickup" start={job.pickup_window_start} end={job.pickup_window_end} />
          </div>

          {job.delivery_address && (
            <p className="mt-3 text-xs text-stone-400">{job.delivery_address}</p>
          )}
        </div>

        <div className="shrink-0">
          {currentStatus === "assigned" && (
            <ActionButton
              onClick={() => flip("delivered")}
              loading={isPending}
              icon={<Truck className="h-4 w-4" />}
              label="Mark delivered"
            />
          )}
          {currentStatus === "delivered" && (
            <ActionButton
              onClick={() => flip("returned")}
              loading={isPending}
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Mark returned"
            />
          )}
          {currentStatus === "returned" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}

function WindowRow({
  icon,
  label,
  start,
  end,
}: {
  icon: React.ReactNode;
  label: string;
  start: string | null;
  end: string | null;
}) {
  if (!start || !end) {
    return (
      <div className="flex items-center gap-2 text-stone-400">
        {icon}
        <span>{label}: TBD</span>
      </div>
    );
  }
  const s = new Date(start);
  const e = new Date(end);
  const date = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = `${s.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })}–${e.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })}`;
  return (
    <div className="flex items-center gap-2 text-stone-300">
      <span className="text-yellow-400">{icon}</span>
      <span>
        <span className="text-stone-500">{label}: </span>
        {date} · {time}
      </span>
    </div>
  );
}

function PayoutBadge({
  cents,
  paidAt,
  status,
}: {
  cents: number;
  paidAt: string | null;
  status: string;
}) {
  if (cents <= 0) return null;
  const dollars = (cents / 100).toFixed(2);
  if (paidAt) {
    const when = new Date(paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-300">
        <DollarSign className="h-3 w-3" />
        ${dollars} paid {when}
      </span>
    );
  }
  if (status === "returned") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-yellow-400/40 bg-yellow-400/10 px-2 py-1 text-[11px] font-semibold text-yellow-300">
        <DollarSign className="h-3 w-3" />
        ${dollars} payout pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-[11px] font-semibold text-stone-300">
      <DollarSign className="h-3 w-3" />
      ${dollars} on completion
    </span>
  );
}

function ActionButton({
  onClick,
  loading,
  icon,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-yellow-300 disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
