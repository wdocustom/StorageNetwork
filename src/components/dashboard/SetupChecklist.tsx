"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Rocket,
  Loader2,
  Check,
} from "lucide-react";
import { getSetupStatus, completeChecklistStep, type SetupStatus } from "@/app/actions/setup-checklist";
import { logActivityClient } from "@/lib/activity-client";

// ═══════════════════════════════════════════════════════════════════════════
// Setup Checklist — Persistent onboarding tracker
//
// DB-driven (not localStorage). Shows real milestone completion.
// Stays visible until ALL steps are done. Cannot be permanently dismissed.
// Replaces the old MissionBriefing widget.
// ═══════════════════════════════════════════════════════════════════════════

interface SetupChecklistProps {
  userId: string;
  bookingLink?: string;
}

export default function SetupChecklist({ userId, bookingLink }: SetupChecklistProps) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  // Fetch on mount, re-fetch on window focus, and re-fetch when any activity is logged
  // (e.g. group_finder_used from GroupFinder, social_share from SocialGenerator)
  useEffect(() => {
    let mounted = true;
    function refresh() {
      getSetupStatus(userId)
        .then((s) => { if (mounted) { setStatus(s); setLoading(false); } })
        .catch(() => { if (mounted) setLoading(false); });
    }
    refresh();
    function onFocus() { refresh(); }
    // Activity events are dispatched by logActivityClient after a successful insert
    function onActivity() { setTimeout(refresh, 300); }
    window.addEventListener("focus", onFocus);
    window.addEventListener("installer-activity-logged", onActivity);
    return () => { mounted = false; window.removeEventListener("focus", onFocus); window.removeEventListener("installer-activity-logged", onActivity); };
  }, [userId]);

  // Handle inline actions that can be completed directly on the checklist
  function handleStepAction(stepId: string): boolean {
    if (stepId === "copy_link" && bookingLink) {
      setJustCompleted("copy_link");

      try {
        navigator.clipboard.writeText(bookingLink);
      } catch {
        // Clipboard API may fail in non-secure contexts
      }

      // Use server action (service_role) — immune to stale browser auth sessions
      completeChecklistStep(userId, "copy_link").then((ok) => {
        if (!ok) {
          logActivityClient({ action: "copy_link", pagePath: "/dashboard" });
        }
        // Refresh checklist from server to reflect completion
        setTimeout(() => {
          getSetupStatus(userId)
            .then((s) => { if (s) setStatus(s); })
            .catch(() => {});
        }, 300);
      });

      return true;
    }

    if (stepId === "visit_instagram") {
      setJustCompleted("visit_instagram");
      setStatus((prev) => {
        if (!prev) return prev;
        const updatedSteps = prev.steps.map((s) =>
          s.id === "visit_instagram" ? { ...s, completed: true } : s
        );
        const completedCount = updatedSteps.filter((s) => s.completed).length;
        return {
          ...prev,
          steps: updatedSteps,
          completedCount,
          allComplete: completedCount === prev.totalSteps,
        };
      });
      window.open("https://www.instagram.com/storagenetwork.app/", "_blank", "noopener");
      // Use server action (service_role) — immune to stale browser auth sessions
      completeChecklistStep(userId, "instagram_visited").then((ok) => {
        if (!ok) {
          // Fallback to browser client if server action fails
          logActivityClient({ action: "instagram_visited", pagePath: "/dashboard" });
        }
      });
      return true;
    }

    return false; // navigate to CTA page
  }

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
                {!step.completed && justCompleted === step.id ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-400/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    <Check className="h-3 w-3" /> Done
                  </span>
                ) : !step.completed ? (
                  <button
                    onClick={() => {
                      const handled = handleStepAction(step.id);
                      if (!handled) {
                        window.location.href = step.ctaHref;
                      }
                    }}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                      isNext
                        ? "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                        : "bg-slate-800 text-stone-400 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    {step.ctaLabel}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
