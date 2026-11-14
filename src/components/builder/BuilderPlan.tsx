"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — the build plan for a custom design
//
// Opens over the workspace when the builder asks for their plan. Laid out
// like a purchased tote-rack plan (/plans/build) so the two feel like one
// product:
//   • summary and finished size, plus anything to fix before building
//   • Interactive 3D Build Guide and Printable PDF cards
//   • parts, each with its letter
//   • cut list: every board and plywood sheet drawn to scale
//   • shopping list and tools as tick-off lists
//   • notes and leftovers worth keeping
//
// The plan is generated from the scene by @/lib/builder/plan each time the
// screen opens, so it always matches the design.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Check,
  Download,
  FileText,
  Loader2,
  Play,
  Ruler,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import { PIECE_FLAT_COLORS } from "@/components/builder/viewport";
import { getStock } from "@/lib/builder/catalog";
import { generateCustomPlan, type CustomPlan, type PlanBoard, type PlanSheet } from "@/lib/builder/plan";
import type { Scene } from "@/lib/builder/scene";
import { formatInches } from "@/lib/builder/units";

const GuideLoading = () => (
  <div className="flex h-full w-full items-center justify-center bg-slate-950">
    <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
  </div>
);

const BuilderGuide = dynamic(() => import("@/components/builder/BuilderGuide"), { ssr: false, loading: GuideLoading });
const PlanSnapshots = dynamic(() => import("@/components/builder/BuilderGuide").then((m) => m.PlanSnapshots), { ssr: false });

// ── Cut diagrams ─────────────────────────────────────────────────────────

