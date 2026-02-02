"use client";

import { useState } from "react";
import {
  Link2,
  Copy,
  Check,
  Megaphone,
  Radio,
  ChevronRight,
  X,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Mission Briefing — New installer onboarding guide
// Shows only when completedJobs === 0. Teaches them to deploy their link.
// ═══════════════════════════════════════════════════════════════════════════

interface MissionBriefingProps {
  userId: string;
}

const STEPS = [
  {
    id: 1,
    icon: Link2,
    label: "EQUIP YOUR LINK",
    short: "Equip",
  },
  {
    id: 2,
    icon: Megaphone,
    label: "ENGAGE TARGETS",
    short: "Engage",
  },
  {
    id: 3,
    icon: Radio,
    label: "STANDBY FOR ORDERS",
    short: "Standby",
  },
] as const;

export default function MissionBriefing({ userId }: MissionBriefingProps) {
  const [activeStep, setActiveStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const bookingLink = `${baseUrl}/design?installer_id=${userId}`;

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
            Mission Briefing
          </p>
          <p className="text-sm font-bold text-white">Deploy Your Asset</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
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
              {step.short}
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 text-stone-700" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[120px]">
        {activeStep === 1 && (
          <div>
            <p className="mb-3 text-sm text-stone-400">
              This is your personal booking link. Every customer who orders
              through it is tracked as <span className="font-semibold text-white">your lead</span>.
            </p>
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
              <p className="mb-2 select-all break-all text-xs font-medium text-blue-400">
                {bookingLink}
              </p>
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
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div>
            <p className="mb-3 text-sm text-stone-400">
              Post on Instagram, Facebook, or text it directly to clients.
            </p>
            {/* Mock Instagram Story */}
            <div className="rounded-xl border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600" />
                <div>
                  <p className="text-xs font-bold text-white">your_business</p>
                  <p className="text-[10px] text-stone-500">Instagram Story</p>
                </div>
              </div>
              <div className="rounded-lg bg-slate-950/50 p-3">
                <p className="text-xs leading-relaxed text-stone-300">
                  &ldquo;I am now a <span className="font-bold text-yellow-400">Certified Storage
                  Network Installer</span>. Need garage shelving? DM me or tap
                  the link to design your build and book instantly.&rdquo;
                </p>
              </div>
              <p className="mt-2 text-[10px] text-stone-600">
                Pro tip: Post a photo of your truck, tools, or a finished job.
              </p>
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div>
            <p className="mb-3 text-sm text-stone-400">
              When a client books through your link, here&apos;s what happens:
            </p>
            <div className="space-y-2">
              {[
                "You get an email alert with the job details.",
                "The job appears in your Jobs / Leads tab with a Cut List.",
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
