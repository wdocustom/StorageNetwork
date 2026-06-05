"use client";

import { useCallback, useMemo } from "react";
import type { CutPlanModule } from "@/lib/buildEngine.types";

// ═══════════════════════════════════════════════════════════════════════════
// ModuleDiagram — 2D front-facing SVG diagram of the built storage unit
// Each module is drawn as its own colored structural frame (posts, plates,
// slot grid). Build-order numbering: bottom tiers first L→R, then upper.
// Click a module to scroll to its cut plan.
// ═══════════════════════════════════════════════════════════════════════════

// ── Module color palette ─────────────────────────────────────────────────
const MODULE_COLORS = [
  { fill: "rgba(59,130,246,0.12)",  stroke: "#3b82f6", label: "#3b82f6" },  // blue
  { fill: "rgba(245,158,11,0.12)",  stroke: "#f59e0b", label: "#f59e0b" },  // amber
  { fill: "rgba(168,85,247,0.12)",  stroke: "#a855f7", label: "#a855f7" },  // purple
  { fill: "rgba(34,197,94,0.12)",   stroke: "#22c55e", label: "#22c55e" },  // green
  { fill: "rgba(236,72,153,0.12)",  stroke: "#ec4899", label: "#ec4899" },  // pink
  { fill: "rgba(6,182,212,0.12)",   stroke: "#06b6d4", label: "#06b6d4" },  // cyan
];

/** Returns the build-order color and label number for each cut-plan index.
 *  Build order: unit 1 first, then unit 2, etc.
 *  Within each unit: bottom tiers first (L→R), then upper tiers (L→R).
 *  Shared by the diagram and the cut plan border colors. */
export function getBuildOrderColors(
  modules: CutPlanModule[],
): { color: string; buildOrder: number }[] {
  if (modules.length === 0) return [];
  // Build an array of { cpIdx, unitIndex, heightTier, moduleIndex } and sort by build order
  const indexed = modules.map((m, i) => ({
    cpIdx: i,
    unit: m.unitIndex ?? 0,          // 0-based unit index
    tier: m.heightTier ?? 1,         // 1-based; bottom = 1
    widthMod: m.moduleIndex,         // 1-based; left = 1
  }));
  // Sort: unit first, then bottom first (ascending tier), then left first (ascending widthMod)
  const sorted = [...indexed].sort((a, b) => {
    if (a.unit !== b.unit) return a.unit - b.unit;
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.widthMod - b.widthMod;
  });
  // Map build order back to cpIdx positions
  const result: { color: string; buildOrder: number }[] = new Array(modules.length);
  sorted.forEach((s, buildIdx) => {
    result[s.cpIdx] = {
      color: MODULE_COLORS[buildIdx % MODULE_COLORS.length].stroke,
      buildOrder: buildIdx + 1,
    };
  });
  return result;
}

// ── Structural constants (match buildEngine.ts) ─────────────────────────
const GAP = 1.5;           // 2x4 post width
const TIER_HEIGHT = 16;    // standard row height
const PLATE_H = 1.5;       // top/bottom plate height
const TOP_GAP = 2.5;       // gap above top rail row
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const MAX_COLS_PER_MOD = 4;
const MAX_ROWS_PER_TIER = 6;

// 2x4 Rail Construction constants — must mirror src/lib/buildEngine.ts.
// Rails 1-5 sit on a uniform 15.75" pitch; rail 6 sits at 92.5" with the
// upright sized to the full 96" stock (top gap above rail 6 is 3.5").
const RAILS_2X4_OPENING = 21;
const RAILS_2X4_TOP_GAP = 2.75;
const RAILS_2X4_POSITIONS = [13.75, 29.5, 45.25, 61, 76.75, 92.5];
const RAILS_2X4_MAX_ROWS = 6;
const RAILS_2X4_STOCK_LENGTH = 96; // 8 ft 2x4 stock

interface ModuleDiagramProps {
  units: { cols: number; rows: number; toteType?: "HDX" | "GM" }[];
  cutPlanModules: CutPlanModule[];
  scrollIdPrefix?: string;
  use2x4Rails?: boolean;
}

