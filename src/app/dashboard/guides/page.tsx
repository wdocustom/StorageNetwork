"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Package,
  Ruler,
  CheckSquare,
  Square,
  ClipboardList,
  BookOpen,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Guides & Training Page — Reference Manual + Installation Checklist
// ═══════════════════════════════════════════════════════════════════════════

// Hardcoded teaser plan for a standard 4x2 HDX unit
const TEASER_MATERIAL_LIST = [
  { item: "2x4 @ 96\" (8ft)", qty: 12, use: "Uprights & Rails" },
  { item: "3/4\" Plywood Sheet (4x8)", qty: 1, use: "Top Surface" },
  { item: "3\" Deck Screws", qty: 32, use: "Frame Assembly" },
  { item: "1-5/8\" Exterior Screws", qty: 48, use: "Rail Attachments" },
  { item: "2-1/2\" Exterior Screws", qty: 16, use: "Cross Bracing" },
  { item: "HDX 27-Gallon Totes", qty: 8, use: "Storage Bins" },
];

// Hardcoded cut plan for 4x2 unit (visual representation)
const TEASER_CUT_PLAN = [
  {
    board: 1,
    cuts: [
      { length: 65.5, label: "Upright", color: "bg-blue-500" },
      { length: 21.25, label: "Rail", color: "bg-amber-500" },
      { length: 9.125, label: "Waste", color: "bg-red-500/50" },
    ],
  },
  {
    board: 2,
    cuts: [
      { length: 65.5, label: "Upright", color: "bg-blue-500" },
      { length: 21.25, label: "Rail", color: "bg-amber-500" },
      { length: 9.125, label: "Waste", color: "bg-red-500/50" },
    ],
  },
  {
    board: 3,
    cuts: [
      { length: 65.5, label: "Upright", color: "bg-blue-500" },
      { length: 21.25, label: "Rail", color: "bg-amber-500" },
      { length: 9.125, label: "Waste", color: "bg-red-500/50" },
    ],
  },
  {
    board: 4,
    cuts: [
      { length: 65.5, label: "Upright", color: "bg-blue-500" },
      { length: 21.25, label: "Rail", color: "bg-amber-500" },
      { length: 9.125, label: "Waste", color: "bg-red-500/50" },
    ],
  },
  {
    board: 5,
    cuts: [
      { length: 65.5, label: "Upright", color: "bg-blue-500" },
      { length: 21.25, label: "Rail", color: "bg-amber-500" },
      { length: 9.125, label: "Waste", color: "bg-red-500/50" },
    ],
  },
  {
    board: 6,
    cuts: [
      { length: 21.25, label: "Rail", color: "bg-amber-500" },
      { length: 21.25, label: "Rail", color: "bg-amber-500" },
      { length: 21.25, label: "Rail", color: "bg-amber-500" },
      { length: 21.25, label: "Rail", color: "bg-amber-500" },
      { length: 11, label: "Waste", color: "bg-red-500/50" },
    ],
  },
];

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
    id: "rails",
    text: "Attach Horizontal Rails",
    detail: "Use 1-5/8\" screws",
  },
  {
    id: "totes",
    text: "Install Totes & Check Fit",
    detail: "Verify smooth slide in/out",
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
            SECTION A: Teaser Plan (4x2 Unit)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-yellow-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Sample Plan: Standard 4x2 Layout
            </h2>
          </div>

          <p className="mb-4 text-sm text-stone-400">
            This is what a complete build plan looks like for a 4-wide by 2-high
            HDX tote unit. The full calculator generates these automatically for
            any size.
          </p>

          {/* Material List */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Material List
              </h3>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      Item
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      Use
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TEASER_MATERIAL_LIST.map((m, i) => (
                    <tr
                      key={m.item}
                      className={i % 2 === 0 ? "bg-slate-800/30" : ""}
                    >
                      <td className="px-3 py-2 text-white">{m.item}</td>
                      <td className="px-3 py-2 text-center font-bold text-yellow-400">
                        {m.qty}
                      </td>
                      <td className="px-3 py-2 text-stone-500">{m.use}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cut Plan Visual */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Ruler className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Cut Plan (96&quot; Boards)
              </h3>
            </div>
            <div className="space-y-2">
              {TEASER_CUT_PLAN.map((board) => (
                <div key={board.board} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-[10px] font-bold text-stone-600">
                    #{board.board}
                  </span>
                  <div className="flex h-6 flex-1 overflow-hidden rounded border border-slate-700">
                    {board.cuts.map((cut, idx) => {
                      const widthPct = (cut.length / 96) * 100;
                      return (
                        <div
                          key={idx}
                          className={`relative flex items-center justify-center ${cut.color} ${
                            cut.label === "Waste"
                              ? "bg-stripes"
                              : ""
                          }`}
                          style={{ width: `${widthPct}%` }}
                          title={`${cut.label}: ${cut.length}"`}
                        >
                          <span className="truncate px-1 text-[9px] font-bold text-white/80">
                            {cut.length}&quot;
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded bg-blue-500" />
                <span className="text-stone-400">Uprights</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded bg-amber-500" />
                <span className="text-stone-400">Rails</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded bg-red-500/50" />
                <span className="text-stone-400">Waste</span>
              </div>
            </div>
          </div>

          {/* PRO Upsell Note */}
          <div className="mt-4 rounded-lg bg-yellow-400/5 p-3">
            <p className="text-xs text-stone-500">
              <span className="font-semibold text-yellow-400">Pro Members</span>{" "}
              get direct clickable links to exact material SKUs at your local store.
            </p>
          </div>

          {/* CTA */}
          <div className="mt-4 rounded-lg border border-dashed border-yellow-400/30 bg-yellow-400/5 p-4 text-center">
            <p className="text-xs text-stone-400">
              Get custom plans for any unit size with the{" "}
              <span className="font-semibold text-yellow-400">
                PRO Build Tool
              </span>
            </p>
            <a
              href="/dashboard/build"
              className="mt-2 inline-block rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
            >
              Open Build Tool
            </a>
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

        {/* ── Coming Soon ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-600">
            More Guides Coming Soon
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Video tutorials, advanced techniques, and troubleshooting.
          </p>
        </div>
      </main>
    </div>
  );
}
