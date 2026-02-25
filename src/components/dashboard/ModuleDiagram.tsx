"use client";

import { useCallback, useMemo } from "react";
import type { CutPlanModule } from "@/lib/buildEngine";

// ═══════════════════════════════════════════════════════════════════════════
// ModuleDiagram — 2D front-facing SVG diagram of the built storage unit
// Renders color-coded modules that match the cut plan sections below.
// Click a module to scroll to its cut plan.
// ═══════════════════════════════════════════════════════════════════════════

// ── Module color palette (matches industrial theme) ─────────────────────
const MODULE_COLORS = [
  { fill: "rgba(59,130,246,0.18)", stroke: "#3b82f6", label: "#3b82f6" },   // blue
  { fill: "rgba(245,158,11,0.18)", stroke: "#f59e0b", label: "#f59e0b" },   // amber
  { fill: "rgba(168,85,247,0.18)", stroke: "#a855f7", label: "#a855f7" },   // purple
  { fill: "rgba(34,197,94,0.18)", stroke: "#22c55e", label: "#22c55e" },    // green
  { fill: "rgba(236,72,153,0.18)", stroke: "#ec4899", label: "#ec4899" },   // pink
  { fill: "rgba(6,182,212,0.18)", stroke: "#06b6d4", label: "#06b6d4" },    // cyan
];

// ── Structural constants (match buildEngine.ts) ─────────────────────────
const GAP = 1.5;           // 2x4 post width
const TIER_HEIGHT = 16;    // standard row height
const PLATE_H = 1.5;       // top/bottom plate height
const TOP_GAP = 2.5;       // gap above top rail row
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const MAX_COLS_PER_MOD = 4;
const MAX_ROWS_PER_TIER = 6;

interface ModuleDiagramProps {
  units: { cols: number; rows: number; toteType?: "HDX" | "GM" }[];
  cutPlanModules: CutPlanModule[];
  /** ID prefix for scroll targets — must match the id on each cut plan module div */
  scrollIdPrefix?: string;
}

// ── Types ────────────────────────────────────────────────────────────────
interface ModuleRect {
  x: number;
  y: number;
  w: number;
  h: number;
  moduleIndex: number;
  heightTier?: number;
  heightTierTotal?: number;
  cols: number;
  rows: number;
  colorIdx: number;
  cutPlanIdx: number; // index into cutPlanModules
}

