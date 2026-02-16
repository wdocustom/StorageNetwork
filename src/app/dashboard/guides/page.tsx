"use client";

import { useState } from "react";
import {
  ArrowLeft,
  CheckSquare,
  Square,
  ClipboardList,
  PlayCircle,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Guides & Training Page — Tutorials + Installation Checklist
// ═══════════════════════════════════════════════════════════════════════════

// Installation checklist items
const INSTALLATION_CHECKLIST = [
  {
    id: "studs",
    text: "Locate Studs",
    detail: "Use magnetic stud finder",
  },
  {
    id: "header",
    text: "Level Header Rail",
    detail: "Laser level recommended",
  },
  {
    id: "verticals",
    text: "Secure Verticals",
    detail: "Use 3\" screws at stud locations",
  },
  {
    id: "totes",
    text: "Install Totes & Check Fit",
    detail: "Verify smooth slide in/out",
  },
  {
    id: "cleanup",
    text: "Cleanup",
    detail: "Wipe down units and sweep the installation area.",
  },
];

export default function GuidesPage() {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  function toggleItem(id: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Plans & Guides
            </h1>
            <p className="text-[11px] text-stone-500">Training Library</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {/* ═══════════════════════════════════════════════════════════════
            SECTION A: Tutorials
        ═══════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-purple-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Tutorials
            </h2>
          </div>

          <p className="mb-4 text-sm text-stone-400">
            Step-by-step guides to help you get the most out of the platform.
          </p>

          <div className="space-y-3">
            {/* Tutorial 1 */}
            <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <PlayCircle className="h-6 w-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white">How to Quote a Job</h3>
                <p className="text-[11px] text-stone-500">
                  Walk through the build tool from unit sizing to sending a professional quote.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-700 px-2.5 py-0.5 text-[10px] font-bold text-stone-500">
                Coming Soon
              </span>
            </div>

            {/* Tutorial 2 */}
            <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <PlayCircle className="h-6 w-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white">Using the 3D Configurator</h3>
                <p className="text-[11px] text-stone-500">
                  Learn how customers use the interactive designer and how leads flow to your dashboard.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-700 px-2.5 py-0.5 text-[10px] font-bold text-stone-500">
                Coming Soon
              </span>
            </div>

            {/* Tutorial 3 */}
            <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <PlayCircle className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white">Marketing Your Business</h3>
                <p className="text-[11px] text-stone-500">
                  Tips for sharing your link, using scripts, and converting local leads.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-700 px-2.5 py-0.5 text-[10px] font-bold text-stone-500">
                Coming Soon
              </span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION B: Installation Checklist
        ═══════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Installation Checklist
            </h2>
          </div>

          <p className="mb-4 text-sm text-stone-400">
            Tap each step to mark it complete. Great for use on-site!
          </p>

          <div className="space-y-2">
            {INSTALLATION_CHECKLIST.map((item) => {
              const checked = checkedItems.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all active:scale-[0.98] ${
                    checked
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-800/50"
                  }`}
                >
                  <div className="mt-0.5">
                    {checked ? (
                      <CheckSquare className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Square className="h-5 w-5 text-stone-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        checked
                          ? "text-emerald-400 line-through"
                          : "text-white"
                      }`}
                    >
                      {item.text}
                    </p>
                    <p
                      className={`text-xs ${
                        checked ? "text-emerald-400/60" : "text-stone-500"
                      }`}
                    >
                      {item.detail}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Progress */}
          <div className="mt-4 border-t border-slate-700 pt-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-stone-500">Progress</span>
              <span className="font-bold text-emerald-400">
                {checkedItems.size} / {INSTALLATION_CHECKLIST.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{
                  width: `${
                    (checkedItems.size / INSTALLATION_CHECKLIST.length) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
