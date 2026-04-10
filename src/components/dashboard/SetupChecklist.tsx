"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Rocket,
  Loader2,
} from "lucide-react";
import { getSetupStatus, type SetupStatus } from "@/app/actions/setup-checklist";

// ═══════════════════════════════════════════════════════════════════════════
// Setup Checklist — Persistent onboarding tracker
//
// DB-driven (not localStorage). Shows real milestone completion.
// Stays visible until ALL steps are done. Cannot be permanently dismissed.
// Replaces the old MissionBriefing widget.
// ═══════════════════════════════════════════════════════════════════════════

interface SetupChecklistProps {
  userId: string;
}

export default function SetupChecklist({ userId }: SetupChecklistProps) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    getSetupStatus(userId)
      .then((s) => {
        setStatus(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!status || status.allComplete) return null;

  const progressPct = Math.round((status.completedCount / status.totalSteps) * 100);
  // Find the first incomplete step to highlight
  const nextStep = status.steps.find((s) => !s.completed);

  return (
    <div className="rounded-2xl border border-yellow-400/20 bg-gradient-to-b from-slate-900 to-slate-900/80 p-5">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/15">
            <Rocket className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">
              Get Started
            </p>
            <p className="text-[10px] text-stone-500">
              {status.completedCount} of {status.totalSteps} complete
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-yellow-400">{progressPct}%</span>
          <ChevronRight
            className={`h-4 w-4 text-stone-500 transition-transform ${collapsed ? "" : "rotate-90"}`}
          />
        </div>
      </button>

      {/* Progress Bar */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-yellow-400 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="mt-4 space-y-1">
          {status.steps.map((step) => {
            const isNext = step.id === nextStep?.id;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  isNext
                    ? "bg-yellow-400/5 border border-yellow-400/20"
                    : step.completed
                      ? "opacity-60"
                      : ""
                }`}
              >
                {step.completed ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-stone-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      step.completed ? "text-stone-400 line-through" : "text-white"
                    }`}
                  >
                    {step.label}
                  </p>
                  {isNext && (
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      {step.description}
                    </p>
                  )}
                </div>
                {!step.completed && (
                  <a
                    href={step.ctaHref}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                      isNext
                        ? "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                        : "bg-slate-800 text-stone-400 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    {step.ctaLabel}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
