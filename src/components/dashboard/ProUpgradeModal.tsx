"use client";

import { X, Link2, Percent, Palette, Zap } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Pro Upgrade Modal — Sales intercept for locked features
// ═══════════════════════════════════════════════════════════════════════════

interface ProUpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

const BENEFITS = [
  {
    icon: Percent,
    title: "Only 1% Infrastructure Fee",
    desc: "Drop from 15% to just 1% on every job booked through your link. Pays for itself in one job.",
  },
  {
    icon: Link2,
    title: "Custom Branded Link",
    desc: "Replace the UUID with your business name.",
    visual: "storage-network.app/design?installer=your-business",
  },
  {
    icon: Palette,
    title: "Remove Platform Branding",
    desc: "Your clients see your name on the design tool, not ours.",
  },
];

export default function ProUpgradeModal({
  open,
  onClose,
}: ProUpgradeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            <h2 className="text-lg font-bold text-white">Upgrade to Pro</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <h3 className="mb-1 text-xl font-black text-white">
            Maximize Your Margins.
          </h3>
          <p className="mb-5 text-sm text-stone-500">
            Everything you need to run your installer business without giving up
            a cut.
          </p>

          <div className="space-y-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-400/10">
                  <b.icon className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{b.title}</p>
                  <p className="text-xs text-stone-500">{b.desc}</p>
                  {b.visual && (
                    <p className="mt-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-blue-400">
                      {b.visual}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-5 py-4">
          <button
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-black uppercase tracking-widest text-gray-950 transition-colors hover:bg-yellow-300"
          >
            <Zap className="h-4 w-4" />
            Upgrade to Pro &mdash; $99/mo
          </button>
          <p className="mt-2 text-center text-[11px] text-stone-600">
            Cancel anytime. No long-term contracts.
          </p>
        </div>
      </div>
    </div>
  );
}
