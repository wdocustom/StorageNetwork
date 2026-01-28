"use client";

import { useCallback, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// BlueprintCanvas — 2D visual-only rendering (dimensions from server)
// Fast, lightweight — default view for the configurator.
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";

interface BlueprintCanvasProps {
  cols: number;
  rows: number;
  toteType: ToteType;
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
  hasTotes,
  hasWheels,
  hasTop,
  totalW,
  totalH,
}: BlueprintCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const RENDER_GAP = 1.5;
  const RENDER_TIER = 16;
  const RENDER_PLATE = 1.5;
  const RENDER_TOP_GAP = 2.5;
  const opening = toteType === "HDX" ? 19.75 : 20.75;

  const realW = totalW > 0 ? totalW : cols * opening + (cols + 1) * RENDER_GAP;
  const realH =
    totalH > 0 ? totalH : rows * RENDER_TIER + RENDER_PLATE * 2 + RENDER_TOP_GAP;

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
    const railH = 1.5 * scale;
    const railW = 1.5 * scale;

    for (let c = 0; c < cols; c++) {
      const bayLeftX = startX + pStud + c * (pBay + pStud);
      const bayRightX = bayLeftX + pBay;

      for (let r = 1; r <= rows; r++) {
        const levelY = startY + pPlate + pTopGap + (r - 1) * 16 * scale;

        ctx.fillStyle = woodFill;
        ctx.strokeStyle = woodStroke;
        ctx.fillRect(bayLeftX, levelY, railW, railH);
        ctx.strokeRect(bayLeftX, levelY, railW, railH);
        ctx.fillRect(bayRightX - railW, levelY, railW, railH);
        ctx.strokeRect(bayRightX - railW, levelY, railW, railH);

        if (hasTotes) {
          const tW = pBay * 0.94;
          const tH = 12 * scale;
          const tX = bayLeftX + (pBay - tW) / 2;
          const tY = levelY;
          const lidH = 1.5 * scale;

          ctx.fillStyle = "#fbbf24";
          ctx.strokeStyle = "#d97706";
          ctx.fillRect(tX, tY - lidH, tW, lidH);
          ctx.strokeRect(tX, tY - lidH, tW, lidH);

          const bodyW = tW * 0.9;
          const bodyX = tX + (tW - bodyW) / 2;
          ctx.fillStyle = "#1e293b";
          ctx.strokeStyle = "#0f172a";
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
  }, [cols, rows, opening, realW, realH, hasTotes, hasWheels, hasTop]);

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
