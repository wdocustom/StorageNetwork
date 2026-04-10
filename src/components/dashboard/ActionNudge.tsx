"use client";

import { useState, useEffect } from "react";
import {
  Megaphone,
  Briefcase,
  HardHat,
  Trophy,
  Link2,
  Users,
  X,
} from "lucide-react";
import { getDashboardNudge, type DashboardNudge } from "@/app/actions/dashboard-nudge";

// ═══════════════════════════════════════════════════════════════════════════
// Action Nudge — Contextual coaching card
//
// Shows the single most relevant next action for the installer.
// Dismiss = snooze for 48 hours (localStorage), not permanent.
// Re-appears with a fresh nudge after the snooze expires.
// ═══════════════════════════════════════════════════════════════════════════

const SNOOZE_KEY = "nudge_snoozed_until";
const SNOOZE_HOURS = 48;

const ICON_MAP = {
  megaphone: Megaphone,
  briefcase: Briefcase,
  hardhat: HardHat,
  trophy: Trophy,
  link: Link2,
  users: Users,
} as const;

const COLOR_MAP: Record<string, string> = {
  megaphone: "text-amber-400 bg-amber-400/10",
  briefcase: "text-yellow-400 bg-yellow-400/10",
  hardhat: "text-blue-400 bg-blue-400/10",
  trophy: "text-emerald-400 bg-emerald-400/10",
  link: "text-purple-400 bg-purple-400/10",
  users: "text-cyan-400 bg-cyan-400/10",
};

interface ActionNudgeProps {
  userId: string;
}

export default function ActionNudge({ userId }: ActionNudgeProps) {
  const [nudge, setNudge] = useState<DashboardNudge | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check snooze
    const snoozedUntil = localStorage.getItem(SNOOZE_KEY);
    if (snoozedUntil && Date.now() < Number(snoozedUntil)) {
      return; // Still snoozed
    }

    getDashboardNudge(userId)
      .then((n) => {
        if (n) {
          setNudge(n);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, [userId]);

  function handleDismiss() {
    const until = Date.now() + SNOOZE_HOURS * 60 * 60 * 1000;
    localStorage.setItem(SNOOZE_KEY, String(until));
    setVisible(false);
  }

  if (!visible || !nudge) return null;

  const Icon = ICON_MAP[nudge.icon] || Megaphone;
  const colorClass = COLOR_MAP[nudge.icon] || "text-yellow-400 bg-yellow-400/10";

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800/50 p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-white">{nudge.title}</p>
            <button
              onClick={handleDismiss}
              className="shrink-0 rounded-lg p-1 text-stone-600 transition-colors hover:bg-slate-800 hover:text-stone-400"
              title="Dismiss for 48 hours"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-stone-400">{nudge.message}</p>
          <a
            href={nudge.ctaHref}
            className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-yellow-400 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
          >
            {nudge.ctaLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
