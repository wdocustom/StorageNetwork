"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MODULAR BUILD GUIDE — the interactive 3D guide for a whole design
//
// Walks the customer through the plan one section at a time:
//   1. each MODULE TYPE in the installer AssemblyGuide (3D, step by step),
//      with a module map under the top-left badge highlighting where every
//      module of that type goes and how many to build
//   2. each UNIT that needs joining / stacking / a full-width worktop /
//      wall anchoring, as an illustrated checklist around the same map
//
// Single-module designs skip the map and behave exactly like the guide
// installers use.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Home, Lightbulb, Wrench, X } from "lucide-react";
import AssemblyGuide from "@/components/visualizer/AssemblyGuide";
import SystemMap from "@/components/plans/SystemMap";
import type { CompleteDIYPlan, PlanModuleTypeBuild, PlanUnit } from "@/app/actions/generate-plan";
import { toFraction } from "@/lib/utils";

type Section = { kind: "module"; type: PlanModuleTypeBuild } | { kind: "unit"; unit: PlanUnit };

export interface GuideLinks {
  /** My Builds (or the plans page when there's no purchase token) */
  homeHref: string;
  /** Ladder jig offer or the buyer's own jig plans */
  jig?: { owned: boolean; href: string };
}

/** Home + ladder jig, always reachable from inside the guide. */
function GuideToolbar({ links }: { links: GuideLinks }) {
  return (
    <div className="flex gap-1.5">
      <Link
        href={links.homeHref}
        className="flex items-center gap-1.5 rounded-lg bg-slate-900/95 px-2.5 py-1.5 text-[11px] font-bold text-stone-200 shadow-lg backdrop-blur transition hover:text-yellow-300"
      >
        <Home className="h-3.5 w-3.5" />
        My Builds
      </Link>
      {links.jig && (
        <Link
          href={links.jig.href}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-950/90 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 shadow-lg backdrop-blur transition hover:text-emerald-200"
        >
          <Wrench className="h-3.5 w-3.5" />
          {links.jig.owned ? "My ladder jig" : "Ladder jig · $5"}
        </Link>
      )}
    </div>
  );
}

function sectionTitle(s: Section): string {
  return s.kind === "module" ? `Module ${s.type.letter}` : `Assemble Unit ${s.unit.index + 1}`;
}

function SectionNav({
  sections,
  index,
  onChange,
}: {
  sections: Section[];
  index: number;
  onChange: (i: number) => void;
}) {
  const prev = sections[index - 1];
  const next = sections[index + 1];
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(index - 1)}
        disabled={!prev}
        aria-label={prev ? `Back to ${sectionTitle(prev)}` : "No previous section"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-stone-300 transition hover:bg-slate-700 disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange(index + 1)}
        disabled={!next}
        className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-yellow-400 px-2 text-[11px] font-bold text-gray-950 transition hover:bg-yellow-300 disabled:bg-slate-800 disabled:text-stone-500"
      >
        <span className="truncate">{next ? `Next: ${sectionTitle(next)}` : "Last section"}</span>
        {next && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
      </button>
    </div>
  );
}

function ModuleHud({
  plan,
  sections,
  index,
  onChange,
}: {
  plan: CompleteDIYPlan;
  sections: Section[];
  index: number;
  onChange: (i: number) => void;
}) {
  const section = sections[index];
  if (section.kind !== "module") return null;
  const t = section.type;
  return (
    <div className="w-[170px] rounded-xl border border-yellow-400/30 bg-slate-900/95 p-2 shadow-xl backdrop-blur sm:w-[230px] sm:p-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-xs font-black text-white">
          Building <span className="text-yellow-400">Module {t.letter}</span>
        </p>
        <p className="shrink-0 text-[10px] font-bold text-stone-500">
          {index + 1}/{sections.length}
        </p>
      </div>
      <SystemMap
        design={plan.design}
        highlight={(m) => m.type === t.letter}
        className="mb-1.5 h-11 w-full sm:h-20"
        title={`Module ${t.letter} highlighted in your system`}
      />
      <p className="mb-2 text-[10px] leading-snug text-stone-400">
        {t.cols}×{t.rows}
        {t.count > 1 ? <> · <strong className="text-yellow-300">build {t.count}</strong> — quantities are per module</> : " · build 1"}
      </p>
      <SectionNav sections={sections} index={index} onChange={onChange} />
    </div>
  );
}

