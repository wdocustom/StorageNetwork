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

/** Overhead ceiling tote rail config for 2D front-view rendering */
interface OverheadConfig2D {
  slotsWide: number;
  slotsDeep: number;
  toteType: "HDX" | "GM";
  hasTotes?: boolean;
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
  /** 2x4 rail construction mode — uses fixed rail positions instead of
   *  uniform 16" tier spacing. Required for accurate proportions at 6 high
   *  (where the upright is full 96" stock and the 6th tier's gap differs). */
  use2x4Rails?: boolean;
  /** When set, renders compound preset (multiple sub-units side by side) */
  presetUnits?: SubUnit[];
  /** Per-section addons (doors, side panels, rail removal, hinges) */
  addons?: SectionAddon[];
  /** When set, renders an open shelving unit instead of a tote organizer */
  shelvingConfig?: ShelvingConfig2D;
  /** When set, renders a ceiling tote rail system (top-down view from below) */
  overheadConfig?: OverheadConfig2D;
  /** Text displayed as a diagonal watermark behind the blueprint */
  watermarkText?: string;
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
  use2x4Rails = false,
  presetUnits,
  addons,
  shelvingConfig,
  overheadConfig,
  watermarkText = "Storage-Network.app",
}: BlueprintCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Unit-type specific dimensions
  const isMini = unitType === "mini";
  const isSideways = unitType === "standard" && orientation === "sideways";
  const is2x4 = use2x4Rails && !isMini;
  const RENDER_GAP = 1.5; // Post width (same for both)
  const RENDER_TIER = isMini ? 7 : 16; // Vertical spacing (uniform fallback)
  const RENDER_PLATE = 1.5;
  const RENDER_TOP_GAP = isMini ? 0 : 2.5; // Mini has no top plate gap
  const RENDER_FIRST_RAIL = isMini ? 5.25 : 13; // First rail height from bottom
  const PLY_TOP_H = 0.75; // Plywood top thickness
  // Opening width: 2x4 rails use universal 21" (sideways still 30.25");
  // standard mini/HDX/GM still tote-width based.
  const opening = isMini
    ? 8.25
    : isSideways
      ? 30.25
      : is2x4
        ? 21
        : toteType === "HDX" ? 19.75 : 20.75;

  // 2x4 rail construction: fixed rail positions, full-stock upright at 6 high.
  // Must mirror src/lib/buildEngine.ts so the 2D drawing matches the actual
  // build geometry (not uniform 16" tiers — at 6 high the real frame is 99"
  // but uniform tiers would compute 101.5", clipping the top tier).
  const RAILS_2X4_POSITIONS = [13.75, 29.5, 45.25, 61, 76.75, 92.5];
  const RAILS_2X4_TOP_GAP = 2.75;
  const RAILS_2X4_STOCK_LENGTH = 96;

  // Calculate dimensions (frame height without wheels)
  const calcW = cols * opening + (cols + 1) * RENDER_GAP;
  let calcH: number;
  if (is2x4) {
    const cappedRows = Math.min(rows, RAILS_2X4_POSITIONS.length);
    const postHeight = cappedRows >= RAILS_2X4_POSITIONS.length
      ? RAILS_2X4_STOCK_LENGTH
      : RAILS_2X4_POSITIONS[cappedRows - 1] + RAILS_2X4_TOP_GAP;
    calcH = RENDER_PLATE * 2 + postHeight;
  } else if (isMini) {
    calcH = RENDER_PLATE + RENDER_FIRST_RAIL + (rows - 1) * RENDER_TIER + 2 + PLY_TOP_H;
  } else {
    calcH = rows * RENDER_TIER + RENDER_PLATE * 2 + RENDER_TOP_GAP;
  }

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

    let unitFrameH: number;
    if (is2x4) {
      const cappedRows = Math.min(unitRows, RAILS_2X4_POSITIONS.length);
      const postHeight = cappedRows >= RAILS_2X4_POSITIONS.length
        ? RAILS_2X4_STOCK_LENGTH
        : RAILS_2X4_POSITIONS[cappedRows - 1] + RAILS_2X4_TOP_GAP;
      unitFrameH = RENDER_PLATE * 2 + postHeight;
    } else if (isMini) {
      unitFrameH = RENDER_PLATE + RENDER_FIRST_RAIL + (unitRows - 1) * RENDER_TIER + 2 + PLY_TOP_H;
    } else {
      unitFrameH = unitRows * RENDER_TIER + RENDER_PLATE * 2 + RENDER_TOP_GAP;
    }
    const pFrameH = unitFrameH * scale;
    const pStud = RENDER_GAP * scale;
    const pBay = opening * scale;
    const pPlate = RENDER_PLATE * scale;
    const pTopGap = RENDER_TOP_GAP * scale;
    const pTotalW = unitRealW * scale;
    // Actual post-to-post width (matches where vertical posts are drawn)
    const pPostToPostW = unitCols * (pBay + pStud) + pStud;

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
      ctx.arc(startX + pPostToPostW - pStud * 2, wY + wSize / 2, wSize / 2, 0, 2 * Math.PI);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = woodFill;
      ctx.strokeStyle = woodStroke;
    }

    // Bottom plate — spans post-to-post (not full totalW which may include overhang)
    ctx.fillRect(startX, startY + pFrameH - pPlate, pPostToPostW, pPlate);
    ctx.strokeRect(startX, startY + pFrameH - pPlate, pPostToPostW, pPlate);

    // Top 2x4 plate (Standard only)
    if (!isMini) {
      ctx.fillRect(startX, startY, pPostToPostW, pPlate);
      ctx.strokeRect(startX, startY, pPostToPostW, pPlate);
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
    const railH = (isMini ? 1.0 : 1.875) * scale;
    const railW = 0.75 * scale;
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
        } else if (is2x4) {
          // 2x4 mode: rails sit at fixed positions (measured from bottom of
          // posts, i.e. above the bottom plate). Mirror buildEngine.ts.
          const railFromBottom = RAILS_2X4_POSITIONS[Math.min(r, RAILS_2X4_POSITIONS.length - 1)];
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
        ctx.fillRect(startX + pPostToPostW, panelY, panelW, panelH);
        ctx.strokeRect(startX + pPostToPostW, panelY, panelW, panelH);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // Plywood top (flush with unit sides — no overhang)
    if (unitHasTop) {
      const topThick = PLY_TOP_H * scale;
      ctx.fillStyle = plywoodFill;
      ctx.strokeStyle = woodStroke;
      ctx.fillRect(startX, startY - topThick, pPostToPostW, topThick);
      ctx.strokeRect(startX, startY - topThick, pPostToPostW, topThick);
    }
  }, [isMini, is2x4, opening, hasTotes, toteType, toteColor, RENDER_TIER, RENDER_FIRST_RAIL, RENDER_PLATE, RENDER_GAP, RENDER_TOP_GAP]);

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
    ctx.fillText(watermarkText, 0, 0);
    ctx.restore();
  }, [watermarkText]);

  // ── Helper: draw ceiling tote rail system (front view) ──────────────
  const drawOverheadUnit = useCallback((
    ctx: CanvasRenderingContext2D,
    config: OverheadConfig2D,
    canvasW: number,
    canvasH: number,
  ) => {
    const { slotsWide, slotsDeep, toteType: tt, hasTotes: showTotes = true } = config;
    const woodPattern = create2DWoodPattern(ctx);
    const plywoodPattern = create2DPlywoodPattern(ctx);
    const woodFill = woodPattern || "#e2b686";
    const woodStroke = "#925f32";
    const plywoodFill = plywoodPattern || "#f3d2a3";

    // ── Dimensions (inches) — matching Rack3D.tsx constants ──
    const NAILER_H = 1.5;       // 2×4 nailer thickness (flat against ceiling)
    const SPACER_H = 1.5;       // 2×4 padding per layer
    const PADDING_LAYERS = 2;   // Double padding for lid clearance
    const PADDING_W = 3.5;      // 2×4 padding width (cross-section from front)
    const RAIL_H = 0.75;        // 3/4" plywood strip thickness
    const RAIL_W = 6.0;         // plywood rail width (3.5" center + 1.25" ledge × 2)
    const LEDGE = 1.25;         // plywood ledge overhang on each side past padding
    const TOTE_W = tt === "HDX" ? 19.75 : 20.75;
    const TOTE_RIM_H = 1.0;     // Rim/lip height (sits on top of plywood)
    const TOTE_BODY_H = 11.0;   // Body hangs below rail
    const TOTE_BODY_TAPER = 0.85;
    const LIP_HANG = 1.0;       // Rim extends past body on each side
    const SLOT_CLR = 0.25;
    const SLOT_W = TOTE_W - 2 * LIP_HANG + 2 * SLOT_CLR;
    const RAIL_SPACING = SLOT_W + RAIL_W;

    // ── Layout calculation ──
    // From front: ceiling → nailer → padding → plywood rail → tote body hangs below
    // When totes are shown, body starts at railY (plywood top), so body overlaps rail height.
    const structH = NAILER_H + SPACER_H * PADDING_LAYERS + RAIL_H;
    const totalH = showTotes
      ? NAILER_H + SPACER_H * PADDING_LAYERS + TOTE_BODY_H  // body from railY down
      : structH;
    const systemW = (slotsWide + 1) * RAIL_W + slotsWide * SLOT_W;

    // Scale to fit canvas
    const margin = 40;
    const safeW = canvasW - margin * 2;
    const safeH = canvasH - margin * 2;
    const scale = Math.min(safeW / systemW, safeH / totalH);
    if (scale <= 0 || !isFinite(scale)) return;

    const startX = (canvasW - systemW * scale) / 2;
    const startY = (canvasH - totalH * scale) / 2;

    // Rail X positions (left edge of each rail strip)
    const railXPositions: number[] = [];
    for (let i = 0; i <= slotsWide; i++) {
      railXPositions.push(i * RAIL_SPACING);
    }

    // Key Y positions
    const nailerY = startY;
    const paddingY = nailerY + NAILER_H * scale;
    const railY = paddingY + SPACER_H * PADDING_LAYERS * scale;
    const railBottomY = railY + RAIL_H * scale;

    // ── Ceiling line ──
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(startX - 15, startY);
    ctx.lineTo(startX + systemW * scale + 15, startY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(9, Math.round(scale * 1.5))}px Arial`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("CEILING", startX - 20, startY - 2);
    ctx.restore();

    // ── Layer 1: Nailer (2×4 across full width) ──
    ctx.fillStyle = woodFill;
    ctx.strokeStyle = woodStroke;
    ctx.lineWidth = 2;
    ctx.fillRect(startX, nailerY, systemW * scale, NAILER_H * scale);
    ctx.strokeRect(startX, nailerY, systemW * scale, NAILER_H * scale);
    // Wood grain
    ctx.strokeStyle = "#c9956a";
    ctx.lineWidth = 0.5;
    for (let g = 0.3; g < 1; g += 0.4) {
      const gy = nailerY + NAILER_H * scale * g;
      ctx.beginPath();
      ctx.moveTo(startX + 2, gy);
      ctx.lineTo(startX + systemW * scale - 2, gy);
      ctx.stroke();
    }

    // ── Layer 2 & 3: Double padding (2×4 cross-sections, 3.5" wide, centered in 6" rail) ──
    const paddingTotalH = SPACER_H * PADDING_LAYERS * scale;
    ctx.fillStyle = woodFill;
    ctx.strokeStyle = woodStroke;
    ctx.lineWidth = 1.5;
    for (const rx of railXPositions) {
      const px = startX + (rx + LEDGE) * scale;
      const pw = PADDING_W * scale;
      ctx.fillRect(px, paddingY, pw, paddingTotalH);
      ctx.strokeRect(px, paddingY, pw, paddingTotalH);
      // Divider between the two padding layers
      ctx.strokeStyle = "#c9956a";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(px, paddingY + SPACER_H * scale);
      ctx.lineTo(px + pw, paddingY + SPACER_H * scale);
      ctx.stroke();
      ctx.strokeStyle = woodStroke;
      ctx.lineWidth = 1.5;
    }

    // ── STEP 1: Tote BODIES (drawn BEFORE plywood — bodies hang behind/below rails) ──
    if (showTotes) {
      for (let col = 0; col < slotsWide; col++) {
        const slotLeftX = railXPositions[col] + RAIL_W;
        const slotCenterX = startX + (slotLeftX + SLOT_W / 2) * scale;

        // Body width = tote body (without lip overhang), fits through slot
        const bodyTopW = (TOTE_W - 2 * LIP_HANG) * scale;
        const bodyBotW = bodyTopW * TOTE_BODY_TAPER;
        const bodyPH = TOTE_BODY_H * scale;
        // Body top connects to the rim bottom at railY (plywood covers the overlap)
        const bodyTopY = railY;
        const bodyTopX = slotCenterX - bodyTopW / 2;
        const bodyBotX = slotCenterX - bodyBotW / 2;

        ctx.fillStyle = "#1e293b";
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bodyTopX, bodyTopY);
        ctx.lineTo(bodyTopX + bodyTopW, bodyTopY);
        ctx.lineTo(bodyBotX + bodyBotW, bodyTopY + bodyPH);
        ctx.lineTo(bodyBotX, bodyTopY + bodyPH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Depth indicator (if more than 1 row deep)
        if (slotsDeep > 1) {
          ctx.save();
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.font = `bold ${Math.max(9, Math.round(scale * 1.8))}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`×${slotsDeep}`, slotCenterX, bodyTopY + RAIL_H * scale + bodyPH / 2);
          ctx.restore();
        }
      }
    } else {
      // No totes — show empty slot openings between rails
      const emptySlotH = TOTE_BODY_H * scale * 0.3;
      for (let col = 0; col < slotsWide; col++) {
        const slotLeftX = railXPositions[col] + RAIL_W;
        const slotPX = startX + slotLeftX * scale;
        const slotPW = SLOT_W * scale;
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(slotPX, railBottomY, slotPW, emptySlotH);
        ctx.setLineDash([]);
      }
    }

    // ── STEP 2: Plywood rail strips (drawn OVER tote bodies, UNDER rims) ──
    // 6" wide with visible ledges extending past the 3.5" padding on each side
    ctx.fillStyle = plywoodFill;
    ctx.strokeStyle = woodStroke;
    ctx.lineWidth = 1.5;
    for (const rx of railXPositions) {
      const px = startX + rx * scale;
      const pw = RAIL_W * scale;
      ctx.fillRect(px, railY, pw, RAIL_H * scale);
      ctx.strokeRect(px, railY, pw, RAIL_H * scale);
    }

    // ── STEP 3: Tote RIMS (drawn LAST — rim sits ON TOP of plywood rails) ──
    // The rim is wider than the slot opening (full TOTE_W) so it overlaps the
    // plywood rails on each side by LIP_HANG, visually resting on the ledges.
    if (showTotes) {
      const rimPH = TOTE_RIM_H * scale;
      const rimFullW = TOTE_W * scale;
      for (let col = 0; col < slotsWide; col++) {
        const slotLeftX = railXPositions[col] + RAIL_W;
        const slotCenterX = startX + (slotLeftX + SLOT_W / 2) * scale;
        const rimX = slotCenterX - rimFullW / 2;
        const rimY2 = railY - rimPH; // Rim bottom sits on plywood top surface

        ctx.fillStyle = "#fbbf24";
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 1;
        ctx.fillRect(rimX, rimY2, rimFullW, rimPH);
        ctx.strokeRect(rimX, rimY2, rimFullW, rimPH);
      }
    }

    // ── Watermark ──
    ctx.save();
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    ctx.font = `bold ${Math.round(canvasW * 0.08)}px Arial`;
    ctx.fillText(watermarkText, 0, 0);
    ctx.restore();
  }, [watermarkText]);

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

    // ── Overhead Ceiling Tote Rail rendering ──────────────────────────
    if (overheadConfig) {
      drawOverheadUnit(ctx, overheadConfig, cW, cH);
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
      ctx.fillText(watermarkText, 0, 0);
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
    ctx.fillText(watermarkText, 0, 0);
    ctx.restore();
  }, [cols, rows, realW, realH, hasWheels, hasTop, isMini, is2x4, drawSingleUnit, drawShelvingUnit, drawOverheadUnit, shelvingConfig, overheadConfig, presetUnits, addons, RENDER_TIER, RENDER_FIRST_RAIL, RENDER_PLATE, RENDER_TOP_GAP, watermarkText]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
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
