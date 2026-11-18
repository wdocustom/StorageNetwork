"use client";

import { Gift } from "lucide-react";
import { REFUND_GIVEAWAY, giveawayStatus } from "@/lib/refund-giveaway";

// ═══════════════════════════════════════════════════════════════════════════
// Holiday Full Refund Giveaway — the reminder shown where people pay.
//   card  above the "Get my plans" button in the plans designer
//   bar   a strip at the top of the secure checkout window
// Renders nothing outside the promotion dates. Always carries "No purchase
// necessary" and the Official Rules link, as the rules require.
// ═══════════════════════════════════════════════════════════════════════════

function RulesLink() {
  return (
    <a
      href={REFUND_GIVEAWAY.rulesPath}
      target="_blank"
      rel="noopener"
      className="font-semibold text-yellow-400 underline underline-offset-2 hover:text-yellow-300"
    >
      Official Rules
    </a>
  );
}

export default function GiveawayNote({ variant = "card", className = "" }: { variant?: "card" | "bar"; className?: string }) {
  if (giveawayStatus() !== "active") return null;

  if (variant === "bar") {
    return (
      <div className={`flex shrink-0 items-center gap-2.5 border-b border-yellow-400/20 bg-yellow-400/10 px-4 py-2 ${className}`}>
        <Gift className="h-4 w-4 shrink-0 text-yellow-400" aria-hidden />
        <p className="text-[11px] leading-snug text-stone-300">
          <strong className="text-white">Holiday surprise:</strong> several random buyers get a full refund, every day.
          No purchase necessary. <RulesLink />
        </p>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3.5 py-3 ${className}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400/15">
        <Gift className="h-4 w-4 text-yellow-400" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-snug text-white">
          Holiday surprise: several random buyers get a <span className="text-yellow-400">full refund</span>, every day.
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-stone-400">
          Refunds go out daily, and you keep your plans. No purchase necessary. <RulesLink />
        </p>
      </div>
    </div>
  );
}