function UnitAssembly({
  plan,
  unit,
  sections,
  index,
  onChange,
  onClose,
  links,
}: {
  plan: CompleteDIYPlan;
  unit: PlanUnit;
  sections: Section[];
  index: number;
  onChange: (i: number) => void;
  onClose?: () => void;
  links: GuideLinks;
}) {
  return (
    <div className="h-full w-full overflow-y-auto bg-slate-950">
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-5">
        <div className="mb-4">
          <GuideToolbar links={links} />
        </div>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
              Section {index + 1} of {sections.length}
              {plan.units.length > 1 ? ` · Unit ${unit.index + 1} of ${plan.units.length}` : ""}
            </p>
            <h2 className="text-xl font-black text-white">Assemble the {unit.label} Unit</h2>
            <p className="text-xs text-stone-400">
              Modules {unit.modules.map((m) => m.type).join(" + ")} · {toFraction(unit.widthIn)}&quot; W ×{" "}
              {toFraction(unit.heightIn)}&quot; H × 30&quot; D
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close guide"
              className="rounded-full bg-slate-800 p-2.5 text-white transition hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <SystemMap
            design={plan.design}
            highlight={(m) => m.unitIndex === unit.index}
            dimensions
            className="h-44 w-full sm:h-56"
            title={`Unit ${unit.index + 1} highlighted in your system`}
          />
        </div>

        <ol className="space-y-4">
          {unit.assemblySteps.map((step) => (
            <li key={step.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-2 flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-gray-950">
                  {step.stepNumber}
                </span>
                <h3 className="text-sm font-bold text-white">{step.title}</h3>
              </div>
              <p className="mb-3 text-sm leading-relaxed text-stone-300">{step.instruction}</p>
              {step.materials.length > 0 && (
                <ul className="mb-3 space-y-1 rounded-xl bg-slate-800/60 p-3">
                  {step.materials.map((m) => (
                    <li key={m.name} className="text-xs text-stone-300">
                      <span className="font-mono font-bold text-yellow-400">{m.qty}</span> × {m.name}
                      {m.detail && <span className="text-stone-500"> — {m.detail}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-stone-500" />
                {step.tools.map((t) => (
                  <span key={t.name} className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] text-stone-300">
                    {t.name}
                  </span>
                ))}
              </div>
              {step.proTip && (
                <div className="mt-3 flex gap-2 rounded-xl bg-yellow-400/10 p-3">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-400" />
                  <p className="text-xs italic text-yellow-100/90">{step.proTip}</p>
                </div>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-6">
          <SectionNav sections={sections} index={index} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

export default function ModularBuildGuide({
  plan,
  onClose,
  links,
}: {
  plan: CompleteDIYPlan;
  onClose?: () => void;
  links: GuideLinks;
}) {
  const sections = useMemo<Section[]>(
    () => [
      ...plan.moduleTypes.map((type) => ({ kind: "module" as const, type })),
      ...plan.units.filter((u) => u.assemblySteps.length > 0).map((unit) => ({ kind: "unit" as const, unit })),
    ],
    [plan],
  );
  const [index, setIndex] = useState(0);
  const section = sections[Math.min(index, sections.length - 1)];
  const multi = sections.length > 1;
  const go = (i: number) => setIndex(Math.max(0, Math.min(sections.length - 1, i)));

  if (section.kind === "unit") {
    return (
      <UnitAssembly plan={plan} unit={section.unit} sections={sections} index={index} onChange={go} onClose={onClose} links={links} />
    );
  }

  const t = section.type;
  return (
    <AssemblyGuide
      // Remount per module so the step sequence and camera start fresh
      key={t.letter}
      cols={t.cols}
      rows={t.rows}
      toteType={t.toteType}
      hasWheels={t.hasWheels}
      hasTop={t.hasTop}
      rails="2x4"
      onClose={onClose}
      label={multi ? `Module ${t.letter}` : undefined}
      hud={
        <div className="space-y-2">
          <GuideToolbar links={links} />
          {multi && <ModuleHud plan={plan} sections={sections} index={index} onChange={go} />}
        </div>
      }
    />
  );
}
