"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Installer dashboard tour: the controller and the card.
//
// Mounted once in DashboardShell, so it survives moving between dashboard
// pages: a step can be on Today, the next on Settings, the next on the tab
// bar. Steps live in ./tourSteps.ts.
//
// How a step moves on:
//   tap  — a capture-phase click listener matches the step's data-tour
//          target. Capture phase, so the real control underneath still does
//          its own job (the PRO pill still copies, the gear still opens
//          Settings).
//   next — the Next button in the card.
//
// Starts on its own once per installer (see lib/server/dashboard-tour), and
// again from More → "Take the tour" (/dashboard?tour=1). The current step is
// kept in sessionStorage so a refresh mid-tour picks up where it was.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { endDashboardTour } from "@/app/actions/dashboard-tour";
import { INSTALLER_TOUR_STEPS, type TourStep } from "./tourSteps";

const STORAGE_KEY = "sn-dashboard-tour-step";
/** A target still not on screen after this long is treated as not there for this installer. */
const MISSING_AFTER_MS = 2000;
/** Off the step's page this long (they wandered off, or a page is slow) → offer to resume. */
const PAUSED_AFTER_MS = 4000;

function readStoredStep(count: number): number | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n < count ? n : null;
  } catch {
    return null;
  }
}
function storeStep(i: number | null) {
  try {
    if (i === null) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, String(i));
  } catch {
    /* private mode — the tour just won't survive a refresh */
  }
}

/** The on-screen copy of a data-tour target. The nav exists twice (phone tab bar + desktop sidebar), one hidden. */
function findTarget(target: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * Tracks the target's position every animation frame (so the highlight moves
 * with the smooth scroll instead of lagging behind it) and scrolls it into
 * view once. `missing` flips true if it never shows up.
 */
function useTargetRect(target: string | null, enabled: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    setRect(null);
    setMissing(false);
    if (!target || !enabled) return;
    let raf = 0;
    let cancelled = false;
    let found = false;
    let scrolled = false;
    const missTimer = setTimeout(() => {
      if (!found && !cancelled) setMissing(true);
    }, MISSING_AFTER_MS);
    const tick = () => {
      if (cancelled) return;
      const el = findTarget(target);
      if (el) {
        found = true;
        setMissing(false);
        const r = el.getBoundingClientRect();
        setRect(r);
        if (!scrolled) {
          scrolled = true;
          // Tall targets (an opened pricing section) scroll to their top, not their middle.
          el.scrollIntoView?.({ behavior: "smooth", block: r.height > window.innerHeight * 0.6 ? "start" : "center" });
        }
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      clearTimeout(missTimer);
      cancelAnimationFrame(raf);
    };
  }, [target, enabled]);
  return { rect, missing };
}

