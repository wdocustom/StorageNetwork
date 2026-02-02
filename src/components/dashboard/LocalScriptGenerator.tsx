"use client";

import { useState } from "react";
import { Copy, Check, MapPin, AlertTriangle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// LocalScriptGenerator — Localized social media sales scripts
// ═══════════════════════════════════════════════════════════════════════════

interface LocalScriptGeneratorProps {
  city: string | null;
  state: string | null;
  bookingLink: string;
}

export default function LocalScriptGenerator({
  city,
  state,
  bookingLink,
}: LocalScriptGeneratorProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [toast, setToast] = useState(false);

  const hasLocation = !!city?.trim() && !!state?.trim();

  function copyScript(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setToast(true);
    setTimeout(() => setCopiedIndex(null), 2000);
    setTimeout(() => setToast(false), 3000);
  }

  const scripts = hasLocation
    ? [
        {
          label: 'The "Neighbor" Approach',
          text: `Hey ${city} neighbors! 👋 I'm looking to fill 3 install spots for custom garage storage this week. If your garage is a mess, let me design a solution that fits perfectly. Check out my 3D design tool here: ${bookingLink}`,
        },
        {
          label: 'The "Urgency" Approach',
          text: `Stop tripping over clutter. ${city} homeowners are loving these heavy-duty storage systems. I have openings in ${city}, ${state} next week. Get a free instant quote: ${bookingLink}`,
        },
        {
          label: 'The "Professional" Approach',
          text: `Proudly serving the ${city} area with professional-grade garage storage. Don't settle for flimsy plastic racks. Build your custom setup with my 3D configurator: ${bookingLink}`,
        },
      ]
    : [];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-1 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-emerald-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          Localized Sales Scripts
        </h2>
      </div>
      <p className="mb-4 text-sm text-stone-500">
        Copy-paste these into Facebook, Instagram, or Nextdoor to get local leads.
      </p>

      {!hasLocation ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-300">
              Location data missing
            </p>
            <p className="mt-0.5 text-xs text-stone-500">
              Please update your{" "}
              <a
                href="/dashboard/profile"
                className="font-bold text-yellow-400 underline hover:text-yellow-300"
              >
                City & State in Settings
              </a>{" "}
              to unlock local scripts.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {scripts.map((script, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  {script.label}
                </span>
                <button
                  onClick={() => copyScript(script.text, i)}
                  className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
                >
                  {copiedIndex === i ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-300">
                {script.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg">
          Script copied! Paste it into Facebook/Instagram.
        </div>
      )}
    </section>
  );
}
