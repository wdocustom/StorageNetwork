"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, X, Trash2 } from "lucide-react";

import { cancelRealtorGift } from "@/app/actions/realtor-gifts";

// ═══════════════════════════════════════════════════════════════════════════
// Cancel-gift button — small inline trigger on the gifts list rows.
//
// Statuses considered cancellable by the realtor (must match the action's
// CANCELLABLE_BY_REALTOR set). Once a gift hits 'assigned' the installer
// is committed and the realtor sees no button — admin must intervene.
// ═══════════════════════════════════════════════════════════════════════════

const CANCELLABLE = new Set(["pending_payment", "paid", "redeemed", "scheduled"]);

export function CancelGiftButton({
  giftId,
  status,
  recipientName,
  refundable,
}: {
  giftId: string;
  status: string;
  recipientName: string;
  /** Whether a refund will actually fire (false for pending_payment, true
   *  for paid/redeemed/scheduled). The modal copy adjusts so the realtor
   *  knows whether money will move. */
  refundable: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Hide entirely if status isn't cancellable by this surface.
  if (!CANCELLABLE.has(status)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-[11px] font-semibold text-stone-300 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-300"
        title="Cancel this gift"
      >
        Cancel
      </button>
      {open && (
        <CancelConfirmModal
          giftId={giftId}
          recipientName={recipientName}
          refundable={refundable}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CancelConfirmModal({
  giftId,
  recipientName,
  refundable,
  onClose,
}: {
  giftId: string;
  recipientName: string;
  refundable: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelRealtorGift(giftId, reason.trim() || undefined);
      if (!result.ok) {
        setError(result.error ?? "Could not cancel.");
        return;
      }
      // Pull fresh server data — the row will re-render with status='cancelled'
      // and the button will disappear.
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      onClick={(e) => {
        if (!pending && e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-10"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-red-500/40 bg-slate-950 p-6 shadow-2xl">
        <button
          onClick={onClose}
          disabled={pending}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1 text-stone-500 hover:bg-slate-800 hover:text-stone-200 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-full bg-red-500/10 p-2 ring-1 ring-red-400/40">
            <AlertTriangle className="h-5 w-5 text-red-300" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Cancel gift?</h3>
            <p className="text-xs text-stone-400">
              For {recipientName}
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm text-stone-300">
          {refundable
            ? "We'll issue a full refund to your card and email the recipient to let them know."
            : "This gift hasn't been charged yet — there's nothing to refund. The recipient will be notified."}
        </p>

        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
          Reason (optional, shown to the recipient)
        </label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          disabled={pending}
          placeholder="e.g. Closing fell through — we'll reschedule"
          className="mb-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none"
        />
        <p className="mb-4 text-right text-[10px] text-stone-500">{reason.length}/500</p>

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-300 hover:bg-slate-800 disabled:opacity-40"
          >
            Keep gift
          </button>
          <button
            onClick={handleConfirm}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {refundable ? "Cancel + refund" : "Cancel gift"}
          </button>
        </div>
      </div>
    </div>
  );
}