export default function DashboardTour({ autoStart, steps: STEPS = INSTALLER_TOUR_STEPS }: { autoStart: boolean; steps?: TourStep[] }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const autoStartedRef = useRef(false);
  const endedRef = useRef(false);

  const step: TourStep | null = stepIndex === null ? null : STEPS[stepIndex];
  const onRoute = !!step && (!step.route || pathname === step.route);

  const go = useCallback((i: number | null) => {
    setStepIndex(i);
    storeStep(i);
    setPaused(false);
  }, []);

  const end = useCallback(
    (completed: boolean) => {
      if (stepIndex === null) return;
      const s = STEPS[stepIndex];
      endedRef.current = true;
      go(null);
      endDashboardTour({ completed, step: s.id, stepIndex }).catch(() => {
        /* best effort — worst case it's offered again next visit */
      });
    },
    [stepIndex, go],
  );

  const advance = useCallback(
    (navigate: boolean) => {
      if (stepIndex === null) return;
      const nextIndex = stepIndex + 1;
      if (nextIndex >= STEPS.length) return end(true);
      go(nextIndex);
      // A tap already navigates on its own (the gear, a tab). A Next press
      // doesn't, so take them to the next step's page ourselves.
      const nextRoute = STEPS[nextIndex].route;
      if (navigate && nextRoute && nextRoute !== pathname) router.push(nextRoute);
    },
    [stepIndex, end, go, pathname, router, STEPS],
  );

  // Start: resume a tour from before a refresh, the retake link, or the once-per-installer auto start.
  useEffect(() => {
    if (stepIndex !== null) return;
    const params = new URLSearchParams(window.location.search);
    if (pathname === "/dashboard" && params.get("tour") === "1") {
      params.delete("tour");
      const qs = params.toString();
      window.history.replaceState(window.history.state, "", `/dashboard${qs ? `?${qs}` : ""}`);
      endedRef.current = false;
      go(0);
      return;
    }
    const stored = readStoredStep(STEPS.length);
    if (stored !== null && !endedRef.current) {
      go(stored);
      return;
    }
    if (autoStart && !autoStartedRef.current && !endedRef.current && pathname === "/dashboard") {
      autoStartedRef.current = true;
      go(0);
    }
  }, [pathname, autoStart, stepIndex, go, STEPS.length]);

  // Tap steps: move on when the real control is tapped.
  useEffect(() => {
    if (!step || step.advance !== "tap" || !step.target) return;
    const target = step.target;
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.(`[data-tour="${target}"]`)) advance(false);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step, advance]);

  // Off the step's page for a while → offer to pick the tour back up.
  useEffect(() => {
    setPaused(false);
    if (!step || onRoute) return;
    const t = setTimeout(() => setPaused(true), PAUSED_AFTER_MS);
    return () => clearTimeout(t);
  }, [step, onRoute]);

  // Escape skips the tour.
  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, end]);

  const { rect, missing } = useTargetRect(step?.target ?? null, onRoute);

  // A step that only makes sense when its target is there (a dismissed checklist) skips itself.
  useEffect(() => {
    if (step?.skipIfMissing && missing) advance(false);
  }, [step, missing, advance]);

  if (!step || stepIndex === null) return null;

  const total = STEPS.length;
  const isLast = !!step.last || stepIndex === total - 1;

  if (!onRoute) {
    if (!paused) return null;
    return (
      <Card
        step={step}
        stepIndex={stepIndex}
        total={total}
        style={{ position: "fixed", left: 12, right: 12, bottom: "calc(5rem + env(safe-area-inset-bottom))", margin: "0 auto", maxWidth: 360 }}
        title="Tour paused"
        body="Pick up where you left off?"
        primary={{ label: "Continue tour", onClick: () => step.route && router.push(step.route) }}
        onSkip={() => end(false)}
        skipLabel="End tour"
      />
    );
  }

  // Centred card: bookends, and targets that aren't on screen for this installer.
  if (!step.target || (!rect && missing)) {
    if (step.target && step.skipIfMissing) return null;
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-4">
        <Card
          step={step}
          stepIndex={stepIndex}
          total={total}
          style={{ width: "100%", maxWidth: 360 }}
          body={step.target ? (step.missingBody ?? step.body) : step.body}
          primary={{
            label: stepIndex === 0 ? "Start" : isLast ? "Finish" : "Next",
            onClick: () => (isLast ? end(true) : advance(true)),
          }}
          onSkip={isLast ? undefined : () => end(false)}
          onClose={() => end(false)}
        />
      </div>
    );
  }

  // Waiting a beat for the target to render.
  if (!rect) return null;

  // No CSS transition on the ring: it's re-measured every frame to track the scroll.
  const pad = 6;
  const ring: React.CSSProperties = {
    position: "fixed",
    zIndex: 70,
    pointerEvents: "none",
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    borderRadius: 14,
    boxShadow: "0 0 0 2px #facc15, 0 0 0 9999px rgba(2, 6, 23, 0.65)",
  };

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(340, vw - 24);
  const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, 12), vw - width - 12);
  const CARD_ROOM = 220;
  const callout: React.CSSProperties = { position: "fixed", zIndex: 71, width, left };
  if (vh - rect.bottom >= CARD_ROOM) callout.top = rect.bottom + pad + 10;
  else if (rect.top >= CARD_ROOM) callout.bottom = vh - rect.top + pad + 10;
  // Target fills the screen (an opened section): pin the card above the tab bar.
  else callout.bottom = vw >= 1024 ? 16 : 84;

  return (
    <>
      <div style={ring}>
        {step.advance === "tap" && <div className="absolute inset-0 animate-pulse rounded-[14px] ring-4 ring-yellow-400/40" />}
      </div>
      <Card
        step={step}
        stepIndex={stepIndex}
        total={total}
        style={callout}
        body={step.body}
        primary={
          step.advance === "next"
            ? { label: isLast ? "Finish" : "Next", onClick: () => (isLast ? end(true) : advance(true)) }
            : undefined
        }
        onSkip={isLast ? undefined : () => end(false)}
        onClose={() => end(false)}
      />
    </>
  );
}

function Card({
  step,
  stepIndex,
  total,
  style,
  title,
  body,
  primary,
  onSkip,
  skipLabel = "Skip tour",
  onClose,
}: {
  step: TourStep;
  stepIndex: number;
  total: number;
  style: React.CSSProperties;
  title?: string;
  body: string;
  primary?: { label: string; onClick: () => void };
  onSkip?: () => void;
  skipLabel?: string;
  onClose?: () => void;
}) {
  const titleId = `tour-${step.id}`;
  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="false"
      style={{ zIndex: 71, ...style }}
      className="relative rounded-2xl border border-yellow-400/30 bg-slate-900 p-4 shadow-2xl shadow-black/50"
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tour"
          className="absolute right-2.5 top-2.5 rounded-md p-1 text-stone-500 transition hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-slate-800" style={{ marginRight: onClose ? 28 : 0 }}>
        <div className="h-full rounded-full bg-yellow-400 transition-[width] duration-300" style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
        {stepIndex + 1} of {total}
      </p>
      <h3 id={titleId} className="mt-1 text-sm font-black text-white">
        {title ?? step.title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-stone-300">{body}</p>
      <div className="mt-3 flex items-center gap-3">
        {primary ? (
          <button
            type="button"
            onClick={primary.onClick}
            autoFocus
            className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-yellow-300 active:scale-95"
          >
            {primary.label}
            {primary.label !== "Finish" && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <p className="flex items-center gap-2 text-xs font-semibold text-yellow-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-400" />
            </span>
            Tap the highlighted button
          </p>
        )}
        {onSkip && (
          <button type="button" onClick={onSkip} className="ml-auto text-xs font-semibold text-stone-500 transition hover:text-white">
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}
