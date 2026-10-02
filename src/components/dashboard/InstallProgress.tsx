"use client";

import { useCallback, useEffect, useState } from "react";
import { Truck, Check, Loader2, Link, Eye, BellRing, Undo2 } from "lucide-react";
import { getInstallTracking, setInstallStage, type InstallTrackingState } from "@/app/actions/install-tracking";

// ═══════════════════════════════════════════════════════════════════════════
// InstallProgress — Job Ticket panel for manual install steps
//
// The installer taps Built → Loaded → On the Way; each step emails the
// customer a "Track your install" link (their /track page updates too). The
// customer also gets an automatic reminder the day before the install.
// Hidden until migration 141 is applied (getInstallTracking fails).
// ═══════════════════════════════════════════════════════════════════════════

const STEPS: Array<{ id: "built" | "loaded" | "on_the_way"; label: string }> = [
  { id: "built", label: "Built" },
  { id: "loaded", label: "Loaded" },
  { id: "on_the_way", label: "On the Way" },
];

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function InstallProgress({
  leadId,
  customerEmail,
  scheduledAt,
}: {
  leadId: string;
  customerEmail: string | null;
  scheduledAt: string | null;
}) {
  const [state, setState] = useState<InstallTrackingState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    getInstallTracking(leadId).then((r) => {
      if (r.success && r.tracking) setState(r.tracking);
    });
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!state) return null;

  const currentIndex = STEPS.findIndex((s) => s.id === state.stage);

  async function mark(stage: "built" | "loaded" | "on_the_way" | null) {
    setBusy(stage ?? "undo");
    setMessage(null);
    const r = await setInstallStage(leadId, stage);
    setBusy(null);
    if (!r.success) {
      setMessage({ ok: false, text: r.error || "Couldn't save." });
      return;
    }
    if (stage) {
      setMessage({
        ok: true,
        text: r.emailed
          ? `Marked ${STEPS.find((s) => s.id === stage)?.label}. ${customerEmail ? "Customer emailed." : ""}`
          : `Marked ${STEPS.find((s) => s.id === stage)?.label}.${customerEmail ? "" : " No customer email on file."}`,
      });
    }
    load();
  }

  async function copyLink() {
    if (!state?.trackUrl) return;
    await navigator.clipboard.writeText(state.trackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const scheduledDate = scheduledAt?.slice(0, 10) ?? null;
  const reminderSent = !!scheduledDate && state.reminderFor?.slice(0, 10) === scheduledDate;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
          <Truck className="h-4 w-4 text-yellow-400" />
          Install Progress
        </h2>
        {state.stage && (
          <button
            onClick={() => mark(null)}
            disabled={!!busy}
            className="flex items-center gap-1 text-[10px] font-semibold text-stone-500 hover:text-stone-300 disabled:opacity-50"
          >
            <Undo2 className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {STEPS.map((step, i) => {
          const done = i <= currentIndex;
          return (
            <button
              key={step.id}
              onClick={() => mark(step.id)}
              disabled={!!busy || done}
              className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-bold transition-colors ${
                done
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-yellow-400/30 bg-yellow-400/5 text-yellow-400 hover:bg-yellow-400/15"
              } disabled:cursor-default`}
            >
              {busy === step.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : done ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {step.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-stone-500">
        Each step emails the customer a link to track their install.
      </p>

      {message && (
        <p className={`mt-2 text-[11px] ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
      )}

      <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-3 text-[11px] text-stone-400">
        <p className="flex items-center gap-1.5">
          <BellRing className="h-3 w-3 text-stone-500" />
          {!scheduledDate
            ? "Day-before reminder goes out once an install date is set."
            : reminderSent
              ? "Day-before reminder sent."
              : "Customer gets a reminder email the day before the install."}
        </p>
        <p className="flex items-center gap-1.5">
          <Eye className="h-3 w-3 text-stone-500" />
          {state.viewedAt ? `Customer opened their tracking page ${fmtWhen(state.viewedAt)}.` : "Customer hasn't opened their tracking page yet."}
        </p>
        {state.trackUrl && (
          <button onClick={copyLink} className="flex items-center gap-1.5 font-semibold text-yellow-400 hover:text-yellow-300">
            <Link className="h-3 w-3" />
            {copied ? "Copied!" : "Copy tracking link"}
          </button>
        )}
      </div>
    </section>
  );
}
