"use client";

import { useCallback, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// BlueprintCanvas — 2D visual-only rendering (dimensions from server)
// Fast, lightweight — default view for the configurator.
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";
type UnitType = "standard" | "mini";

interface BlueprintCanvasProps {
  cols: number;
  rows: number;
  toteType: ToteType;
  unitType: UnitType;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  totalW: number;
  totalH: number;
}

export default function BlueprintCanvas({
  cols,
  rows,
  toteType,
  unitType,
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
  const RENDER_GAP = 1.5; // Post width (same for both)
  const RENDER_TIER = isMini ? 7 : 16; // Vertical spacing
  const RENDER_PLATE = 1.5;
  const RENDER_TOP_GAP = isMini ? 0 : 2.5; // Mini has no top plate gap
  const RENDER_FIRST_RAIL = isMini ? 5.25 : 13; // First rail height from bottom
  const opening = isMini ? 8.25 : (toteType === "HDX" ? 19.75 : 20.75);

  // Calculate dimensions
  const calcW = cols * opening + (cols + 1) * RENDER_GAP;
  const calcH = isMini
    ? RENDER_PLATE + RENDER_FIRST_RAIL + (rows - 1) * RENDER_TIER + 2 + 0.75
    : rows * RENDER_TIER + RENDER_PLATE * 2 + RENDER_TOP_GAP;

  const realW = totalW > 0 ? totalW : calcW;
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

    const margin = 40;
    const safeW = cW - margin * 2;
    const safeH = cH - margin * 2;

    let visualH_in = realH;
    if (hasWheels) visualH_in += 6;
    if (hasTop) visualH_in += 1;

    const scale = Math.min(safeW / realW, safeH / visualH_in);
    if (scale <= 0 || !isFinite(scale)) return;

    const pTotalW = realW * scale;
    const pTotalH = realH * scale;
    const pStud = RENDER_GAP * scale;
    const pBay = opening * scale;
    const pPlate = RENDER_PLATE * scale;
    const pTopGap = RENDER_TOP_GAP * scale;

    const startX = (cW - pTotalW) / 2;
    const visualPixelH = visualH_in * scale;
    const startY = (cH - visualPixelH) / 2 + (hasTop ? 1 * scale : 0);

    ctx.fillStyle = woodFill;
    ctx.strokeStyle = woodStroke;
    ctx.lineWidth = 2;

    // Bottom plate
    ctx.fillRect(startX, startY + pTotalH - pPlate, pTotalW, pPlate);
    ctx.strokeRect(startX, startY + pTotalH - pPlate, pTotalW, pPlate);
    // Top plate
    ctx.fillRect(startX, startY, pTotalW, pPlate);
    ctx.strokeRect(startX, startY, pTotalW, pPlate);

    // Vertical posts
    const postH = pTotalH - pPlate * 2;
    const postY = startY + pPlate;
    for (let i = 0; i <= cols; i++) {
      const x = startX + i * (pBay + pStud);
      ctx.fillStyle = woodFill;
      ctx.strokeStyle = woodStroke;
      ctx.fillRect(x, postY, pStud, postH);
      ctx.strokeRect(x, postY, pStud, postH);
    }

    // Rails + Totes
    const railH = (isMini ? 1.0 : 1.875) * scale; // Mini uses 1" wide rails
    const railW = 0.75 * scale; // Rail thickness (same for both)

    for (let c = 0; c < cols; c++) {
      const bayLeftX = startX + pStud + c * (pBay + pStud);
      const bayRightX = bayLeftX + pBay;

      for (let r = 1; r <= rows; r++) {
        // Calculate rail Y position based on unit type
        const levelY = isMini
          ? startY + pPlate + (RENDER_FIRST_RAIL + (r - 1) * RENDER_TIER) * scale
          : startY + pPlate + pTopGap + (r - 1) * RENDER_TIER * scale;

        ctx.fillStyle = woodFill;
        ctx.strokeStyle = woodStroke;
        ctx.fillRect(bayLeftX, levelY, railW, railH);
        ctx.strokeRect(bayLeftX, levelY, railW, railH);
        ctx.fillRect(bayRightX - railW, levelY, railW, railH);
        ctx.strokeRect(bayRightX - railW, levelY, railW, railH);

        if (hasTotes) {
          // Tote dimensions based on unit type
          const toteBodyH = isMini ? 6.25 : 11; // Mini totes are shorter
          const tW = pBay * 0.94;
          const tH = toteBodyH * scale;
          const tX = bayLeftX + (pBay - tW) / 2;
          const tY = levelY;
          const lidH = (isMini ? 1.0 : 1.5) * scale;

          // Tote lid/rim color (yellow for both, but mini is specifically "yellow lids")
          ctx.fillStyle = "#fbbf24";
          ctx.strokeStyle = "#d97706";
          ctx.fillRect(tX, tY - lidH, tW, lidH);
          ctx.strokeRect(tX, tY - lidH, tW, lidH);

          // Tote body (clear/dark for mini, dark navy for standard)
          const bodyW = tW * 0.9;
          const bodyX = tX + (tW - bodyW) / 2;
          ctx.fillStyle = isMini ? "#e5e7eb" : "#1e293b"; // Clear gray for mini
          ctx.strokeStyle = isMini ? "#9ca3af" : "#0f172a";
          ctx.fillRect(bodyX, tY, bodyW, tH);
          ctx.strokeRect(bodyX, tY, bodyW, tH);
        }
      }
    }

    if (hasTop) {
      const topThick = 0.75 * scale;
      const overhang = 1 * scale;
      ctx.fillStyle = "#f3d2a3";
      ctx.strokeStyle = woodStroke;
      ctx.fillRect(startX - overhang, startY - topThick, pTotalW + overhang * 2, topThick);
      ctx.strokeRect(startX - overhang, startY - topThick, pTotalW + overhang * 2, topThick);
    }

    if (hasWheels) {
      const wSize = 5 * scale;
      const wY = startY + pTotalH;
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
  }, [cols, rows, opening, realW, realH, hasTotes, hasWheels, hasTop, isMini, RENDER_TIER, RENDER_FIRST_RAIL]);

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
