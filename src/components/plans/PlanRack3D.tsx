"use client";

// ═══════════════════════════════════════════════════════════════════════════
// PLAN RACK 3D — a whole DIY plan design in 3D, built the way the plan
// builds it: 2×4 ripped rails, every module where it goes (side by side
// within a unit, upper tiers stacked), units side by side. Positions come
// from designLayout, the same layout as the system map and the PDF.
// ═══════════════════════════════════════════════════════════════════════════

import { Suspense, lazy, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { CASTER_IN, designLayout, type TotePlanDesign } from "@/lib/tote-plans";
import type { StackedModule3D } from "@/components/visualizer/Rack3D";

const Rack3D = lazy(() => import("@/components/visualizer/Rack3D"));

/** Every module of a design, placed for the 3D view (inches). */
export function planModules3D(design: TotePlanDesign): StackedModule3D[] {
  const layout = designLayout(design);
  return layout.modules.map((m) => {
    const unit = design.units[m.unitIndex];
    // The layout lifts rolling units by the plan's caster height; the 3D
    // adds its own caster model's height instead.
    const y = m.y - (unit.hasWheels ? CASTER_IN : 0);
    const topY = Math.max(...layout.modules.filter((o) => o.unitIndex === m.unitIndex).map((o) => o.y));
    return {
      x: m.x,
      y,
      cols: m.cols,
      rows: m.rows,
      rolling: unit.hasWheels,
      hasWheels: unit.hasWheels && y === 0,
      hasTop: unit.hasTop && m.y === topY,
    };
  });
}

export default function PlanRack3D({ design }: { design: TotePlanDesign }) {
  const modules = useMemo(() => planModules3D(design), [design]);
  const first = design.units[0];
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      }
    >
      <Rack3D
        cols={first.cols}
        rows={first.rows}
        toteType={first.toteType}
        toteColor="black"
        unitType="standard"
        orientation="standard"
        hasTotes={false}
        hasWheels={first.hasWheels}
        hasTop={first.hasTop}
        use2x4Rails
        stackedModules={modules}
      />
    </Suspense>
  );
}
