"use client";

// ═══════════════════════════════════════════════════════════════════════════
// PRINTABLE PLAN — Comprehensive DIY build plan for tote organizer units
//
// Renders a full, print-optimized plan document with:
//   1. Unit overview & dimensions
//   2. Complete shopping/materials list
//   3. Cut diagrams (board-by-board layout)
//   4. Plywood ripping instructions
//   5. Step-by-step assembly with tools, materials, and pro tips
//   6. Safety notes
//
// Designed to be printed via browser Print → Save as PDF, or rendered
// on-screen as a gated preview with purchase CTA.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import Link from "next/link";
import type { CompleteDIYPlan } from "@/app/actions/generate-plan";
import type { PlanCatalogItem } from "@/lib/plans";

interface PrintablePlanProps {
  plan: CompleteDIYPlan;
  catalogItem: PlanCatalogItem;
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <h2 className="mb-4 mt-10 flex items-center gap-3 border-b border-slate-700 pb-2 text-xl font-bold text-white print:border-slate-300 print:text-black">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white print:bg-black">
        {number}
      </span>
      {title}
    </h2>
  );
}

function DimensionRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between border-b border-slate-800 py-1.5 text-sm print:border-slate-200">
      <span className="text-slate-400 print:text-slate-600">{label}</span>
      <span className="font-mono font-medium text-white print:text-black">{value}</span>
    </div>
  );
}

