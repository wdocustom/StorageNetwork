"use client";

import { useState, useEffect } from "react";
import {
  Link2,
  Copy,
  Check,
  Megaphone,
  Bell,
  ChevronRight,
  ExternalLink,
  X,
} from "lucide-react";
import SocialGenerator from "@/components/dashboard/SocialGenerator";
import { getInstallerLink } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// Quick Start Guide — New installer onboarding widget
// Shows only when completedJobs === 0. Teaches them to use their link.
// ═══════════════════════════════════════════════════════════════════════════

interface MissionBriefingProps {
  userId: string;
  slug?: string | null;
  isPro?: boolean;
}

const STEPS = [
  {
    id: 1,
    icon: Link2,
    label: "Get Link",
  },
  {
    id: 2,
    icon: Megaphone,
    label: "Promote",
  },
  {
    id: 3,
    icon: Bell,
    label: "Next Steps",
  },
] as const;

const STORAGE_KEY = "quickstart_dismissed";

export default function MissionBriefing({ userId, slug, isPro }: MissionBriefingProps) {
  const [activeStep, setActiveStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash

  // Hydrate from localStorage — show only if never dismissed
  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  if (dismissed) return null;

  // Use the centralized link generator (handles Pro/Basic links)
  const bookingLink = getInstallerLink({ id: userId, slug, is_pro: isPro });

  function copyLink() {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-yellow-400/20 bg-gradient-to-b from-slate-900 to-slate-900/80 p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">
            Quick Start Guide
          </p>
          <p className="text-sm font-bold text-white">
            Get your first booking
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded-lg p-1.5 text-stone-600 transition-colors hover:bg-slate-800 hover:text-stone-400"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Step Bubbles */}
      <div className="mb-5 flex items-center gap-2">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <button
              onClick={() => setActiveStep(step.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                activeStep === step.id
                  ? "bg-yellow-400 text-gray-950"
                  : "bg-slate-800 text-stone-500 hover:bg-slate-700 hover:text-stone-300"
              }`}
            >
              <step.icon className="h-3 w-3" />
              {step.label}
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 text-stone-700" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[140px]">
        {/* ── Step 1: Get Link ───────────────────────────────────── */}
        {activeStep === 1 && (
          <div>
            <p className="mb-3 text-sm text-stone-400">
              This is your personal booking link. Every customer who orders
              through it is tracked as{" "}
              <span className="font-semibold text-white">your lead</span>.
            </p>
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
              <p className="mb-3 select-all break-all text-xs font-medium text-blue-400">
                {bookingLink}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 rounded bg-yellow-400 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy Link
                    </>
                  )}
                </button>
                <a
                  href={bookingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded border border-slate-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-slate-700"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Link
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Promote ────────────────────────────────────── */}
        {activeStep === 2 && (
          <div>
            <p className="mb-3 text-sm text-stone-400">
              Share a professional post on Instagram, Facebook, or send via SMS.
            </p>
            <SocialGenerator bookingLink={bookingLink} compact />
          </div>
        )}

        {/* ── Step 3: Next Steps ─────────────────────────────────── */}
        {activeStep === 3 && (
          <div>
            <p className="mb-3 text-sm text-stone-400">
              Once a client books through your link, here&apos;s what happens:
            </p>
            <div className="space-y-2">
              {[
                "You receive a booking notification via email.",
                "The job appears in your Jobs tab with a Cut List and Material Guide.",
                "Show up, build, tap \"Complete\" to collect the balance.",
              ].map((text, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400/10 text-[10px] font-bold text-yellow-400">
                    {i + 1}
                  </span>
                  <p className="text-sm text-stone-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
