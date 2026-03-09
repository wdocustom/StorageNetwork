"use client";

import { useCallback, useEffect, useRef } from "react";
import { create2DWoodPattern, create2DPlywoodPattern } from "./woodTextures";
import type { SectionAddon } from "@/types/viewModels";

// ═══════════════════════════════════════════════════════════════════════════
// BlueprintCanvas — 2D visual-only rendering (dimensions from server)
// Fast, lightweight — default view for the configurator.
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";
type ToteColor = "black" | "clear";
type UnitType = "standard" | "mini";
type Orientation = "standard" | "sideways";

/** Sub-unit for compound presets */
interface SubUnit {
  cols: number;
  rows: number;
  totalW: number;
  totalH: number;
  hasTop: boolean;
  hasWheels: boolean;
}

/** Open shelving config for 2D rendering */
interface ShelvingConfig2D {
  widthIn: number;
  frameH: number;
  depth: number;
  shelves: number;
}

interface BlueprintCanvasProps {
  cols: number;
  rows: number;
  toteType: ToteType;
  toteColor: ToteColor;
  unitType: UnitType;
  orientation: Orientation;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  totalW: number;
  totalH: number;
  /** When set, renders compound preset (multiple sub-units side by side) */
  presetUnits?: SubUnit[];
  /** Per-section addons (doors, side panels, rail removal, hinges) */
  addons?: SectionAddon[];
  /** When set, renders an open shelving unit instead of a tote organizer */
  shelvingConfig?: ShelvingConfig2D;
}

// Wheel height constant (industrial casters)
const WHEEL_HEIGHT = 2.75;

