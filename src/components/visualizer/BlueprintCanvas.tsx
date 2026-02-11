"use client";

import { useCallback, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// BlueprintCanvas — 2D visual-only rendering (dimensions from server)
// Fast, lightweight — default view for the configurator.
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";
type ToteColor = "black" | "clear";
type UnitType = "standard" | "mini";
type Orientation = "standard" | "sideways";

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

    const woodFill = "#e2b686";
    const woodStroke = "#925f32";
    const plywoodFill = "#f3d2a3";

    const margin = 40;
    const safeW = cW - margin * 2;
    const safeH = cH - margin * 2;

    // Visual height includes wheels if selected, and plywood top overhang if hasTop
    let visualH_in = realH;
    // Only add extra visual space for top overhang on standard units (mini top is included in frame)
    if (hasTop && !isMini) visualH_in += 1;

    const scale = Math.min(safeW / realW, safeH / visualH_in);
    if (scale <= 0 || !isFinite(scale)) return;

    const pTotalW = realW * scale;
    // Frame height without wheels for drawing the wood structure
    const frameH = isMini
      ? (RENDER_PLATE + RENDER_FIRST_RAIL + (rows - 1) * RENDER_TIER + 2 + PLY_TOP_H)
      : (rows * RENDER_TIER + RENDER_PLATE * 2 + RENDER_TOP_GAP);
    const pFrameH = frameH * scale;
    const pStud = RENDER_GAP * scale;
    const pBay = opening * scale;
    const pPlate = RENDER_PLATE * scale;
    const pTopGap = RENDER_TOP_GAP * scale;
    const pWheelH = hasWheels ? WHEEL_HEIGHT * scale : 0;

    const startX = (cW - pTotalW) / 2;
    const visualPixelH = visualH_in * scale;
    // Adjust startY to account for top overhang on standard units
    const topOverhang = (hasTop && !isMini) ? 1 * scale : 0;
    const startY = (cH - visualPixelH) / 2 + topOverhang;

    ctx.fillStyle = woodFill;
    ctx.strokeStyle = woodStroke;
    ctx.lineWidth = 2;

    // ── Draw wheels first (at the very bottom) ──
    if (hasWheels) {
      const wSize = 5 * scale;
      const wY = startY + pFrameH;
      ctx.fillStyle = "#334155";
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(startX + pStud * 2, wY + wSize / 2, wSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(startX + pTotalW - pStud * 2, wY + wSize / 2, wSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = woodFill;
      ctx.strokeStyle = woodStroke;
    }

    // ── Bottom plate (same for both unit types) ──
    ctx.fillRect(startX, startY + pFrameH - pPlate, pTotalW, pPlate);
    ctx.strokeRect(startX, startY + pFrameH - pPlate, pTotalW, pPlate);

    // ── Top 2x4 plate (Standard only - Mini has no 2x4 top plate) ──
    if (!isMini) {
      ctx.fillRect(startX, startY, pTotalW, pPlate);
      ctx.strokeRect(startX, startY, pTotalW, pPlate);
    }

    // ── Vertical posts ──
    // Mini: posts go from plywood top (at startY) down to bottom plate
    // Standard: posts go between bottom and top 2x4 plates
    const postH = isMini
      ? pFrameH - pPlate // Posts from top of frame to top of bottom plate
      : pFrameH - pPlate * 2;
    const postY = isMini
      ? startY // Posts start at frame top (connects to plywood)
      : startY + pPlate;

    for (let i = 0; i <= cols; i++) {
      const x = startX + i * (pBay + pStud);
      ctx.fillStyle = woodFill;
      ctx.strokeStyle = woodStroke;
      ctx.fillRect(x, postY, pStud, postH);
      ctx.strokeRect(x, postY, pStud, postH);
    }

    // ── Rails + Totes ──
    const railH = (isMini ? 1.0 : 1.875) * scale; // Mini uses 1" wide rails
    const railW = 0.75 * scale; // Rail thickness (same for both)

    for (let c = 0; c < cols; c++) {
      const bayLeftX = startX + pStud + c * (pBay + pStud);
      const bayRightX = bayLeftX + pBay;

      for (let r = 0; r < rows; r++) {
        // Calculate rail Y position based on unit type
        // Rails are positioned from the TOP of the frame downward
        let railY: number;
        if (isMini) {
          // Mini: first rail at RENDER_FIRST_RAIL from bottom plate
          // Drawing from top: plywood top is at startY, so rails are below
          const railFromBottom = RENDER_FIRST_RAIL + r * RENDER_TIER;
          railY = startY + pFrameH - pPlate - railFromBottom * scale - railH / 2;
        } else {
          // Standard: rails positioned from top plate down
          railY = startY + pPlate + pTopGap + r * RENDER_TIER * scale;
        }

        ctx.fillStyle = woodFill;
        ctx.strokeStyle = woodStroke;
        ctx.fillRect(bayLeftX, railY, railW, railH);
        ctx.strokeRect(bayLeftX, railY, railW, railH);
        ctx.fillRect(bayRightX - railW, railY, railW, railH);
        ctx.strokeRect(bayRightX - railW, railY, railW, railH);

        if (hasTotes) {
          // Tote dimensions based on unit type
          const toteBodyH = isMini ? 6.25 : 11; // Mini totes are shorter
          const tW = pBay * 0.94;
          const tH = toteBodyH * scale;
          const tX = bayLeftX + (pBay - tW) / 2;
          const lidH = (isMini ? 0.75 : 1.0) * scale;

          // Tote lid/rim (sits on the rail)
          ctx.fillStyle = "#fbbf24";
          ctx.strokeStyle = "#d97706";
          ctx.fillRect(tX, railY - lidH, tW, lidH);
          ctx.strokeRect(tX, railY - lidH, tW, lidH);

          // Tote body (connects directly to bottom of lid, hangs down)
          const bodyW = tW * 0.9;
          const bodyX = tX + (tW - bodyW) / 2;
          const bodyY = railY; // Body starts at bottom of lid (top of rail)

          // Clamp tote body so it doesn't extend below the bottom plate
          const bottomPlateTop = startY + pFrameH - pPlate;
          const maxBodyH = Math.max(0, bottomPlateTop - bodyY);
          const clampedBodyH = Math.min(tH, maxBodyH);

          // Clear totes (mini or HDX clear) use light slate, standard uses dark
          const isClear = !isMini && toteType === "HDX" && toteColor === "clear";
          ctx.fillStyle = (isMini || isClear) ? "#cbd5e1" : "#1e293b"; // Light slate for clear look, dark for standard
          ctx.strokeStyle = (isMini || isClear) ? "#64748b" : "#0f172a";
          ctx.lineWidth = isMini ? 1.5 : 2;
          ctx.fillRect(bodyX, bodyY, bodyW, clampedBodyH);
          ctx.strokeRect(bodyX, bodyY, bodyW, clampedBodyH);
          ctx.lineWidth = 2; // Reset line width
        }
      }
    }

    // ── Plywood top (optional - for both Mini and Standard) ──
    // Drawn AFTER posts so it appears to sit on top of them
    if (hasTop) {
      const topThick = PLY_TOP_H * scale;
      const overhang = 1 * scale;
      ctx.fillStyle = plywoodFill;
      ctx.strokeStyle = woodStroke;
      ctx.fillRect(startX - overhang, startY - topThick, pTotalW + overhang * 2, topThick);
      ctx.strokeRect(startX - overhang, startY - topThick, pTotalW + overhang * 2, topThick);
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
  }, [cols, rows, opening, realW, realH, hasTotes, hasWheels, hasTop, isMini, isSideways, toteType, toteColor, RENDER_TIER, RENDER_FIRST_RAIL, RENDER_PLATE, RENDER_GAP, RENDER_TOP_GAP]);

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