export default function ModuleDiagram({
  units,
  cutPlanModules,
  scrollIdPrefix = "cut-module",
}: ModuleDiagramProps) {
  // ── Derive module rects from the unit configs ─────────────────────────
  const { rects, totalW, totalH } = useMemo(() => {
    const allRects: ModuleRect[] = [];
    let cpIdx = 0;             // walk through cut plan modules in order
    let unitOffsetX = 0;       // horizontal offset for multi-unit
    let maxUnitH = 0;

    for (const unit of units) {
      const opening = (unit.toteType ?? "HDX") === "GM" ? OPENING_GM : OPENING_HDX;

      // Width split (same logic as buildEngine)
      const widthModules: number[] = [];
      let rem = unit.cols;
      while (rem > MAX_COLS_PER_MOD) { widthModules.push(MAX_COLS_PER_MOD); rem -= MAX_COLS_PER_MOD; }
      if (rem > 0) widthModules.push(rem);

      // Height split
      const heightTiers: number[] = [];
      let remR = unit.rows;
      while (remR > MAX_ROWS_PER_TIER) { heightTiers.push(MAX_ROWS_PER_TIER); remR -= MAX_ROWS_PER_TIER; }
      if (remR > 0) heightTiers.push(remR);

      // Calculate full unit dimensions
      const unitW = unit.cols * opening + (unit.cols + 1) * GAP;
      const unitH = unit.rows * TIER_HEIGHT + PLATE_H * 2 + TOP_GAP;
      if (unitH > maxUnitH) maxUnitH = unitH;

      // Accumulate column offset per width module
      let modColOffset = 0;

      for (let wmi = 0; wmi < widthModules.length; wmi++) {
        const cols = widthModules[wmi];
        const modW = cols * opening + (cols + 1) * GAP;
        // Height tiers stack vertically from bottom
        let tierRowOffset = 0;

        for (let hti = 0; hti < heightTiers.length; hti++) {
          const tierRows = heightTiers[hti];
          const tierH = tierRows * TIER_HEIGHT;

          // y from top: plates + gap + rows above this tier
          const rowsAbove = heightTiers.slice(0, hti).reduce((s, r) => s + r, 0);
          const y = PLATE_H + TOP_GAP + rowsAbove * TIER_HEIGHT;

          allRects.push({
            x: unitOffsetX + modColOffset,
            y,
            w: modW,
            h: tierH,
            moduleIndex: wmi + 1,
            heightTier: heightTiers.length > 1 ? hti + 1 : undefined,
            heightTierTotal: heightTiers.length > 1 ? heightTiers.length : undefined,
            cols,
            rows: tierRows,
            colorIdx: cpIdx % MODULE_COLORS.length,
            cutPlanIdx: cpIdx,
          });
          cpIdx++;
          tierRowOffset += tierRows;
        }
        modColOffset += modW;
      }
      unitOffsetX += unitW + 4; // 4" gap between units
    }

    return {
      rects: allRects,
      totalW: unitOffsetX - (units.length > 1 ? 4 : 0),
      totalH: maxUnitH,
    };
  }, [units, cutPlanModules.length]);

  // ── Scroll handler ────────────────────────────────────────────────────
  const scrollToModule = useCallback(
    (cpIdx: number) => {
      const el = document.getElementById(`${scrollIdPrefix}-${cpIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Brief highlight pulse
        el.classList.add("ring-2", "ring-yellow-400/60");
        setTimeout(() => el.classList.remove("ring-2", "ring-yellow-400/60"), 1500);
      }
    },
    [scrollIdPrefix]
  );

  // ── SVG Dimensions ────────────────────────────────────────────────────
  const PAD = 6; // SVG padding in unit-inches
  const svgW = totalW + PAD * 2;
  const svgH = totalH + PAD * 2;

  // Render structural frame for each unit
  const unitFrames = useMemo(() => {
    const frames: JSX.Element[] = [];
    let offsetX = 0;

    for (let ui = 0; ui < units.length; ui++) {
      const unit = units[ui];
      const opening = (unit.toteType ?? "HDX") === "GM" ? OPENING_GM : OPENING_HDX;
      const unitW = unit.cols * opening + (unit.cols + 1) * GAP;
      const unitH = unit.rows * TIER_HEIGHT + PLATE_H * 2 + TOP_GAP;
      const ox = PAD + offsetX;
      const oy = PAD;

      // Bottom plate
      frames.push(
        <rect key={`bp-${ui}`} x={ox} y={oy + unitH - PLATE_H} width={unitW} height={PLATE_H}
          fill="#a58458" stroke="#7a5c34" strokeWidth={0.3} />
      );
      // Top plate
      frames.push(
        <rect key={`tp-${ui}`} x={ox} y={oy} width={unitW} height={PLATE_H}
          fill="#a58458" stroke="#7a5c34" strokeWidth={0.3} />
      );

      // Vertical posts
      for (let c = 0; c <= unit.cols; c++) {
        // Determine which width module boundary this is (for visual separation)
        const px = ox + c * (opening + GAP);
        frames.push(
          <rect key={`post-${ui}-${c}`} x={px} y={oy + PLATE_H} width={GAP}
            height={unitH - PLATE_H * 2} fill="#a58458" stroke="#7a5c34" strokeWidth={0.2} />
        );
      }

      // Tote slot outlines (subtle grid)
      for (let c = 0; c < unit.cols; c++) {
        const slotX = ox + GAP + c * (opening + GAP);
        for (let r = 0; r < unit.rows; r++) {
          const slotY = oy + PLATE_H + TOP_GAP + r * TIER_HEIGHT;
          frames.push(
            <rect key={`slot-${ui}-${c}-${r}`} x={slotX} y={slotY} width={opening} height={TIER_HEIGHT}
              fill="rgba(30,41,59,0.5)" stroke="rgba(71,85,105,0.3)" strokeWidth={0.15} rx={0.3} />
          );
        }
      }

      offsetX += unitW + 4;
    }
    return frames;
  }, [units]);

  if (rects.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
        <svg className="h-4 w-4 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
        Module Layout
      </h2>

      {/* SVG diagram */}
      <div className="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-950 p-2">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="mx-auto block w-full"
          style={{ maxHeight: "280px" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid pattern background */}
          <defs>
            <pattern id="mod-grid" width="4" height="4" patternUnits="userSpaceOnUse">
              <path d="M 4 0 L 0 0 0 4" fill="none" stroke="rgba(71,85,105,0.15)" strokeWidth="0.1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={svgW} height={svgH} fill="url(#mod-grid)" />

          {/* Structural frame (posts, plates, tote slots) */}
          {unitFrames}

          {/* Color-coded module overlays */}
          {rects.map((r, i) => {
            const color = MODULE_COLORS[r.colorIdx];
            return (
              <g
                key={i}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onClick={() => scrollToModule(r.cutPlanIdx)}
              >
                {/* Module highlight rect */}
                <rect
                  x={PAD + r.x + GAP}
                  y={PAD + r.y}
                  width={r.w - GAP * 2}
                  height={r.h}
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth={0.6}
                  strokeDasharray="2 1"
                  rx={0.6}
                />
                {/* Module label */}
                <text
                  x={PAD + r.x + r.w / 2}
                  y={PAD + r.y + r.h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={color.label}
                  fontSize={Math.min(r.h * 0.3, r.w * 0.12, 5)}
                  fontWeight="bold"
                  fontFamily="ui-monospace, monospace"
                  style={{ textShadow: "0 0 3px rgba(0,0,0,0.8)" }}
                >
                  M{r.moduleIndex}{r.heightTier ? `-T${r.heightTier}` : ""}
                </text>
                <text
                  x={PAD + r.x + r.w / 2}
                  y={PAD + r.y + r.h / 2 + Math.min(r.h * 0.3, r.w * 0.12, 5) * 0.9}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={color.label}
                  fontSize={Math.min(r.h * 0.18, r.w * 0.08, 3)}
                  fontFamily="ui-monospace, monospace"
                  opacity={0.7}
                >
                  {r.cols}×{r.rows}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Click hint */}
        <p className="mt-2 text-center text-[10px] text-stone-600">
          Click a module to jump to its cut plan
        </p>
      </div>

      {/* Legend chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {rects.map((r, i) => {
          const color = MODULE_COLORS[r.colorIdx];
          const mod = cutPlanModules[r.cutPlanIdx];
          const label = mod
            ? `Module ${mod.moduleIndex}${mod.heightTier ? ` T${mod.heightTier}/${mod.heightTierTotal}` : ""}`
            : `M${r.moduleIndex}${r.heightTier ? `-T${r.heightTier}` : ""}`;
          return (
            <button
              key={i}
              onClick={() => scrollToModule(r.cutPlanIdx)}
              className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-slate-800"
              style={{ borderColor: color.stroke, color: color.label }}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: color.stroke }}
              />
              {label}
              <span className="text-stone-500">({r.cols}×{r.rows})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
