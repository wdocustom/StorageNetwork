"use client";

import { Sparkles } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// AI Guide Bar — contextual single-line nudge per configurator step
//
// Mobile: renders sticky below the 3D canvas (inside the scroll container)
// Desktop: renders at the top of the sidebar
// ═══════════════════════════════════════════════════════════════════════════

const GUIDE_TEXT: Record<number, string> = {
  1: "Start by entering your wall dimensions — we'll figure out what fits.",
  2: "Pick a tote size and orientation. This sets the frame depth.",
  3: "Add totes, wheels, or a top. Customize to your space.",
  4: "Review your build and book when ready.",
};

export default function AIGuideBar({ activeStep }: { activeStep: number }) {
  const text = GUIDE_TEXT[activeStep] || GUIDE_TEXT[1];

  return (
    <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-400/10 via-yellow-400/5 to-transparent px-4 py-2 text-xs">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
      <p className="text-stone-400">
        <span className="font-semibold text-yellow-400/90">Tip:</span>{" "}
        {text}
      </p>
    </div>
  );
}
