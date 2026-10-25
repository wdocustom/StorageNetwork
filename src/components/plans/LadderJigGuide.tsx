"use client";

// ═══════════════════════════════════════════════════════════════════════════
// LADDER JIG GUIDE — renders the paid jig content (retail edition)
//
// Content arrives from openLadderJig() only after the purchase is verified;
// this component just lays it out. JigDiagram also renders unlabeled as the
// sales-page teaser.
// ═══════════════════════════════════════════════════════════════════════════

import { Check, Ruler, Scissors, ShoppingCart, Wrench } from "lucide-react";
import type { LadderJigContent } from "@/lib/ladder-jig-content";
import { toFraction } from "@/lib/utils";

/** Top view of the finished jig, drawn to scale (96" long × 37" wide). */
export function JigDiagram({ marks, showLabels = true }: { marks: number[]; showLabels?: boolean }) {
  const L = 96;
  const W = 37;
  const pad = 6;
  const railW = 3.5;
  const gap = 30; // inside distance between rails
  const railA = (W - gap) / 2 - railW / 2; // centered pair of rails on the base
  const railAy = Math.max(0, railA);
  const railBy = railAy + railW + gap;
  const stop = 1.5;
  return (
    <svg viewBox={`0 0 ${L + pad * 2} ${W + pad * 2 + (showLabels ? 10 : 0)}`} className="w-full" role="img" aria-label="Ladder jig, top view">
      <rect x={pad} y={pad} width={L} height={W} rx={0.6} fill="#a8a29e" opacity={0.25} stroke="#78716c" strokeWidth={0.3} />
      <rect x={pad} y={pad + railAy} width={L} height={railW} fill="#d9b482" stroke="#a16207" strokeWidth={0.3} />
      <rect x={pad} y={pad + railBy} width={L} height={railW} fill="#d9b482" stroke="#a16207" strokeWidth={0.3} />
      <rect x={pad} y={pad + railAy + railW} width={stop} height={gap} fill="#fb923c" stroke="#ea580c" strokeWidth={0.3} />
      {/* ghost uprights */}
      <rect x={pad + stop} y={pad + railAy + railW} width={L - stop} height={3.5} fill="#facc15" opacity={0.12} />
      <rect x={pad + stop} y={pad + railBy - 3.5} width={L - stop} height={3.5} fill="#facc15" opacity={0.12} />
      {marks.map((m) => {
        const x = pad + stop + m;
        return (
          <g key={m}>
            <line x1={x} x2={x} y1={pad + railAy - 1} y2={pad + railBy + railW + 1} stroke="#f43f5e" strokeWidth={0.35} strokeDasharray="1 0.6" />
            {showLabels && (
              <text x={x} y={pad + W + 6} textAnchor="middle" fontSize={2.6} fontWeight={700} fill="#fb7185" style={{ fontFamily: "ui-monospace, monospace" }}>
                {toFraction(m)}&quot;
              </text>
            )}
          </g>
        );
      })}
      {showLabels && (
        <>
          <text x={pad + L / 2} y={pad + railAy + 2.5} textAnchor="middle" fontSize={2.2} fill="#713f12" fontWeight={700}>RAIL A — 2×4 × 96&quot;</text>
          <text x={pad + L / 2} y={pad + railBy + 2.5} textAnchor="middle" fontSize={2.2} fill="#713f12" fontWeight={700}>RAIL B — 2×4 × 96&quot;</text>
          <text x={pad + L / 2} y={pad + W / 2 + 1} textAnchor="middle" fontSize={2.4} fill="#e2e8f0">30&quot; between rails · marks measured from the stop block</text>
        </>
      )}
    </svg>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Wrench; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-yellow-400" />
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Steps({ steps, start = 1 }: { steps: { title: string; detail: string }[]; start?: number }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-black text-gray-950">
            {start + i}
          </span>
          <div>
            <p className="text-sm font-bold text-white">{s.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-stone-400">{s.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function LadderJigGuide({ content }: { content: LadderJigContent }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
        <JigDiagram marks={content.marks} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section icon={ShoppingCart} title="Materials">
          <ul className="space-y-2">
            {content.materials.map((m) => (
              <li key={m.item} className="flex gap-3 text-xs">
                <span className="w-8 shrink-0 font-mono font-bold text-yellow-400">{m.qty}</span>
                <span>
                  <span className="font-semibold text-stone-200">{m.item}</span>
                  <span className="block text-stone-500">{m.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section icon={Wrench} title="Tools">
          <ul className="space-y-1.5">
            {content.tools.map((t) => (
              <li key={t} className="flex items-center gap-2 text-xs text-stone-300">
                <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section icon={Scissors} title="Cut List">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="py-1.5 pr-3">Piece</th>
                <th className="py-1.5 pr-3">Qty</th>
                <th className="py-1.5 pr-3">Size</th>
                <th className="py-1.5">Notes</th>
              </tr>
            </thead>
            <tbody className="text-stone-300">
              {content.cutList.map((c) => (
                <tr key={c.piece} className="border-t border-slate-800">
                  <td className="py-2 pr-3 font-semibold text-white">{c.piece}</td>
                  <td className="py-2 pr-3 font-mono">{c.qty}</td>
                  <td className="py-2 pr-3 font-mono">{c.dimensions}</td>
                  <td className="py-2 text-stone-500">{c.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section icon={Ruler} title="Build the Jig">
        <Steps steps={content.buildSteps} />
      </Section>

      <Section icon={Wrench} title="Use It to Build Your Ladders">
        <Steps steps={content.useSteps} start={content.buildSteps.length + 1} />
      </Section>
    </div>
  );
}