export default function BlueprintCanvas({
  cols,
  rows,
  toteType,
  toteColor,
  unitType,
  orientation,
  hasTotes,
  hasWheels,
  hasTop,
  totalW,
  totalH,
  presetUnits,
  addons,
  shelvingConfig,
}: BlueprintCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Unit-type specific dimensions
  const isMini = unitType === "mini";
  const isSideways = unitType === "standard" && orientation === "sideways";
  const RENDER_GAP = 1.5; // Post width (same for both)
  const RENDER_TIER = isMini ? 7 : 16; // Vertical spacing
  const RENDER_PLATE = 1.5;
  const RENDER_TOP_GAP = isMini ? 0 : 2.5; // Mini has no top plate gap
  const RENDER_FIRST_RAIL = isMini ? 5.25 : 13; // First rail height from bottom
  const PLY_TOP_H = 0.75; // Plywood top thickness
  // Opening width: sideways uses 30.25", standard uses tote width
  const opening = isMini ? 8.25 : (isSideways ? 30.25 : (toteType === "HDX" ? 19.75 : 20.75));

  // Calculate dimensions (frame height without wheels)
  const calcW = cols * opening + (cols + 1) * RENDER_GAP;
  const calcH = isMini
    ? RENDER_PLATE + RENDER_FIRST_RAIL + (rows - 1) * RENDER_TIER + 2 + PLY_TOP_H
    : rows * RENDER_TIER + RENDER_PLATE * 2 + RENDER_TOP_GAP;

  const realW = totalW > 0 ? totalW : calcW;
  // Use totalH from server which now includes wheel height if applicable
  const realH = totalH > 0 ? totalH : calcH;

  // ── Helper: draw a single rack unit at a given X offset ──────────────
  const drawSingleUnit = useCallback((
    ctx: CanvasRenderingContext2D,
    unitCols: number,
    unitRows: number,
    unitRealW: number,
    unitHasWheels: boolean,
    unitHasTop: boolean,
    startX: number,
    startY: number,
    scale: number,
    unitAddons?: SectionAddon[],
  ) => {
    const woodPattern = create2DWoodPattern(ctx);
    const plywoodPattern = create2DPlywoodPattern(ctx);
    const woodFill = woodPattern || "#e2b686";
    const woodStroke = "#925f32";
    const plywoodFill = plywoodPattern || "#f3d2a3";

    const unitFrameH = isMini
      ? (RENDER_PLATE + RENDER_FIRST_RAIL + (unitRows - 1) * RENDER_TIER + 2 + PLY_TOP_H)
      : (unitRows * RENDER_TIER + RENDER_PLATE * 2 + RENDER_TOP_GAP);
    const pFrameH = unitFrameH * scale;
    const pStud = RENDER_GAP * scale;
    const pBay = opening * scale;
    const pPlate = RENDER_PLATE * scale;
    const pTopGap = RENDER_TOP_GAP * scale;
    const pTotalW = unitRealW * scale;

    ctx.fillStyle = woodFill;
    ctx.strokeStyle = woodStroke;
    ctx.lineWidth = 2;

    // Wheels
    if (unitHasWheels) {
      const wSize = 5 * scale;
      const wY = startY + pFrameH;
      ctx.fillStyle = "#334155";
      ctx.strokeStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(startX + pStud * 2, wY + wSize / 2, wSize / 2, 0, 2 * Math.PI);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(startX + pTotalW - pStud * 2, wY + wSize / 2, wSize / 2, 0, 2 * Math.PI);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = woodFill;
      ctx.strokeStyle = woodStroke;
    }

    // Bottom plate
    ctx.fillRect(startX, startY + pFrameH - pPlate, pTotalW, pPlate);
    ctx.strokeRect(startX, startY + pFrameH - pPlate, pTotalW, pPlate);

    // Top 2x4 plate (Standard only)
    if (!isMini) {
      ctx.fillRect(startX, startY, pTotalW, pPlate);
      ctx.strokeRect(startX, startY, pTotalW, pPlate);
    }

    // Vertical posts
    const postH = isMini ? pFrameH - pPlate : pFrameH - pPlate * 2;
    const postY = isMini ? startY : startY + pPlate;
    for (let i = 0; i <= unitCols; i++) {
      const x = startX + i * (pBay + pStud);
      ctx.fillStyle = woodFill;
      ctx.strokeStyle = woodStroke;
      ctx.fillRect(x, postY, pStud, postH);
      ctx.strokeRect(x, postY, pStud, postH);
    }

    // Rails + Totes (with rail-skip for rail_removed addons)
    const railH = 0.75 * scale;
    const railW = (isMini ? 1.0 : 1.875) * scale;
    for (let c = 0; c < unitCols; c++) {
      const bayLeftX = startX + pStud + c * (pBay + pStud);
      const bayRightX = bayLeftX + pBay;
      for (let r = 0; r < unitRows; r++) {
        // Check if rails are removed for this cell
        const isRailRemoved = unitAddons?.some(
          (a) => a.type === "rail_removed" && a.target === c && (a.row === undefined || a.row === r)
        );

        let railY: number;
        if (isMini) {
          const railFromBottom = RENDER_FIRST_RAIL + r * RENDER_TIER;
          railY = startY + pFrameH - pPlate - railFromBottom * scale - railH / 2;
        } else {
          // Invert row for canvas coords: row 0 = bottom (large Y), highest row = top (small Y)
          const invertedR = unitRows - 1 - r;
          railY = startY + pPlate + pTopGap + invertedR * RENDER_TIER * scale;
        }

        if (!isRailRemoved) {
          ctx.fillStyle = woodFill;
          ctx.strokeStyle = woodStroke;
          ctx.fillRect(bayLeftX, railY, railW, railH);
          ctx.strokeRect(bayLeftX, railY, railW, railH);
          ctx.fillRect(bayRightX - railW, railY, railW, railH);
          ctx.strokeRect(bayRightX - railW, railY, railW, railH);
        } else {
          // Draw an "X" to indicate removed rails
          ctx.save();
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(bayLeftX + 2, railY - 1);
          ctx.lineTo(bayRightX - 2, railY + railH + 1);
          ctx.moveTo(bayRightX - 2, railY - 1);
          ctx.lineTo(bayLeftX + 2, railY + railH + 1);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        // Check if shelf is placed for this cell
        const hasShelf = unitAddons?.some(
          (a) => a.type === "shelf" && a.target === c && (a.row === undefined || a.row === r)
        );

        if (hasShelf && !isRailRemoved) {
          // Draw shelf as a filled plywood rectangle on top of rails
          const shelfH = 0.75 * scale;
          ctx.fillStyle = "#c4a882";
          ctx.strokeStyle = "#a0845e";
          ctx.lineWidth = 1.5;
          ctx.fillRect(bayLeftX, railY - shelfH, pBay, shelfH);
          ctx.strokeRect(bayLeftX, railY - shelfH, pBay, shelfH);
          ctx.lineWidth = 2;
        }

        if (hasTotes && !isRailRemoved && !hasShelf) {
          const toteBodyH = isMini ? 6.25 : 11;
          const tW = pBay * 0.94;
          const tH = toteBodyH * scale;
          const tX = bayLeftX + (pBay - tW) / 2;
          const lidH = (isMini ? 0.75 : 1.0) * scale;
          ctx.fillStyle = "#fbbf24";
          ctx.strokeStyle = "#d97706";
          ctx.fillRect(tX, railY - lidH, tW, lidH);
          ctx.strokeRect(tX, railY - lidH, tW, lidH);
          const bodyW = tW * 0.9;
          const bodyX = tX + (tW - bodyW) / 2;
          const bodyY = railY;
          const bottomPlateTop = startY + pFrameH - pPlate;
          const maxBodyH = Math.max(0, bottomPlateTop - bodyY);
          const clampedBodyH = Math.min(tH, maxBodyH);
          const isClear = !isMini && toteType === "HDX" && toteColor === "clear";
          ctx.fillStyle = (isMini || isClear) ? "#cbd5e1" : "#1e293b";
          ctx.strokeStyle = (isMini || isClear) ? "#64748b" : "#0f172a";
          ctx.lineWidth = isMini ? 1.5 : 2;
          ctx.fillRect(bodyX, bodyY, bodyW, clampedBodyH);
          ctx.strokeRect(bodyX, bodyY, bodyW, clampedBodyH);
          ctx.lineWidth = 2;
        }

        // Door annotation — only drawn once per column (r === 0) when doors_on is active
        // Full-height column doors: one door per column spanning all rows
        if (r === 0) {
          const hasDoors = unitAddons?.some(
            (a) => a.type === "plywood_door" && a.target === "doors_on"
          );
          if (hasDoors) {
            ctx.save();
            ctx.strokeStyle = "#d97706";
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            const doorW = pBay + 2; // slightly larger than opening
            const panelTop = isMini ? startY : startY + pPlate;
            const panelBot = isMini ? startY + pFrameH - pPlate : startY + pFrameH - pPlate;
            const doorH = panelBot - panelTop;
            const doorX = bayLeftX + (pBay - doorW) / 2;
            const doorY = panelTop;
            ctx.fillStyle = "rgba(217, 119, 6, 0.08)";
            ctx.fillRect(doorX, doorY, doorW, doorH);
            ctx.strokeRect(doorX, doorY, doorW, doorH);
            // "DOOR" label
            ctx.fillStyle = "#d97706";
            ctx.font = `bold ${Math.max(8, Math.round(scale * 3))}px Arial`;
            ctx.textAlign = "center";
            ctx.fillText("DOOR", doorX + doorW / 2, doorY + doorH / 2 + 3);
            ctx.setLineDash([]);
            ctx.restore();
          }
        }
      }
    }

    // Side panels — shaded rectangles on left/right edges
    if (unitAddons) {
      const hasLeftPanel = unitAddons.some((a) => a.type === "side_panel" && a.target === "left");
      const hasRightPanel = unitAddons.some((a) => a.type === "side_panel" && a.target === "right");
      const panelW = 3 * scale;
      const panelH = isMini ? pFrameH - pPlate : pFrameH - pPlate * 2;
      const panelY = isMini ? startY : startY + pPlate;

      if (hasLeftPanel) {
        ctx.save();
        ctx.fillStyle = "rgba(217, 119, 6, 0.15)";
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.fillRect(startX - panelW, panelY, panelW, panelH);
        ctx.strokeRect(startX - panelW, panelY, panelW, panelH);
        ctx.setLineDash([]);
        ctx.restore();
      }
      if (hasRightPanel) {
        ctx.save();
        ctx.fillStyle = "rgba(217, 119, 6, 0.15)";
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.fillRect(startX + pTotalW, panelY, panelW, panelH);
        ctx.strokeRect(startX + pTotalW, panelY, panelW, panelH);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // Plywood top (flush with unit sides — no overhang)
    if (unitHasTop) {
      const topThick = PLY_TOP_H * scale;
      ctx.fillStyle = plywoodFill;
      ctx.strokeStyle = woodStroke;
      ctx.fillRect(startX, startY - topThick, pTotalW, topThick);
      ctx.strokeRect(startX, startY - topThick, pTotalW, topThick);
    }
  }, [isMini, opening, hasTotes, toteType, toteColor, RENDER_TIER, RENDER_FIRST_RAIL, RENDER_PLATE, RENDER_GAP, RENDER_TOP_GAP]);

  // ── Helper: draw an open shelving unit (front view) ────────────────
  const drawShelvingUnit = useCallback((
    ctx: CanvasRenderingContext2D,
    config: ShelvingConfig2D,
    canvasW: number,
    canvasH: number,
  ) => {
    const { widthIn, frameH, depth, shelves } = config;
    const woodPattern = create2DWoodPattern(ctx);
    const plywoodPattern = create2DPlywoodPattern(ctx);
    const woodFill = woodPattern || "#e2b686";
    const woodStroke = "#925f32";
    const plywoodFill = plywoodPattern || "#f3d2a3";

    // Structural constants (matching 3D)
    const POST_W = 1.5;    // 2×4 narrow face
    const POST_D = 3.5;    // 2×4 wide face (support height on edge)
    const PLATE_H = 1.5;   // bottom plate height
    const PLY_H = 0.75;    // plywood thickness

    const totalW = widthIn;
    const totalH = frameH;

    // Scale to fit canvas
    const margin = 40;
    const safeW = canvasW - margin * 2;
    const safeH = canvasH - margin * 2;
    const scale = Math.min(safeW / totalW, safeH / totalH);
    if (scale <= 0 || !isFinite(scale)) return;

    const startX = (canvasW - totalW * scale) / 2;
    const startY = (canvasH - totalH * scale) / 2;

    const pTotalW = totalW * scale;
    const pTotalH = totalH * scale;
    const pPostW = POST_W * scale;
    const pPlateH = PLATE_H * scale;
    const pSupportH = POST_D * scale;  // supports are 2×4 on edge
    const pPlyH = PLY_H * scale;

    ctx.lineWidth = 2;

    // ── Bottom plates (front & back — we draw as one thick plate) ──
    ctx.fillStyle = woodFill;
    ctx.strokeStyle = woodStroke;
    ctx.fillRect(startX, startY + pTotalH - pPlateH, pTotalW, pPlateH);
    ctx.strokeRect(startX, startY + pTotalH - pPlateH, pTotalW, pPlateH);

    // ── Corner posts ──────────────────────────────────────────────
    const postTop = startY + pPlyH; // below top plywood cap
    const postBot = startY + pTotalH - pPlateH;
    const postH = postBot - postTop;

    // Left post
    ctx.fillStyle = woodFill;
    ctx.strokeStyle = woodStroke;
    ctx.fillRect(startX, postTop, pPostW, postH);
    ctx.strokeRect(startX, postTop, pPostW, postH);

    // Right post
    ctx.fillRect(startX + pTotalW - pPostW, postTop, pPostW, postH);
    ctx.strokeRect(startX + pTotalW - pPostW, postTop, pPostW, postH);

    // ── Interior shelf levels ─────────────────────────────────────
    // Same logic as 3D: bottom shelf sits on bottom plate, middle shelves evenly spaced
    const shelfYPositions: number[] = [];
    // Bottom shelf: support sits on the bottom plate
    shelfYPositions.push(PLATE_H);
    // Middle shelves: evenly spaced between bottom shelf top and post tops
    if (shelves > 0) {
      const regionBottom = PLATE_H + POST_D + PLY_H; // above bottom shelf
      const regionTop = frameH - PLY_H;               // up to post tops
      for (let i = 0; i < shelves; i++) {
        const y = regionBottom + ((i + 1) / (shelves + 1)) * (regionTop - regionBottom);
        shelfYPositions.push(y);
      }
    }

    for (const shelfBaseY of shelfYPositions) {
      // Convert from bottom-up inches to canvas top-down pixels
      const supportTopPx = startY + pTotalH - (shelfBaseY + POST_D) * scale;
      const supportLeftX = startX + pPostW;
      const supportW = POST_W * scale; // support is 1.5" wide

      // Left support
      ctx.fillStyle = woodFill;
      ctx.strokeStyle = woodStroke;
      ctx.fillRect(supportLeftX, supportTopPx, supportW, pSupportH);
      ctx.strokeRect(supportLeftX, supportTopPx, supportW, pSupportH);

      // Right support
      const rightSupportX = startX + pTotalW - pPostW - supportW;
      ctx.fillRect(rightSupportX, supportTopPx, supportW, pSupportH);
      ctx.strokeRect(rightSupportX, supportTopPx, supportW, pSupportH);

      // Plywood shelf
      const plyTopPx = supportTopPx - pPlyH;
      ctx.fillStyle = plywoodFill;
      ctx.strokeStyle = woodStroke;
      ctx.fillRect(startX, plyTopPx, pTotalW, pPlyH);
      ctx.strokeRect(startX, plyTopPx, pTotalW, pPlyH);
    }

    // ── Top plywood cap ───────────────────────────────────────────
    ctx.fillStyle = plywoodFill;
    ctx.strokeStyle = woodStroke;
    ctx.fillRect(startX, startY, pTotalW, pPlyH);
    ctx.strokeRect(startX, startY, pTotalW, pPlyH);

    // ── "OPEN SHELVING" label in center ───────────────────────────
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.font = `bold ${Math.max(12, Math.round(scale * 4))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("OPEN SHELVING", canvasW / 2, canvasH / 2);
    ctx.restore();

    // ── Watermark ─────────────────────────────────────────────────
    ctx.save();
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    ctx.font = `bold ${Math.round(canvasW * 0.08)}px Arial`;
    ctx.fillText("WDO CUSTOM", 0, 0);
    ctx.restore();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return;

    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(rect.width * dpr);
    const H = Math.round(rect.height * dpr);
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const cW = rect.width;
    const cH = rect.height;
    ctx.clearRect(0, 0, cW, cH);

    // ── Open Shelving rendering ──────────────────────────────────────
    if (shelvingConfig) {
      drawShelvingUnit(ctx, shelvingConfig, cW, cH);
      return;
    }

    const margin = 40;
    const safeW = cW - margin * 2;
    const safeH = cH - margin * 2;

    // ── Compound preset rendering ─────────────────────────────────────
    if (presetUnits && presetUnits.length > 0) {
      // Calculate combined dimensions
      const GAP_BETWEEN = 1; // 1" gap between sub-units
      const combinedW = presetUnits.reduce((sum, u) => sum + u.totalW, 0) + (presetUnits.length - 1) * GAP_BETWEEN;
      const maxFrameH = Math.max(...presetUnits.map((u) => {
        const uRows = u.rows;
        return isMini
          ? (RENDER_PLATE + RENDER_FIRST_RAIL + (uRows - 1) * RENDER_TIER + 2 + PLY_TOP_H)
          : (uRows * RENDER_TIER + RENDER_PLATE * 2 + RENDER_TOP_GAP);
      }));
      let visualH_in = maxFrameH;
      if (!isMini) visualH_in += 1; // top overhang

      const scale = Math.min(safeW / combinedW, safeH / visualH_in);
      if (scale <= 0 || !isFinite(scale)) return;

      const totalPixelW = combinedW * scale;
      const visualPixelH = visualH_in * scale;
      let cursorX = (cW - totalPixelW) / 2;
      const baseTopOverhang = !isMini ? 1 * scale : 0;

      for (const unit of presetUnits) {
        const unitFrameH = isMini
          ? (RENDER_PLATE + RENDER_FIRST_RAIL + (unit.rows - 1) * RENDER_TIER + 2 + PLY_TOP_H)
          : (unit.rows * RENDER_TIER + RENDER_PLATE * 2 + RENDER_TOP_GAP);
        // Align bottoms: taller units start higher, shorter ones start lower
        const yOffset = (maxFrameH - unitFrameH) * scale;
        const startY = (cH - visualPixelH) / 2 + baseTopOverhang + yOffset;

        drawSingleUnit(ctx, unit.cols, unit.rows, unit.totalW, unit.hasWheels, unit.hasTop, cursorX, startY, scale);
        cursorX += unit.totalW * scale + GAP_BETWEEN * scale;
      }

      // Watermark
      ctx.save();
      ctx.translate(cW / 2, cH / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.03)";
      ctx.font = `bold ${Math.round(cW * 0.08)}px Arial`;
      ctx.fillText("WDO CUSTOM", 0, 0);
      ctx.restore();
      return;
    }

    // ── Single unit rendering (original flow) ─────────────────────────

    // Visual height includes wheels if selected, and plywood top overhang if hasTop
    let visualH_in = realH;
    if (hasTop && !isMini) visualH_in += 1;

    const scale = Math.min(safeW / realW, safeH / visualH_in);
    if (scale <= 0 || !isFinite(scale)) return;

    const topOverhang = (hasTop && !isMini) ? 1 * scale : 0;
    const visualPixelH = visualH_in * scale;
    const startX = (cW - realW * scale) / 2;
    const startY = (cH - visualPixelH) / 2 + topOverhang;

    drawSingleUnit(ctx, cols, rows, realW, hasWheels, hasTop, startX, startY, scale, addons);

    // Watermark
    ctx.save();
    ctx.translate(cW / 2, cH / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    ctx.font = `bold ${Math.round(cW * 0.08)}px Arial`;
    ctx.fillText("WDO CUSTOM", 0, 0);
    ctx.restore();
  }, [cols, rows, realW, realH, hasWheels, hasTop, isMini, drawSingleUnit, drawShelvingUnit, shelvingConfig, presetUnits, addons, RENDER_TIER, RENDER_FIRST_RAIL, RENDER_PLATE, RENDER_TOP_GAP]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ display: "block" }}
      />
    </div>
  );
}
