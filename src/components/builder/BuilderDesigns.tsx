"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — "My designs"
//
// A member's saved designs: open one, share or sell it, delete it, start a
// new one. Also where they see what their listings have earned and manage
// their subscription (Stripe's billing page).
// ═══════════════════════════════════════════════════════════════════════════

/* eslint-disable @next/next/no-img-element -- thumbnails are small data URLs, not files next/image can optimize */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Eye, FilePlus2, Loader2, Lock, Share2, Store, Trash2 } from "lucide-react";
import { deleteDesign, listDesigns, openBillingPortal, type DesignLibrary, type DesignSummary, type MemberInfo } from "@/app/actions/builder";
import { Modal, ShareDialog } from "@/components/builder/BuilderDialogs";
import { MARKET_HREF, formatPrice } from "@/lib/builder/store";

function ShareBadge({ design }: { design: DesignSummary }) {
  if (design.shareMode === "sale") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
        <Store className="h-3 w-3" /> For sale · {design.priceCents ? formatPrice(design.priceCents) : ""}
      </span>
    );
  }
  if (design.shareMode === "view") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
        <Eye className="h-3 w-3" /> Shared link
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-stone-400">
      <Lock className="h-3 w-3" /> Private
    </span>
  );
}

export default function BuilderDesigns({
  token,
  member,
  currentId,
  onOpen,
  onNew,
  onDeleted,
  onClose,
}: {
  token: string | null;
  member: MemberInfo;
  /** The design open in the builder now, if it has been saved */
  currentId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  /** A design was deleted (the builder forgets it if it was the open one) */
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [library, setLibrary] = useState<DesignLibrary | null>(null);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState<DesignSummary | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listDesigns(token).catch(() => null);
    if (res?.ok) setLibrary({ designs: res.designs, owedCents: res.owedCents, paidCents: res.paidCents });
    else setError(res?.error ?? "Couldn't reach the server. Try again.");
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    setBusy(id);
    const res = await deleteDesign(token, id).catch(() => null);
    setBusy(null);
    setConfirmDelete(null);
    if (!res?.ok) return setError(res?.error ?? "Couldn't reach the server. Try again.");
    setLibrary((lib) => (lib ? { ...lib, designs: lib.designs.filter((d) => d.id !== id) } : lib));
    onDeleted(id);
  };

  const billing = async () => {
    if (!token) return;
    setBusy("billing");
    const res = await openBillingPortal(token).catch(() => null);
    if (res?.ok) window.location.href = res.url;
    else {
      setBusy(null);
      setError(res?.error ?? "Couldn't reach the server. Try again.");
    }
  };

  if (sharing) {
    return (
      <ShareDialog
        token={token}
        design={sharing}
        onChanged={(next) => setLibrary((lib) => (lib ? { ...lib, designs: lib.designs.map((d) => (d.id === next.id ? next : d)) } : lib))}
        onClose={() => setSharing(null)}
      />
    );
  }

  const earned = library ? library.owedCents + library.paidCents : 0;

  return (
    <Modal title="My designs" onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onNew}
          className="flex h-10 items-center gap-2 rounded-xl bg-yellow-400 px-4 text-xs font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300"
        >
          <FilePlus2 className="h-4 w-4" /> New design
        </button>
        <Link href={MARKET_HREF} className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-4 text-xs font-bold text-stone-200 transition hover:border-yellow-400/50 hover:text-yellow-300">
          <Store className="h-4 w-4" /> Marketplace
        </Link>
        <span className="flex-1" />
        <span className="text-[11px] text-stone-500">{member.via === "admin" ? "Admin access" : member.emailHint}</span>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-500/10 p-2.5 text-xs font-medium text-red-300">{error}</p>}

      {earned > 0 && library && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-emerald-400/10 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-emerald-300/80">Earned, not yet paid</p>
            <p className="font-mono text-lg font-bold text-emerald-300">{formatPrice(library.owedCents)}</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">Paid out</p>
            <p className="font-mono text-lg font-bold text-white">{formatPrice(library.paidCents)}</p>
          </div>
        </div>
      )}

      {!library && !error ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-yellow-400" />
        </div>
      ) : library && library.designs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-stone-400">
          Nothing saved yet. Use <strong className="text-white">Save</strong> in the builder and your design will be here, on every device.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {library?.designs.map((design) => (
            <li key={design.id} className={`overflow-hidden rounded-xl border bg-slate-950 ${design.id === currentId ? "border-yellow-400/60" : "border-slate-800"}`}>
              <button type="button" onClick={() => onOpen(design.id)} className="block w-full text-left" aria-label={`Open ${design.name}`}>
                <div className="flex aspect-[3/2] items-center justify-center bg-white">
                  {design.thumbnail ? (
                    <img src={design.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">No picture yet</span>
                  )}
                </div>
                <div className="p-3 pb-2">
                  <p className="truncate text-sm font-bold text-white">{design.name}</p>
                  <p className="text-[11px] text-stone-500">
                    {design.pieceCount} piece{design.pieceCount === 1 ? "" : "s"} · saved {new Date(design.updatedAt).toLocaleDateString()}
                    {design.id === currentId ? " · open now" : ""}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2 px-3 pb-3">
                <ShareBadge design={design} />
                {design.sales > 0 && (
                  <span className="text-[10px] font-bold text-emerald-300">
                    {design.sales} sold · {formatPrice(design.earningsCents)}
                  </span>
                )}
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => setSharing(design)}
                  className="flex h-8 items-center gap-1 rounded-lg border border-slate-700 px-2.5 text-[11px] font-bold text-stone-200 hover:border-yellow-400/50 hover:text-yellow-300"
                >
                  <Share2 className="h-3.5 w-3.5" /> Share
                </button>
                {confirmDelete === design.id ? (
                  <button
                    type="button"
                    onClick={() => remove(design.id)}
                    disabled={busy === design.id}
                    className="flex h-8 items-center gap-1 rounded-lg border border-red-400 bg-red-500/15 px-2.5 text-[11px] font-bold text-red-200"
                  >
                    {busy === design.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete it?"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(design.id)}
                    aria-label={`Delete ${design.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-stone-400 hover:border-red-400/60 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {member.via === "subscription" && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4">
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-stone-500">
            {member.cancelAtPeriodEnd
              ? `Your subscription ends ${member.renewsAt ? new Date(member.renewsAt).toLocaleDateString() : "at the end of this period"}. Your designs stay saved.`
              : member.renewsAt
                ? `Subscription renews ${new Date(member.renewsAt).toLocaleDateString()}.`
                : "Subscription active."}
          </p>
          <button
            type="button"
            onClick={billing}
            disabled={busy === "billing"}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-[11px] font-bold text-stone-200 hover:border-yellow-400/50 hover:text-yellow-300"
          >
            {busy === "billing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
            Manage billing
          </button>
        </div>
      )}
    </Modal>
  );
}
