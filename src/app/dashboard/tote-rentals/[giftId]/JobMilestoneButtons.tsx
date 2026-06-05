"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Package } from "lucide-react";

import {
  markGiftDelivered,
  markGiftReturned,
} from "@/app/actions/realtor-gift-fulfillment";

// ═══════════════════════════════════════════════════════════════════════════
// Per-job milestone buttons — shown on the detail page in the action bar.
//
// State machine:
//   assigned   → "Mark delivered"
//   delivered  → "Mark returned"
//   returned   → (no buttons; render the timeline only)
//
// On success the page reloads so the server-side data (status, timestamps,
// payout state) re-renders fresh. Reloading is cheaper than threading
// optimistic state through a deep tree for a button click that's only
// taken once per job.
// ═══════════════════════════════════════════════════════════════════════════

export function JobMilestoneButtons({
  giftId,
  status,
}: {
  giftId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== "assigned" && status !== "delivered") return null;

  function flip(target: "delivered" | "returned") {
    setError(null);
    startTransition(async () => {
      const result =
        target === "delivered"
          ? await markGiftDelivered(giftId)
          : await markGiftReturned(giftId);
      if (!result.ok) {
        setError(result.error ?? "Could not update the job. Try again.");
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {status === "assigned" && (
          <button
            onClick={() => flip("delivered")}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            Mark delivered
          </button>
        )}
        {status === "delivered" && (
          <button
            onClick={() => flip("returned")}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Mark returned &amp; trigger payout
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