function CutDiagramBoard({
  boardIndex,
  stockLength,
  cuts,
  remainder,
}: {
  boardIndex: number;
  stockLength: number;
  cuts: { length: number; label: string }[];
  remainder: number;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-medium text-slate-400 print:text-slate-600">
        Board #{boardIndex} — 8&apos; (96&quot;)
      </div>
      <div className="flex h-8 overflow-hidden rounded border border-slate-600 print:border-slate-400">
        {cuts.map((cut, i) => {
          const pct = (cut.length / stockLength) * 100;
          return (
            <div
              key={i}
              className="flex items-center justify-center border-r border-slate-500 bg-amber-800/60 text-[10px] font-medium text-amber-200 print:bg-amber-100 print:text-amber-900"
              style={{ width: `${pct}%` }}
              title={`${cut.label}: ${cut.length}"`}
            >
              {pct > 8 ? `${cut.length}"` : ""}
            </div>
          );
        })}
        {remainder > 0 && (
          <div
            className="flex items-center justify-center bg-slate-700/40 text-[10px] text-slate-500 print:bg-slate-100"
            style={{ width: `${(remainder / stockLength) * 100}%` }}
          >
            {remainder > 5 ? `${Math.round(remainder * 10) / 10}" waste` : ""}
          </div>
        )}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-slate-500">
        {cuts.map((cut, i) => (
          <span key={i}>
            {cut.label}: {cut.length}&quot;
          </span>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export default function PrintablePlan({ plan, catalogItem }: PrintablePlanProps) {
  const [isPurchased] = useState(true); // TODO: gate behind purchase flow

  return (
    <div className="print:text-black">
      {/* ── Header / Navigation (hidden in print) ── */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href="/plans"
          className="text-sm text-slate-400 transition-colors hover:text-white"
        >
          &larr; All Plans
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Print / Save as PDF
        </button>
      </div>

      {/* ── Plan Title Block ── */}
      <header className="mb-8 rounded-xl border border-slate-700 bg-slate-800/60 p-6 print:border-slate-300 print:bg-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white print:text-black">
              {plan.unitName}
            </h1>
            <p className="mt-1 text-slate-400 print:text-slate-600">
              {plan.cols}×{plan.rows} Tote Organizer &mdash; {plan.toteCount} totes
              {plan.hasWheels ? " + Casters" : ""}
              {plan.hasTop ? " + Worktop" : ""}
              {plan.orientation === "sideways" ? " (Sideways)" : ""}
            </p>
            <p className="mt-1 text-sm text-slate-500 print:text-slate-600">
              Tote compatibility: {plan.toteType === "HDX" ? "HDX / Home Depot / Menards / Walmart" : "Greenmade / Costco"} 27-gallon
            </p>
          </div>

          {/* ── Grid visual ── */}
          <div className="flex shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/50 p-4 print:border-slate-300 print:bg-slate-50">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${plan.cols}, 1fr)`,
                gridTemplateRows: `repeat(${plan.rows}, 1fr)`,
              }}
            >
              {Array.from({ length: plan.toteCount }).map((_, i) => (
                <div
                  key={i}
                  className="h-5 w-8 rounded-sm border border-slate-600 bg-slate-700/60 print:border-slate-400 print:bg-slate-200"
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      {isPurchased ? (
        <>
          {/* ════════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: DIMENSIONS                                          */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <SectionHeader number={1} title="Unit Dimensions" />
          <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
            <DimensionRow label="Total Width" value={plan.dimensions.totalWidth} />
            <DimensionRow label="Total Height" value={plan.dimensions.totalHeight} />
            {plan.dimensions.totalHeightWithWheels && (
              <DimensionRow label="Height (with casters)" value={plan.dimensions.totalHeightWithWheels} />
            )}
            <DimensionRow label="Depth" value={plan.dimensions.depth} />
            <DimensionRow label="Slot Width (tote opening)" value={plan.dimensions.slotWidth} />
            <DimensionRow label="Tier Spacing (center-to-center)" value={plan.dimensions.tierSpacing} />
            <DimensionRow label="First Rail Height (from bottom)" value={plan.dimensions.firstRailHeight} />
            <DimensionRow label="Post Width (2×4)" value={plan.dimensions.postWidth} />
            <DimensionRow label="Rail Strip Width" value={plan.dimensions.railStripWidth} />
            <DimensionRow label="Rail Strip Thickness" value={plan.dimensions.railStripThickness} />
            <DimensionRow label="Upright Cut Length" value={plan.dimensions.uprightHeight} />
            <DimensionRow label="Plate Cut Length" value={plan.dimensions.plateLength} />
          </div>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: SHOPPING LIST                                       */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <SectionHeader number={2} title="Shopping List" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wider text-slate-500 print:border-slate-300">
                  <th className="pb-2 pr-4">Item</th>
                  <th className="pb-2 pr-4">Qty</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {plan.shoppingList.map((item, i) => (
                  <tr key={i} className="border-b border-slate-800 print:border-slate-200">
                    <td className="py-2 pr-4 font-medium text-white print:text-black">{item.name}</td>
                    <td className="py-2 pr-4 font-mono text-blue-400 print:text-blue-700">{item.qty}</td>
                    <td className="py-2 text-slate-400 print:text-slate-600">{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Totals summary ── */}
          <div className="mt-4 flex flex-wrap gap-4 rounded-lg border border-slate-700/60 bg-slate-800/40 p-4 text-sm print:border-slate-300 print:bg-slate-50">
            <div>
              <span className="text-slate-500">2×4×8&apos; boards:</span>{" "}
              <span className="font-bold text-white print:text-black">{plan.totals.boards}</span>
            </div>
            <div>
              <span className="text-slate-500">Plywood sheets:</span>{" "}
              <span className="font-bold text-white print:text-black">{plan.totals.sheets}</span>
            </div>
            <div>
              <span className="text-slate-500">Totes:</span>{" "}
              <span className="font-bold text-white print:text-black">{plan.totals.totes}</span>
            </div>
            {plan.totals.wheelKits > 0 && (
              <div>
                <span className="text-slate-500">Caster kits:</span>{" "}
                <span className="font-bold text-white print:text-black">{plan.totals.wheelKits}</span>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* SECTION 3: CUT DIAGRAMS                                        */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <SectionHeader number={3} title="Lumber Cut Diagrams" />
          <p className="mb-4 text-sm text-slate-400 print:text-slate-600">
            Each bar below represents one 2×4×8&apos; board (96&quot;). Colored sections are your cuts.
            Gray areas are offcuts/waste.
          </p>
          {plan.cutDiagrams.map((diagram) => (
            <CutDiagramBoard
              key={diagram.boardIndex}
              boardIndex={diagram.boardIndex}
              stockLength={diagram.stockLength}
              cuts={diagram.cuts}
              remainder={diagram.remainder}
            />
          ))}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* SECTION 4: PLYWOOD RIPPING                                     */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <SectionHeader number={4} title="Plywood Ripping Guide" />
          <div className="space-y-2">
            {plan.plywoodNotes.map((note, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="mt-0.5 text-blue-400 print:text-blue-700">{i + 1}.</span>
                <span className="text-slate-300 print:text-slate-700">{note}</span>
              </div>
            ))}
          </div>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* SECTION 5: REQUIRED TOOLS                                      */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <SectionHeader number={5} title="Required Tools" />
          <div className="flex flex-wrap gap-2">
            {plan.allTools.map((tool) => (
              <span
                key={tool}
                className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300 print:border-slate-300 print:text-slate-700"
              >
                {tool}
              </span>
            ))}
          </div>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* SECTION 6: STEP-BY-STEP ASSEMBLY                               */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <SectionHeader number={6} title="Step-by-Step Assembly" />
          <div className="space-y-6">
            {plan.assemblySteps.map((step) => (
              <div
                key={step.stepNumber}
                className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 print:border-slate-300 print:bg-white"
              >
                {/* Step header */}
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white print:bg-black">
                    {step.stepNumber}
                  </span>
                  <h3 className="text-lg font-semibold text-white print:text-black">
                    {step.title}
                  </h3>
                </div>

                {/* Instruction */}
                <p className="mb-4 leading-relaxed text-slate-300 print:text-slate-700">
                  {step.instruction}
                </p>

                {/* Materials for this step */}
                {step.materials.length > 0 && (
                  <div className="mb-3">
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Materials
                    </h4>
                    <div className="space-y-1">
                      {step.materials.map((mat, i) => (
                        <div key={i} className="flex gap-2 text-sm">
                          <span className="font-mono text-blue-400 print:text-blue-700">
                            {mat.qty}×
                          </span>
                          <span className="text-white print:text-black">{mat.name}</span>
                          <span className="text-slate-500">— {mat.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Screw type callout */}
                {step.screwType && (
                  <div className="mb-3 rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm print:border-slate-300 print:bg-slate-50">
                    <span className="font-medium text-amber-400 print:text-amber-700">
                      Fastener:
                    </span>{" "}
                    <span className="text-slate-300 print:text-slate-700">
                      {step.screwType.label} — {step.screwType.description}
                    </span>
                  </div>
                )}

                {/* Tools for this step */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {step.tools.map((tool, i) => (
                    <span
                      key={i}
                      className="rounded bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400 print:bg-slate-200 print:text-slate-600"
                    >
                      {tool.name}
                      {tool.detail ? ` (${tool.detail})` : ""}
                    </span>
                  ))}
                </div>

                {/* Pro tip */}
                {step.proTip && (
                  <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2 text-sm text-green-400 print:border-green-300 print:bg-green-50 print:text-green-700">
                    <span className="font-semibold">Pro Tip:</span> {step.proTip}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* SECTION 7: SAFETY                                              */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <SectionHeader number={7} title="Safety Notes" />
          <div className="space-y-2">
            {plan.safetyNotes.map((note, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400 print:text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-slate-300 print:text-slate-700">{note}</span>
              </div>
            ))}
          </div>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* SECTION 8: GENERAL NOTES                                       */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <SectionHeader number={8} title="General Notes" />
          <div className="space-y-2">
            {plan.generalNotes.map((note, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="mt-0.5 text-slate-500">•</span>
                <span className="text-slate-300 print:text-slate-700">{note}</span>
              </div>
            ))}
          </div>

          {/* ── Footer ── */}
          <footer className="mt-12 border-t border-slate-700 pt-6 text-center text-xs text-slate-500 print:border-slate-300">
            <p>
              Storage Network &mdash; DIY Build Plan: {plan.unitName}
            </p>
            <p className="mt-1">
              {plan.cols}×{plan.rows} ({plan.toteCount} totes) &bull;{" "}
              {plan.toteType === "HDX" ? "HDX" : "Greenmade"} 27-gallon
              {plan.hasWheels ? " + Casters" : ""}
              {plan.hasTop ? " + Worktop" : ""}
            </p>
            <p className="mt-1">storage-network.app/plans</p>
          </footer>

          {/* ── Print-hidden CTA ── */}
          <div className="mt-8 text-center print:hidden">
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Print / Save as PDF
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Use your browser&apos;s print dialog to save as PDF
            </p>
          </div>
        </>
      ) : (
        /* ── Purchase gate (placeholder for Stripe integration) ── */
        <div className="mt-12 text-center">
          <div className="mx-auto max-w-md rounded-xl border border-slate-700 bg-slate-800/60 p-8">
            <h2 className="text-2xl font-bold text-white">
              Get the Full Plan
            </h2>
            <p className="mt-3 text-slate-400">
              Includes dimensional drawings, complete shopping list, cut diagrams,
              and step-by-step assembly instructions with pro tips.
            </p>
            <p className="mt-4 text-4xl font-bold text-blue-400">
              ${catalogItem.price}
            </p>
            <button className="mt-6 w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500">
              Purchase Plan
            </button>
            <p className="mt-3 text-xs text-slate-500">
              Instant access &bull; Printable PDF &bull; Lifetime access
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