interface ModuleRect {
  // Position & size within the full unit (SVG coords, before PAD)
  x: number;       // left edge of this module's frame
  y: number;       // top edge (including its own top plate)
  w: number;       // full width including outer posts
  h: number;       // full height including plates
  cols: number;
  rows: number;
  unitIdx: number;       // which unit this module belongs to
  widthModIdx: number;
  heightTierIdx: number;
  heightTierTotal: number;
  cpIdx: number;   // index into cutPlanModules (engine order)
  buildOrder: number; // display label (bottom-first L→R)
  colorIdx: number;
}

export default function ModuleDiagram({
  units,
  cutPlanModules,
  scrollIdPrefix = "cut-module",
  use2x4Rails = false,
}: ModuleDiagramProps) {
  const { rects, totalW, totalH } = useMemo(() => {
    // First pass: create rects in engine order (width-first, then height)
    // so cpIdx lines up with cutPlanModules array index.
    const raw: Omit<ModuleRect, "buildOrder" | "colorIdx">[] = [];
    let cpIdx = 0;
    let unitOffsetX = 0;
    let maxUnitH = 0;

    for (let ui = 0; ui < units.length; ui++) {
      const unit = units[ui];
      const opening = use2x4Rails ? RAILS_2X4_OPENING : ((unit.toteType ?? "HDX") === "GM" ? OPENING_GM : OPENING_HDX);
      const topGap = use2x4Rails ? RAILS_2X4_TOP_GAP : TOP_GAP;
      const maxRowsPerTier = use2x4Rails ? RAILS_2X4_MAX_ROWS : MAX_ROWS_PER_TIER;
      const effectiveRows = use2x4Rails ? Math.min(unit.rows, RAILS_2X4_MAX_ROWS) : unit.rows;

      // Width split
      const widthMods: number[] = [];
      let rem = unit.cols;
      while (rem > MAX_COLS_PER_MOD) { widthMods.push(MAX_COLS_PER_MOD); rem -= MAX_COLS_PER_MOD; }
      if (rem > 0) widthMods.push(rem);

      // Height split
      const heightTiers: number[] = [];
      let remR = effectiveRows;
      while (remR > maxRowsPerTier) { heightTiers.push(maxRowsPerTier); remR -= maxRowsPerTier; }
      if (remR > 0) heightTiers.push(remR);

      // Unit height: 2x4 rail mode uses fixed positions (from bottom of posts + plates)
      let unitH: number;
      if (use2x4Rails) {
        // At max rows (6), the post is the full 96" stock — top gap is 3.5".
        // Below that, post = topRailPos + 2.75" top gap.
        const postHeight = effectiveRows >= RAILS_2X4_MAX_ROWS
          ? RAILS_2X4_STOCK_LENGTH
          : (RAILS_2X4_POSITIONS[effectiveRows - 1] ?? RAILS_2X4_POSITIONS[0]) + RAILS_2X4_TOP_GAP;
        unitH = PLATE_H * 2 + postHeight;
      } else {
        unitH = unit.rows * TIER_HEIGHT + PLATE_H * 2 + TOP_GAP;
      }
      if (unitH > maxUnitH) maxUnitH = unitH;

      let modColOffset = 0;

      for (let wmi = 0; wmi < widthMods.length; wmi++) {
        const cols = widthMods[wmi];
        const modW = cols * opening + (cols + 1) * GAP;

        for (let hti = 0; hti < heightTiers.length; hti++) {
          const tierRows = heightTiers[hti];

          let tierH: number;
          let y: number;
          let h: number;

          if (use2x4Rails) {
            // 2x4 mode: single tier, height from rail positions + both plates.
            // At max rows (6), post = full 96" stock; otherwise topRailPos + 2.75".
            tierH = tierRows >= RAILS_2X4_MAX_ROWS
              ? RAILS_2X4_STOCK_LENGTH
              : (RAILS_2X4_POSITIONS[tierRows - 1] ?? RAILS_2X4_POSITIONS[0]) + RAILS_2X4_TOP_GAP;
            y = 0;
            h = PLATE_H * 2 + tierH; // bottom plate + posts + top plate
          } else {
            tierH = tierRows * TIER_HEIGHT;
            // y: tiers ABOVE this one (higher index = physically higher = top of SVG)
            const rowsAbove = heightTiers.slice(hti + 1).reduce((s, r) => s + r, 0);
            y = PLATE_H + topGap + rowsAbove * TIER_HEIGHT - PLATE_H;
            h = tierH + PLATE_H * 2;
          }

          raw.push({
            x: unitOffsetX + modColOffset,
            y,
            w: modW,
            h,
            cols,
            rows: tierRows,
            unitIdx: ui,
            widthModIdx: wmi,
            heightTierIdx: hti,
            heightTierTotal: heightTiers.length,
            cpIdx,
          });
          cpIdx++;
        }
        modColOffset += modW;
      }
      unitOffsetX += (unit.cols * opening + (unit.cols + 1) * GAP) + 4;
    }

    // Second pass: assign build order — unit by unit, bottom tiers first
    // (L→R), then upper tiers (L→R).
    const sorted = [...raw].sort((a, b) => {
      // Group by unit first
      if (a.unitIdx !== b.unitIdx) return a.unitIdx - b.unitIdx;
      // Within each unit: bottom first (ascending tierIdx), then left first
      if (a.heightTierIdx !== b.heightTierIdx) return a.heightTierIdx - b.heightTierIdx;
      return a.widthModIdx - b.widthModIdx;
    });

    // Map build order back, assign colors by build order
    const allRects: ModuleRect[] = raw.map((r) => {
      const buildIdx = sorted.findIndex((s) => s.cpIdx === r.cpIdx);
      return {
        ...r,
        buildOrder: buildIdx + 1,
        colorIdx: buildIdx % MODULE_COLORS.length,
      };
    });

    const tw = unitOffsetX - (units.length > 1 ? 4 : 0);
    return { rects: allRects, totalW: tw, totalH: maxUnitH };
  }, [units, cutPlanModules.length, use2x4Rails]);

  // ── Scroll handler ────────────────────────────────────────────────────
  const scrollToModule = useCallback(
    (cpIdx: number) => {
      const el = document.getElementById(`${scrollIdPrefix}-${cpIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-yellow-400/60");
        setTimeout(() => el.classList.remove("ring-2", "ring-yellow-400/60"), 1500);
      }
    },
    [scrollIdPrefix],
  );

  // ── SVG layout ────────────────────────────────────────────────────────
  const PAD = 4;
  const svgW = totalW + PAD * 2;
  const svgH = totalH + PAD * 2;

  if (rects.length === 0) return null;

  // Sort rects for rendering: draw by build order so later modules overlay
  const sortedForRender = [...rects].sort((a, b) => a.buildOrder - b.buildOrder);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
        <svg className="h-4 w-4 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
        Module Layout
      </h2>

      <div className="relative overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 p-2">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="mx-auto block w-full"
          style={{ maxHeight: "300px" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Subtle grid background */}
          <defs>
            <pattern id="mod-grid" width="4" height="4" patternUnits="userSpaceOnUse">
              <path d="M 4 0 L 0 0 0 4" fill="none" stroke="rgba(71,85,105,0.12)" strokeWidth="0.08" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={svgW} height={svgH} fill="url(#mod-grid)" />

          {/* ── Render each module as its own colored frame ─────────── */}
          {sortedForRender.map((r) => {
            const color = MODULE_COLORS[r.colorIdx];
            const opening = use2x4Rails ? RAILS_2X4_OPENING : ((units[r.unitIdx]?.toteType ?? "HDX") === "GM" ? OPENING_GM : OPENING_HDX);
            const ox = PAD + r.x;
            const oy = PAD + r.y;
            const postH = r.h - PLATE_H * 2;
            const contentTop = oy + PLATE_H;

            return (
              <g
                key={r.cpIdx}
                className="cursor-pointer"
                onClick={() => scrollToModule(r.cpIdx)}
              >
                {/* Module background fill */}
                <rect
                  x={ox} y={oy} width={r.w} height={r.h}
                  fill={color.fill} rx={0.5}
                />

                {/* Top plate */}
                <rect
                  x={ox} y={oy} width={r.w} height={PLATE_H}
                  fill={color.stroke} opacity={0.5} rx={0.3}
                />
                <rect
                  x={ox} y={oy} width={r.w} height={PLATE_H}
                  fill="none" stroke={color.stroke} strokeWidth={0.35} rx={0.3}
                />

                {/* Bottom plate */}
                <rect
                  x={ox} y={oy + r.h - PLATE_H} width={r.w} height={PLATE_H}
                  fill={color.stroke} opacity={0.5} rx={0.3}
                />
                <rect
                  x={ox} y={oy + r.h - PLATE_H} width={r.w} height={PLATE_H}
                  fill="none" stroke={color.stroke} strokeWidth={0.35} rx={0.3}
                />

                {/* Vertical posts */}
                {Array.from({ length: r.cols + 1 }, (_, c) => {
                  const px = ox + c * (opening + GAP);
                  return (
                    <rect
                      key={`p-${c}`}
                      x={px} y={contentTop} width={GAP} height={postH}
                      fill={color.stroke} opacity={0.35}
                      stroke={color.stroke} strokeWidth={0.25}
                    />
                  );
                })}

                {/* Tote slot grid */}
                {Array.from({ length: r.cols }, (_, c) =>
                  Array.from({ length: r.rows }, (_, row) => {
                    const slotX = ox + GAP + c * (opening + GAP);
                    let slotY: number;
                    let slotH: number;
                    if (use2x4Rails) {
                      // 2x4 mode: slots positioned using fixed rail heights (from bottom of unit)
                      // Each slot spans from one rail to the next (or from bottom plate to first rail)
                      const railTop = RAILS_2X4_POSITIONS[row];
                      const prevRailTop = row > 0 ? RAILS_2X4_POSITIONS[row - 1] : 0;
                      slotY = oy + r.h - railTop; // SVG y is from top, rail positions are from bottom
                      slotH = railTop - prevRailTop;
                    } else {
                      slotY = contentTop + row * TIER_HEIGHT;
                      slotH = TIER_HEIGHT;
                    }
                    return (
                      <rect
                        key={`s-${c}-${row}`}
                        x={slotX + 0.5} y={slotY + 0.5}
                        width={opening - 1} height={slotH - 1}
                        fill="none" stroke={color.stroke} strokeWidth={0.2}
                        opacity={0.3} rx={0.3}
                      />
                    );
                  }),
                )}

                {/* Outer border */}
                <rect
                  x={ox} y={oy} width={r.w} height={r.h}
                  fill="none" stroke={color.stroke} strokeWidth={0.6} rx={0.5}
                />

                {/* Build order number (large, centered) */}
                <text
                  x={ox + r.w / 2}
                  y={oy + r.h / 2 - 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={color.label}
                  fontSize={Math.min(r.h * 0.35, r.w * 0.14, 7)}
                  fontWeight="bold"
                  fontFamily="ui-monospace, monospace"
                  style={{ textShadow: "0 0 4px rgba(0,0,0,0.9)" }}
                >
                  Module {r.buildOrder}
                </text>
                {/* Dimensions sub-label */}
                <text
                  x={ox + r.w / 2}
                  y={oy + r.h / 2 + Math.min(r.h * 0.35, r.w * 0.14, 7) * 0.75}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={color.label}
                  fontSize={Math.min(r.h * 0.18, r.w * 0.08, 3.5)}
                  fontFamily="ui-monospace, monospace"
                  opacity={0.65}
                >
                  {r.cols}×{r.rows}
                  {r.heightTierTotal > 1 && ` (T${r.heightTierIdx + 1})`}
                </text>
              </g>
            );
          })}
        </svg>

        <p className="mt-2 text-center text-[10px] text-stone-600">
          Click a module to jump to its cut plan
        </p>
      </div>

      {/* Legend chips — sorted by build order */}
      <div className="mt-3 flex flex-wrap gap-2">
        {[...rects]
          .sort((a, b) => a.buildOrder - b.buildOrder)
          .map((r) => {
            const color = MODULE_COLORS[r.colorIdx];
            return (
              <button
                key={r.cpIdx}
                onClick={() => scrollToModule(r.cpIdx)}
                className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-zinc-800"
                style={{ borderColor: color.stroke, color: color.label }}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: color.stroke }}
                />
                Module {r.buildOrder}
                <span className="text-stone-500">
                  ({r.cols}×{r.rows}{r.heightTierTotal > 1 ? ` T${r.heightTierIdx + 1}` : ""})
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