/** One board, to scale: its strips (rips) top to bottom, cuts left to right, waste hatched. */
function BoardDiagram({ board }: { board: PlanBoard }) {
  const stock = getStock(board.stock);
  const fullWidth = stock?.width ?? 3.5;
  const ripped = board.lanes.some((l) => l.width < fullWidth - 1e-6);
  // Drawn 4× taller than true scale so the labels are readable
  const tall = 4;
  const height = fullWidth * tall;
  let top = 0;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[11px]">
        <span className="font-bold text-white">
          <span className="font-mono text-yellow-400">{board.count} ×</span> 2×4 × {board.length / 12} ft
        </span>
        {ripped && (
          <span className="text-stone-500">rip first: {board.lanes.map((l) => formatInches(l.width)).join(" + ")}</span>
        )}
      </div>
      <svg viewBox={`0 0 ${board.length} ${height}`} className="block w-full rounded-md" role="img" aria-label={`Cut layout for a ${board.length / 12} foot board`}>
        <rect width={board.length} height={height} fill="url(#plan-waste)" />
        {board.lanes.map((lane, li) => {
          const laneH = lane.width * tall;
          const y = top;
          top += laneH + 0.125 * tall;
          let x = 0;
          return (
            <g key={li}>
              {lane.cuts.map((cut, ci) => {
                const cx = x;
                x += cut.length + 0.125;
                const label = `${cut.letter} · ${formatInches(cut.length)}`;
                return (
                  <g key={ci}>
                    <rect x={cx} y={y} width={cut.length} height={laneH} fill={PIECE_FLAT_COLORS.lumber} stroke="#7c6a45" strokeWidth={0.25} />
                    {cut.length > 7 && (
                      <text
                        x={cx + cut.length / 2}
                        y={y + laneH / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={Math.min(3.4, laneH * 0.62)}
                        fontWeight={700}
                        fill="#422006"
                      >
                        {cut.length > label.length * 2 ? label : cut.letter}
                      </text>
                    )}
                  </g>
                );
              })}
              {lane.offcut >= 12 && (
                <text
                  x={board.length - lane.offcut / 2}
                  y={y + laneH / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.min(3, laneH * 0.55)}
                  fill="#94a3b8"
                >
                  {formatInches(lane.offcut)} left
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** One plywood sheet, to scale, with each part where it is cut from. */
function SheetDiagram({ sheet, index, total }: { sheet: PlanSheet; index: number; total: number }) {
  const stock = getStock(sheet.stock);
  const long = stock?.stockLengths[0] ?? 96;
  const short = stock?.width ?? 48;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="font-bold text-white">
          {sheet.label}, 4 × 8 sheet{total > 1 ? ` (${index + 1} of ${total})` : ""}
        </span>
        <span className="text-stone-500">{Math.round(sheet.used * 100)}% used</span>
      </div>
      <svg viewBox={`0 0 ${long} ${short}`} className="block w-full rounded-md" role="img" aria-label={`Cut layout for a sheet of ${sheet.label}`}>
        <rect width={long} height={short} fill="url(#plan-waste)" />
        {sheet.placements.map((p, i) => (
          <g key={i}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={PIECE_FLAT_COLORS.plywood} stroke="#7c6a45" strokeWidth={0.3} />
            {Math.min(p.w, p.h) > 5 && (
              <>
                <text x={p.x + p.w / 2} y={p.y + p.h / 2 - (Math.min(p.w, p.h) > 12 ? 1.5 : 0)} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(6, Math.min(p.w, p.h) * 0.4)} fontWeight={800} fill="#422006">
                  {p.letter}
                </text>
                {Math.min(p.w, p.h) > 12 && p.w > 22 && (
                  <text x={p.x + p.w / 2} y={p.y + p.h / 2 + 4.5} textAnchor="middle" dominantBaseline="central" fontSize={3} fill="#713f12">
                    {formatInches(p.w)} × {formatInches(p.h)}
                  </text>
                )}
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Tick-off lists (kept for this visit) ─────────────────────────────────

function useTicks() {
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return { ticked, toggle };
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
        on ? "border-yellow-400 bg-yellow-400 text-gray-950" : "border-slate-600 bg-slate-950"
      }`}
    >
      {on && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
    </span>
  );
}

function Card({ title, icon, children, className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-800 bg-slate-900 p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ── PDF ──────────────────────────────────────────────────────────────────

/** The Storage Network wordmark as a PNG data URL for the PDF cover. */
function loadCoverLogo(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = "/brand-wordmark.png";
  });
}

type PdfState = { phase: "idle" } | { phase: "rendering"; done: number } | { phase: "writing" } | { phase: "done" } | { phase: "error" };

function PdfCard({ scene, plan }: { scene: Scene; plan: CustomPlan }) {
  const [state, setState] = useState<PdfState>({ phase: "idle" });
  const shots = useRef<Record<string, string> | null>(null);
  const total = 1 + plan.steps.filter((s) => s.pieceIds.length > 0).length;

  const write = useCallback(
    async (snapshots: Record<string, string>) => {
      setState({ phase: "writing" });
      try {
        const [{ downloadCustomPlanPDF }, logoDataUrl] = await Promise.all([import("@/lib/builder/plan-pdf"), loadCoverLogo()]);
        downloadCustomPlanPDF({ plan, snapshots, logoDataUrl });
        setState({ phase: "done" });
      } catch (err) {
        console.error("[BuilderPlan] PDF generation failed:", err);
        setState({ phase: "error" });
      }
    },
    [plan],
  );

  const onShots = useCallback(
    (snapshots: Record<string, string>) => {
      shots.current = snapshots;
      write(snapshots);
    },
    [write],
  );
  const onProgress = useCallback((done: number) => setState({ phase: "rendering", done }), []);
  const busy = state.phase === "rendering" || state.phase === "writing";
  const pct = state.phase === "rendering" ? Math.round((state.done / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      {state.phase === "rendering" && <PlanSnapshots scene={scene} plan={plan} onProgress={onProgress} onComplete={onShots} />}
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-yellow-400" />
        <h2 className="text-sm font-bold text-white">Printable PDF Plan</h2>
      </div>
      <p className="mb-4 text-xs text-stone-400">
        {plan.steps.length} illustrated steps, cut diagrams, shopping and tool checklists. Prints on US Letter.
      </p>
      {state.phase === "rendering" && (
        <div className="mb-3">
          <div className="mb-1.5 flex justify-between text-[11px] text-stone-400">
            <span>
              Rendering picture {Math.min(state.done + 1, total)} of {total}…
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {state.phase === "error" && <p className="mb-3 text-xs font-medium text-red-400">Something went wrong building the PDF. Please try again.</p>}
      <button
        type="button"
        onClick={() => (shots.current ? write(shots.current) : setState({ phase: "rendering", done: 0 }))}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {state.phase === "writing" ? "Building PDF…" : state.phase === "rendering" ? "Rendering…" : state.phase === "done" ? "Download Again" : "Download PDF"}
      </button>
    </div>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────

export default function BuilderPlan({ scene, onClose }: { scene: Scene; onClose: () => void }) {
  const plan = useMemo(() => generateCustomPlan(scene), [scene]);
  const [guideOpen, setGuideOpen] = useState(false);
  const shop = useTicks();
  const kit = useTicks();

  if (guideOpen) {
    return (
      <div className="fixed inset-0 z-50">
        <BuilderGuide scene={scene} plan={plan} onClose={() => setGuideOpen(false)} />
      </div>
    );
  }

  const cutParts = plan.parts.filter((p) => p.letter);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 text-white">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-[11px] font-bold text-stone-200 transition hover:border-yellow-400/50 hover:text-yellow-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Design
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-white">{plan.name}</h1>
            <p className="text-[10px] text-stone-500">Build plan · made from your design</p>
          </div>
        </div>
      </header>

      {/* Hatching for waste, shared by every cut diagram */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <pattern id="plan-waste" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="3" fill="#1e293b" />
            <line x1="0" y1="0" x2="0" y2="3" stroke="#475569" strokeWidth="0.8" />
          </pattern>
        </defs>
      </svg>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 pb-16">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-stone-400">{plan.summary}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(
              [
                ["Width", plan.dimensions.width],
                ["Height", plan.dimensions.height],
                ["Depth", plan.dimensions.depth],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-800/60 px-3 py-2.5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-stone-500">{label}</div>
                <div className="font-mono text-sm font-bold text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {plan.warnings.length > 0 && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-bold text-amber-200">
              <AlertTriangle className="h-4 w-4" /> Check before you build
            </p>
            <ul className="space-y-1.5 text-xs leading-snug text-amber-100/90">
              {plan.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-yellow-400/30 bg-slate-900 p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-yellow-400/10 blur-3xl" />
            <div className="mb-3 flex items-center gap-2">
              <Box className="h-4 w-4 text-yellow-400" />
              <h2 className="text-sm font-bold text-white">Interactive 3D Build Guide</h2>
            </div>
            <p className="mb-4 text-xs text-stone-400">
              Step through the build in 3D. Rotate and zoom, tap any part for its letter and size. Prop your phone up in the garage and go.
            </p>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              disabled={plan.steps.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:from-amber-300 hover:to-yellow-400 disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> Launch Build Guide
            </button>
          </div>
          <PdfCard scene={scene} plan={plan} />
        </div>

        {cutParts.length > 0 && (
          <Card title="Parts" icon={<Ruler className="h-4 w-4 text-stone-500" />}>
            <ul className="divide-y divide-slate-800">
              {cutParts.map((part) => (
                <li key={part.letter} className="flex items-center gap-3 py-2 text-xs">
                  <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded bg-yellow-400 px-1 font-mono font-black text-gray-950">{part.letter}</span>
                  <span className="min-w-0 flex-1 text-stone-300">
                    {part.label}
                    {part.ripped && <span className="text-stone-500"> · ripped to {formatInches(part.width)}</span>}
                  </span>
                  <span className="font-mono font-bold text-white">{part.size}</span>
                  <span className="w-8 text-right font-mono font-bold text-yellow-400">×{part.qty}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {(plan.boards.length > 0 || plan.sheets.length > 0) && (
          <Card title="Cut List" icon={<Ruler className="h-4 w-4 text-stone-500" />}>
            <p className="mb-4 text-[11px] leading-snug text-stone-500">
              Each bar is one board with its cuts in order from one end. Hatching is waste. The layout allows 1/8&quot; for every saw cut.
            </p>
            <div className="space-y-4">
              {plan.boards.map((board, i) => (
                <BoardDiagram key={i} board={board} />
              ))}
              {plan.sheets.map((sheet, i) => (
                <SheetDiagram
                  key={`s${i}`}
                  sheet={sheet}
                  // "1 of 2" counts sheets of the same thickness
                  index={plan.sheets.slice(0, i).filter((other) => other.stock === sheet.stock).length}
                  total={plan.sheets.filter((other) => other.stock === sheet.stock).length}
                />
              ))}
            </div>
            {plan.offcuts.length > 0 && (
              <div className="mt-5 rounded-xl bg-slate-800/60 p-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Leftovers worth keeping</p>
                <ul className="space-y-1 text-xs text-stone-300">
                  {plan.offcuts.map((o) => (
                    <li key={o.description}>
                      <span className="font-mono font-bold text-yellow-400">{o.qty} ×</span> {o.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Shopping List" icon={<ShoppingCart className="h-4 w-4 text-stone-500" />}>
            <ul className="-mx-2 space-y-0.5">
              {plan.shoppingList.map((item) => {
                const on = shop.ticked.has(item.name);
                return (
                  <li key={item.name}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => shop.toggle(item.name)}
                      className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-xs transition hover:bg-white/[0.03] active:bg-white/[0.06]"
                    >
                      <Tick on={on} />
                      <span className={`w-12 shrink-0 pt-0.5 font-mono font-bold ${on ? "text-stone-600 line-through" : "text-yellow-400"}`}>{item.qty}</span>
                      <span className={`min-w-0 flex-1 pt-0.5 ${on ? "line-through decoration-stone-500" : ""}`}>
                        <span className={`font-semibold ${on ? "text-stone-500" : "text-stone-200"}`}>{item.name}</span>
                        <span className={`block ${on ? "text-stone-600" : "text-stone-500"}`}>{item.detail}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card title="Tools" icon={<Wrench className="h-4 w-4 text-stone-500" />} className="sm:self-start">
            <ul className="-mx-2 space-y-0.5">
              {plan.tools.map((tool) => {
                const on = kit.ticked.has(tool);
                return (
                  <li key={tool}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => kit.toggle(tool)}
                      className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-xs transition hover:bg-white/[0.03] active:bg-white/[0.06]"
                    >
                      <Tick on={on} />
                      <span className={`pt-0.5 ${on ? "text-stone-600 line-through decoration-stone-500" : "text-stone-200"}`}>{tool}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <Card title="Good to Know" icon={<AlertTriangle className="h-4 w-4 text-stone-500" />}>
          <ul className="space-y-2 text-xs leading-relaxed text-stone-300">
            {[...plan.notes, ...plan.safetyNotes].map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
                {note}
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}
