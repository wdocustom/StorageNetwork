"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldOff,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Loader2,
  Mail,
  Calendar,
  Building2,
  Award,
  Gift,
  DollarSign,
  X,
} from "lucide-react";

import {
  setRealtorSuspended,
  getRealtorDeletionPreflight,
  type RealtorAdminDetail,
  type RealtorDeletionPreflight,
} from "@/app/actions/admin-realtor-management";
import { deleteUserCompletely } from "@/app/actions/admin-user-management";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor admin detail (interactive layer)
//
// Three regions:
//   1. Profile + aggregate cards (read-only)
//   2. Account controls — suspend toggle, delete button. The delete opens
//      a confirmation modal that runs the realtor-flavored preflight first.
//   3. Gifts table (status, recipient, package, milestones, installer if
//      assigned)
//
// Future-friendly: drop new cards above or below #1 as more features
// land (referrals, branding config, Pro subscription, etc.).
// ═══════════════════════════════════════════════════════════════════════════

export function RealtorAdminDetailClient({
  adminUserId,
  detail,
}: {
  adminUserId: string;
  detail: RealtorAdminDetail;
}) {
  const router = useRouter();
  const { profile, gifts } = detail;

  // ── Suspend toggle ──────────────────────────────────────────────────────
  const [suspended, setSuspended] = useState(profile.is_suspended);
  const [suspendError, setSuspendError] = useState("");
  const [suspendPending, startSuspendTransition] = useTransition();

  function toggleSuspended(next: boolean) {
    setSuspendError("");
    startSuspendTransition(async () => {
      const result = await setRealtorSuspended(adminUserId, profile.id, next);
      if (!result.ok) {
        setSuspendError(result.error || "Could not update.");
        return;
      }
      setSuspended(next);
      router.refresh();
    });
  }

  // ── Delete flow ─────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);

  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            Admin · Realtor
          </p>
          <h1 className="text-3xl font-black sm:text-4xl">{displayName}</h1>
          {profile.realtor_brokerage && (
            <p className="mt-1 text-sm text-stone-400">{profile.realtor_brokerage}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.is_pro && (
            <span className="inline-flex items-center gap-1 rounded-md border border-yellow-400/30 bg-yellow-400/10 px-3 py-1.5 text-[11px] font-bold text-yellow-300">
              <Building2 className="h-3 w-3" />
              Dual-role (installer)
            </span>
          )}
          {suspended && (
            <span className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-bold text-red-300">
              <ShieldOff className="h-3 w-3" />
              Suspended
            </span>
          )}
        </div>
      </div>

      {/* ── Aggregate cards ─────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Gift className="h-4 w-4" />} label="Gifts sent" value={profile.gifts_total} />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Revenue"
          value={`$${(profile.gifts_revenue_cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
        />
        <StatCard
          icon={<Loader2 className="h-4 w-4" />}
          label="In flight"
          value={profile.gifts_in_flight}
          tint={profile.gifts_in_flight > 0 ? "yellow" : "default"}
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Completed"
          value={profile.gifts_completed}
          tint="emerald"
        />
      </div>

      {/* ── Profile details ─────────────────────────────────────────────── */}
      <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-stone-300">
          Profile
        </h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 text-sm">
          <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={profile.email} />
          <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Brokerage" value={profile.realtor_brokerage || "—"} />
          <Field icon={<Award className="h-3.5 w-3.5" />} label="License #" value={profile.realtor_license || "—"} />
          <Field
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Joined"
            value={new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          />
          <Field
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Last login"
            value={profile.last_login_at ? new Date(profile.last_login_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never"}
          />
          <Field
            icon={<span className="font-mono text-[10px] text-stone-500">ID</span>}
            label="Profile UUID"
            value={<code className="break-all text-[10px] text-stone-500">{profile.id}</code>}
          />
        </dl>
      </section>

      {/* ── Future referrals placeholder (kept commented for visibility) ──
        Add a <ReferralsCard realtorId={profile.id} /> here when the
        referrals feature lands. Pull aggregate counts the same way we
        do gifts above. */}

      {/* ── Account controls ────────────────────────────────────────────── */}
      <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-stone-300">
          Account controls
        </h2>

        <div className="flex flex-wrap items-start gap-6">
          {/* Lock toggle */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
              {suspended ? <ShieldOff className="h-4 w-4 text-red-400" /> : <ShieldCheck className="h-4 w-4 text-emerald-400" />}
              Account access
            </div>
            <p className="mb-3 text-xs text-stone-400">
              {suspended
                ? "This realtor is locked out of the portal. Middleware redirects all (authed) routes."
                : "This realtor can sign in normally."}
            </p>
            <button
              onClick={() => toggleSuspended(!suspended)}
              disabled={suspendPending}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-60 ${
                suspended
                  ? "border border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                  : "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              }`}
            >
              {suspendPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : suspended ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <ShieldOff className="h-3.5 w-3.5" />
              )}
              {suspended ? "Unlock account" : "Lock account"}
            </button>
            {suspendError && (
              <p className="mt-2 text-xs text-red-300">{suspendError}</p>
            )}
          </div>

          {/* Delete button (separate, destructive) */}
          <div className="min-w-0 flex-1 border-l border-zinc-800 pl-6">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-300">
              <Trash2 className="h-4 w-4" />
              Permanent deletion
            </div>
            <p className="mb-3 text-xs text-stone-400">
              Removes the auth account and all gifts/OTPs via cascade. Stripe transfer records to installers remain in your Stripe dashboard.
            </p>
            <button
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-300 hover:bg-red-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete account
            </button>
          </div>
        </div>
      </section>

      {/* ── Gifts table ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-300">
            Gifts ({gifts.length})
          </h2>
        </header>
        {gifts.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-stone-500">
            This realtor hasn&apos;t sent any gifts yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/60 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Installer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {gifts.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3 text-stone-400">
                      {new Date(g.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-stone-200">{g.recipient_name}</p>
                      <p className="text-[10px] text-stone-500">{g.recipient_email}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-300">
                      {g.package_name || "—"}
                      <span className="text-stone-500"> · {g.tote_count}t · {g.duration_days}d</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-stone-300">
                      ${(g.amount_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={g.status} />
                    </td>
                    <td className="px-4 py-3 text-[11px] text-stone-400">
                      {g.installer_label || <span className="text-stone-600">Unassigned</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Delete confirmation modal ───────────────────────────────────── */}
      {deleteOpen && (
        <DeleteConfirmModal
          adminUserId={adminUserId}
          realtorId={profile.id}
          realtorEmail={profile.email}
          realtorName={displayName}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            router.push("/dashboard/admin/realtors");
          }}
        />
      )}
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  tint = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tint?: "default" | "yellow" | "emerald";
}) {
  const tintClass =
    tint === "yellow"
      ? "border-yellow-400/30 bg-yellow-400/5 text-yellow-200"
      : tint === "emerald"
        ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-200"
        : "border-zinc-800 bg-zinc-900/40 text-stone-200";
  return (
    <div className={`rounded-xl border p-4 ${tintClass}`}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-400">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-stone-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</dt>
        <dd className="mt-0.5 text-sm text-stone-200">{value}</dd>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_payment: { label: "Pending payment", cls: "border-stone-500/40 bg-stone-500/10 text-stone-300" },
    paid: { label: "Paid · awaiting recipient", cls: "border-blue-400/40 bg-blue-400/10 text-blue-300" },
    redeemed: { label: "Redeemed", cls: "border-purple-400/40 bg-purple-400/10 text-purple-300" },
    scheduled: { label: "Scheduled", cls: "border-yellow-400/40 bg-yellow-400/10 text-yellow-300" },
    assigned: { label: "Installer assigned", cls: "border-yellow-400/40 bg-yellow-400/10 text-yellow-300" },
    delivered: { label: "Delivered", cls: "border-blue-400/40 bg-blue-400/10 text-blue-300" },
    returned: { label: "Returned", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
    cancelled: { label: "Cancelled", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
  };
  const meta = map[status] ?? { label: status, cls: "border-zinc-700 bg-zinc-800 text-stone-300" };
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

// ── Delete modal ───────────────────────────────────────────────────────────

function DeleteConfirmModal({
  adminUserId,
  realtorId,
  realtorEmail,
  realtorName,
  onClose,
  onDeleted,
}: {
  adminUserId: string;
  realtorId: string;
  realtorEmail: string;
  realtorName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [preflight, setPreflight] = useState<RealtorDeletionPreflight | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [inFlight, setInFlight] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getRealtorDeletionPreflight(adminUserId, realtorId);
      if (cancelled) return;
      setPreflight(result);
      setPreflightLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [adminUserId, realtorId]);

  async function confirmDelete() {
    setError(null);
    setInFlight(true);
    const result = await deleteUserCompletely(adminUserId, realtorId, confirmText);
    setLog(result.log);
    if (result.success) {
      setTimeout(onDeleted, 1500);
    } else {
      setError(result.error ?? "Deletion failed.");
      setInFlight(false);
    }
  }

  const canConfirm = !!preflight && preflight.ok && confirmText === "DELETE" && !inFlight;

  return (
    <div
      onClick={(e) => {
        if (!inFlight && e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-10"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-red-500/40 bg-zinc-950 p-6 shadow-2xl">
        <button
          onClick={onClose}
          disabled={inFlight}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1 text-stone-500 hover:bg-zinc-800 hover:text-stone-200 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-full bg-red-500/10 p-2 ring-1 ring-red-400/40">
            <AlertTriangle className="h-5 w-5 text-red-300" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Delete realtor account</h3>
            <p className="text-xs text-stone-400">
              {realtorName} &middot; {realtorEmail}
            </p>
          </div>
        </div>

        {preflightLoading ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-6 text-center text-sm text-stone-400">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-yellow-400" />
            Computing what will be deleted…
          </div>
        ) : preflight ? (
          <>
            {!preflight.ok && (
              <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                {preflight.error || "Cannot delete."}
              </div>
            )}

            {preflight.blockers.length > 0 && (
              <ul className="mb-4 space-y-1.5 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                {preflight.blockers.map((b, i) => (
                  <li key={i}>• {b}</li>
                ))}
              </ul>
            )}

            {preflight.warnings.length > 0 && (
              <ul className="mb-4 space-y-1.5 rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs text-yellow-200">
                {preflight.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            )}

            <div className="mb-5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                What will be deleted
              </p>
              <dl className="grid grid-cols-2 gap-y-2 text-xs">
                <CountRow label="Total gifts" v={preflight.counts.gifts_total} />
                <CountRow label="Pending payment" v={preflight.counts.gifts_pending_payment} />
                <CountRow label="In flight" v={preflight.counts.gifts_in_flight} />
                <CountRow label="Completed" v={preflight.counts.gifts_completed} />
                <CountRow label="Cancelled" v={preflight.counts.gifts_cancelled} />
                <CountRow
                  label="Gift revenue"
                  v={`$${(preflight.counts.gifts_revenue_cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
                />
              </dl>
              {preflight.counts.installer_payouts_cents > 0 && (
                <p className="mt-3 border-t border-zinc-800 pt-3 text-[11px] text-stone-400">
                  ${(preflight.counts.installer_payouts_cents / 100).toFixed(2)} previously transferred to installers — those records stay in Stripe.
                </p>
              )}
            </div>

            <div className="mb-3">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Type <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-yellow-400">DELETE</code> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={!preflight.ok || inFlight}
                placeholder="DELETE"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-red-500/60 focus:outline-none"
              />
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                {error}
              </div>
            )}

            {log.length > 0 && (
              <details className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] text-stone-400">
                <summary className="cursor-pointer font-bold text-stone-300">Deletion log</summary>
                <pre className="mt-2 whitespace-pre-wrap text-[10px] leading-relaxed text-stone-400">
{log.join("\n")}
                </pre>
              </details>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={inFlight}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-300 hover:bg-zinc-800 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={!canConfirm}
                className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {inFlight ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete forever
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function CountRow({ label, v }: { label: string; v: number | string }) {
  return (
    <>
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-mono tabular-nums text-stone-200">{v}</dd>
    </>
  );
}
