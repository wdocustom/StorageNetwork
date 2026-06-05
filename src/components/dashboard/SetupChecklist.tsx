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
// DB-driven for most steps. Low-stakes "nudge" steps (Instagram follow,
// booking link copy) also persist to localStorage as a belt-and-suspenders
// so they stay dismissed even when the server insert fails silently
// (stale auth sessions, RLS edge cases, etc).
// ═══════════════════════════════════════════════════════════════════════════

// ── Local overrides: steps that stay "done" per-device even if the
//    server never confirmed the write. Keyed by userId so a second
//    installer on the same browser doesn't inherit the first user's state.
const localKey = (stepId: string, userId: string) => `sn-checklist-${stepId}-${userId}`;

function hasLocalOverride(stepId: string, userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(localKey(stepId, userId)) === "1";
  } catch {
    return false;
  }
}

function setLocalOverride(stepId: string, userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localKey(stepId, userId), "1");
  } catch {
    // Ignore quota/private-mode errors — worst case we fall back to server state
  }
}

// Steps that can be dismissed client-side (low-stakes nudges)
const LOCAL_OVERRIDE_STEPS = ["visit_instagram", "copy_link"] as const;

function applyLocalOverrides(status: SetupStatus, userId: string): SetupStatus {
  const updatedSteps = status.steps.map((s) => {
    if (s.completed) return s;
    if ((LOCAL_OVERRIDE_STEPS as readonly string[]).includes(s.id) && hasLocalOverride(s.id, userId)) {
      return { ...s, completed: true };
    }
    return s;
  });
  const completedCount = updatedSteps.filter((s) => s.completed).length;
  return {
    ...status,
    steps: updatedSteps,
    completedCount,
    allComplete: completedCount === status.totalSteps,
  };
}

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
        .then((s) => { if (mounted) { setStatus(applyLocalOverrides(s, userId)); setLoading(false); } })
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
      // localStorage flag — persists regardless of server sync
      setLocalOverride("copy_link", userId);
      setJustCompleted("copy_link");

      try {
        navigator.clipboard.writeText(bookingLink);
      } catch {
        // Clipboard API may fail in non-secure contexts
      }

      // Best-effort server sync (for cross-device visibility + admin analytics)
      completeChecklistStep(userId, "copy_link").then((ok) => {
        if (!ok) logActivityClient({ action: "copy_link", pagePath: "/dashboard" });
      });

      // Re-apply overrides so the UI updates even if server refresh hasn't run
      setStatus((prev) => (prev ? applyLocalOverrides(prev, userId) : prev));
      return true;
    }

    if (stepId === "visit_instagram") {
      // localStorage flag — this is the authoritative source. Cannot fail.
      setLocalOverride("visit_instagram", userId);
      setJustCompleted("visit_instagram");

      window.open("https://www.instagram.com/storagenetwork.app/", "_blank", "noopener");

      // Best-effort server sync (non-blocking, failure is fine)
      completeChecklistStep(userId, "instagram_visited").then((ok) => {
        if (!ok) logActivityClient({ action: "instagram_visited", pagePath: "/dashboard" });
      }).catch(() => {});

      // Re-apply overrides immediately so the UI updates
      setStatus((prev) => (prev ? applyLocalOverrides(prev, userId) : prev));
      return true;
    }

    return false; // navigate to CTA page
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!status || status.allComplete) return null;

  const progressPct = Math.round((status.completedCount / status.totalSteps) * 100);
  // Find the first incomplete step to highlight
  const nextStep = status.steps.find((s) => !s.completed);

  return (
    <div className="rounded-2xl border border-yellow-400/20 bg-gradient-to-b from-zinc-900 to-zinc-900/80 p-5">
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
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
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
                        : "bg-zinc-800 text-stone-400 hover:bg-zinc-700 hover:text-white"
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
