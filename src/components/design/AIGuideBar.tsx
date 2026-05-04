"use client";

import { Sparkles } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// AI Guide Bar — contextual single-line nudge per configurator step
//
// Mobile: renders sticky below the 3D canvas (inside the scroll container)
// Desktop: renders at the top of the sidebar
// ═══════════════════════════════════════════════════════════════════════════

const GUIDE_TEXT: Record<number, string> = {
  1: "Your free 3D design takes 30 seconds. Start with your wall size.",
  2: "Great choice! Pick a tote style that fits your needs.",
  3: "Almost done — add the finishing touches to your build.",
  4: "Your design is saved. Fill in your info to lock in pricing.",
};

export default function AIGuideBar({ activeStep }: { activeStep: number }) {
  const text = GUIDE_TEXT[activeStep] || GUIDE_TEXT[1];

  return (
    <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-400/10 via-yellow-400/5 to-transparent px-4 py-2 text-xs">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
      <p className="text-stone-400">{text}</p>
    </div>
  );
}
