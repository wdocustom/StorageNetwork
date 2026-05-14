"use client";

import { useMemo, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Stage } from "@react-three/drei";
import { BufferGeometry, BufferAttribute, DoubleSide, MeshStandardMaterial, Color, type Side } from "three";
import IndustrialCaster, { CASTER_HEIGHT } from "./IndustrialCaster";
import { createDougFirMaterial, createPlywoodMaterial, createPlywoodTopMaterial, createPaintedMaterial, restoreAllTextures, disposeAllTextures } from "./woodTextures";
import type { PaintColorId } from "@/types/viewModels";
import { PAINT_COLORS } from "@/types/viewModels";

// ═══════════════════════════════════════════════════════════════════════════
// Rack3D — Precise CAD Blueprint (Rim-Glider System)
//
// All geometry in INCHES, uniformly scaled to scene units.
//
// PHYSICAL CONSTRUCTION:
//   Standard (27 Gallon):
//   - Vertical 2×4 posts at each column line (front + back)
//   - 3/4" plywood rails screwed to post SIDE FACES, full 30" depth
//   - Totes: yellow rim sits ON TOP of plywood rail, body hangs BELOW
//   - Bottom/Top 2x4 plates span full width
//   - 4 industrial casters at the 4 outer corners
//
//   Mini (6.5 Quart):
//   - Same 2×4 posts but closer together (8.25" slots)
//   - 1" wide plywood rails, 12.75" depth
//   - No top 2x4 plates, solid plywood top instead
//   - Smaller shoebox totes (8" x 12.75" x 6.25")
// ═══════════════════════════════════════════════════════════════════════════

import type { SectionAddon } from "@/types/viewModels";

type ToteType = "HDX" | "GM";
type ToteColor = "black" | "clear";
type UnitType = "standard" | "mini";
type Orientation = "standard" | "sideways";

/** Sub-unit for compound presets */
interface SubUnit3D {
  cols: number;
  rows: number;
  totalW: number;
  totalH: number;
  hasTop: boolean;
  hasWheels: boolean;
}

/** Open shelving config passed from the configurator */
interface ShelvingConfig3D {
  widthIn: number;
  frameH: number;
  depth: number;
  shelves: number;
}

/** A multi-unit item for rendering multiple finished units */
interface MultiUnit3DItem {
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
  totalH?: number;
  depth?: number;
  addons?: SectionAddon[];
  paintFrameColor?: PaintColorId | null;
  paintDoorColor?: PaintColorId | null;
  paintSidePanelColor?: PaintColorId | null;
  /** When set, this item is an open shelving unit */
  shelvingConfig?: ShelvingConfig3D;
  /** When set, this item is an overhead storage unit */
  overheadConfig?: OverheadConfig3D;
  /** When set, this item is a compound preset (e.g. Indiana Joe) with sub-units */
  presetUnits?: SubUnit3D[];
  /** When set, this item is a raised bed planter */
  raisedBedConfig?: { widthIn: number; lengthIn: number; heightIn: number; hasLegs: boolean; groundClearance: number; pestCover?: string; finish?: string; hasStringLightPost?: boolean; postHeightIn?: number };
  /** Number of bottom rows with drawer slides */
  drawerSlideRows?: number;
  /** Column indices that have drawer slides (e.g. [0, 3]) */
  drawerSlideColumns?: number[];
}

/** Overhead ceiling tote rail config for 3D rendering */
interface OverheadConfig3D {
  slotsWide: number;
  slotsDeep: number;
  toteType: "HDX" | "GM";
}

interface Rack3DProps {
  cols: number;
  rows: number;
  toteType: ToteType;
  toteColor: ToteColor;
  unitType: UnitType;
  orientation: Orientation;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  /** When set, renders compound preset (multiple sub-units side by side) */
  presetUnits?: SubUnit3D[];
  /** Number of bottom rows with drawer slides (legacy — use drawerSlideColumns for per-column) */
  drawerSlideRows?: number;
  /** Column indices that have drawer slides (e.g. [0, 3] = first and last) */
  drawerSlideColumns?: number[];
  /** When true, drawer totes slide out visually */
  drawersOpen?: boolean;
  /** Per-section addons (doors, side panels, rail removal, hinges) */
  addons?: SectionAddon[];
  /** Paint color for the 2×4 frame */
  paintFrameColor?: PaintColorId | null;
  /** Paint color for plywood doors */
  paintDoorColor?: PaintColorId | null;
  /** Paint color for side panels */
  paintSidePanelColor?: PaintColorId | null;
  /** When set, renders an open shelving unit instead of a tote organizer */
  shelvingConfig?: ShelvingConfig3D;
  /** When set, renders an overhead ceiling storage unit */
  overheadConfig?: OverheadConfig3D;
  /** When set, renders a raised bed planter */
  raisedBedConfig?: { widthIn: number; lengthIn: number; heightIn: number; hasLegs: boolean; groundClearance: number; pestCover?: string; finish?: string; hasStringLightPost?: boolean; postHeightIn?: number };
  /** Multi-unit mode: renders multiple finished units side-by-side */
  multiUnitItems?: MultiUnit3DItem[];
  /** When true, renders 2x4 ripped rail construction instead of plywood strips */
  use2x4Rails?: boolean;
  /** Text displayed as a diagonal watermark behind the 3D scene */
  watermarkText?: string;
}

// ── Constants (inches) — Standard Unit (27 Gallon) ───────────────────────

const POST_W = 1.5;            // 2×4 narrow face
const POST_D = 3.5;            // 2×4 wide face
const RAIL_THICKNESS = 0.75;   // 3/4" plywood strip
const RAIL_HEIGHT = 1.875;     // plywood strip ripped to 1-7/8"
const BIN_LIP_WIDTH = 1.0;     // rim overhang per side
const BIN_GAP = 0.25;          // tolerance

const PLATE_H = 1.5;           // bottom/top plate (2×4 flat)
const RACK_DEPTH = 30;         // front-to-back
const TIER_SPACING = 16;       // center-to-center between rails
const PLY_TOP_H = 0.75;        // plywood top sheet

// Tote (Standard 27 Gallon)
const TOTE_FULL_W_HDX = 19.75;
const TOTE_FULL_W_GM = 20.75;
const TOTE_RIM_H = 1.0;
const TOTE_BODY_H = 11.0;
const TOTE_BODY_TAPER = 0.90;
const TOTE_DEPTH = 28.6;       // Tote lid depth — slightly less than 30" for equal front/back gap

// ── Sideways Orientation Constants (27 Gallon rotated 90°) ───────────────

const SIDEWAYS_SLOT_W = 30.25;   // Tote placed sideways (wider slot)
const SIDEWAYS_DEPTH = 20;       // Shallower depth

// ── Mini Unit Constants (6.5 Quart) ──────────────────────────────────────

const MINI_SLOT_W = 8.25;         // Slot width (fits 8" wide tote)
const MINI_TIER_SPACING = 7;      // Rail-to-rail vertical spacing
const MINI_FIRST_RAIL_H = 5.25;   // First rail height from bottom plate
const MINI_DEPTH = 12.75;         // Rail length / unit depth
const MINI_RAIL_HEIGHT = 1.0;     // 1" wide plywood strips

// Mini Tote (6.5 Quart shoebox)
const MINI_TOTE_W = 8.0;          // Tote width
const MINI_TOTE_H = 6.25;         // Tote body height
const MINI_TOTE_D = 12.75;        // Tote depth (matches unit depth)
const MINI_TOTE_RIM_H = 0.75;     // Rim/lid height

// ── 2x4 Rail Construction Constants ──────────────────────────────────────
const RAILS_2X4_OPENING = 21;       // Universal 21" bay width
const RAILS_2X4_RAIL_W = 1.5;      // Ripped 2x4: 1.5" wide (narrow face)
const RAILS_2X4_RAIL_H = 1.75;     // Ripped 2x4: 1.75" tall
const RAILS_2X4_TOP_GAP = 2.75;    // Gap above top rail to top of post
/** Fixed rail Y positions from bottom of vertical posts (not bottom of unit).
 *  Rails 1-5 sit on a uniform 15.75" pitch. Rail 6 sits at 92.5" with the
 *  upright sized to RAILS_2X4_STOCK_LENGTH (96") so the cut list emits a
 *  full 2x4x8 with no cut — top gap above rail 6 is 3.5" instead of 2.75".
 *  Must mirror src/lib/buildEngine.ts. */
const RAILS_2X4_POSITIONS = [13.75, 29.5, 45.25, 61, 76.75, 92.5];
const RAILS_2X4_STOCK_LENGTH = 96; // 8 ft 2x4 stock

// Inches → scene units
const S = 1 / 48;

// ── Derived ──────────────────────────────────────────────────────────────

function getBayWidth(toteType: ToteType, unitType: UnitType, orientation: Orientation = "standard"): number {
  if (unitType === "mini") {
    return MINI_SLOT_W;
  }
  // Sideways orientation uses fixed 30.25" slot width
  if (orientation === "sideways") {
    return SIDEWAYS_SLOT_W;
  }
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  return toteW - 2 * BIN_LIP_WIDTH + 2 * BIN_GAP;
}

function getPostX(i: number, bayW: number): number {
  return i * (bayW + POST_W) + POST_W / 2;
}

function getUnitDepth(unitType: UnitType, orientation: Orientation = "standard"): number {
  if (unitType === "mini") return MINI_DEPTH;
  // Sideways orientation uses shallower depth
  if (orientation === "sideways") return SIDEWAYS_DEPTH;
  return RACK_DEPTH;
}

function getRailHeight(unitType: UnitType): number {
  return unitType === "mini" ? MINI_RAIL_HEIGHT : RAIL_HEIGHT;
}

function getTierSpacing(unitType: UnitType): number {
  return unitType === "mini" ? MINI_TIER_SPACING : TIER_SPACING;
}

function getFirstRailY(unitType: UnitType): number {
  if (unitType === "mini") {
    return MINI_FIRST_RAIL_H;
  }
  // Standard: First rail Y offset from bottom plate top.
  // Tote hangs: TOTE_BODY_H below rail top. Rail top = railY + RAIL_HEIGHT/2.
  const MIN_FIRST_RAIL_Y = TOTE_BODY_H - RAIL_HEIGHT / 2 + 2;
  return Math.max(MIN_FIRST_RAIL_Y, PLATE_H + 2);
}

// First rail Y offset from bottom plate top (Standard units only).
const MIN_FIRST_RAIL_Y = TOTE_BODY_H - RAIL_HEIGHT / 2 + 2;

// ── Materials ────────────────────────────────────────────────────────────
// Procedural doug-fir and plywood textures for realistic lumber appearance.

const PINE_MAT = createDougFirMaterial(42);
const PLYWOOD_MAT = createPlywoodMaterial(137);
const PLYWOOD_TOP_MAT = createPlywoodTopMaterial(250);

// ── Cached tote & drawer slide materials (prevents GPU memory leaks) ────
// Materials are keyed by a hash of their visual properties. Reused across
// all tote/slide instances instead of creating new ones on every render.
const _matCache = new Map<string, MeshStandardMaterial>();

function getCachedMaterial(key: string, color: string, roughness: number, metalness: number, opts?: { transparent?: boolean; opacity?: number; side?: Side }): MeshStandardMaterial {
  const cacheKey = `${key}:${color}:${roughness}:${metalness}:${opts?.opacity ?? 1}:${opts?.side ?? 0}`;
  let mat = _matCache.get(cacheKey);
  if (!mat) {
    mat = new MeshStandardMaterial({
      color: new Color(color),
      roughness,
      metalness,
      ...(opts?.transparent && { transparent: true, opacity: opts.opacity ?? 1 }),
      ...(opts?.side !== undefined && { side: opts.side }),
    });
    _matCache.set(cacheKey, mat);
  }
  return mat;
}

// Pre-built drawer slide materials (constant colors, reused by all slides)
const SLIDE_FIXED_MAT = getCachedMaterial("slide-fixed", "#c0c0c0", 0.25, 0.7);
const SLIDE_EXTENDING_MAT = getCachedMaterial("slide-ext", "#d4d4d4", 0.15, 0.9);

/** Resolve paint color ID to hex and create/cache a painted material */
function getPaintMaterial(colorId: PaintColorId | null | undefined): import("three").MeshStandardMaterial | null {
  if (!colorId) return null;
  const color = PAINT_COLORS.find((c) => c.id === colorId);
  if (!color) return null;
  return createPaintedMaterial(color.hex);
}

function Lumber({ position, size, material }: {
  position: [number, number, number];
  size: [number, number, number];
  material?: import("three").MeshStandardMaterial;
}) {
  return (
    <mesh position={position} material={material ?? PINE_MAT} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function PlywoodStrip({ position, length, railHeight, material }: {
  position: [number, number, number];
  length: number;
  railHeight?: number;
  material?: import("three").MeshStandardMaterial;
}) {
  const height = railHeight ?? RAIL_HEIGHT;
  return (
    <mesh position={position} material={material ?? PLYWOOD_MAT} castShadow receiveShadow>
      <boxGeometry args={[RAIL_THICKNESS, height, length]} />
    </mesh>
  );
}

// ── Tote ─────────────────────────────────────────────────────────────────
// Photorealistic HDX-style tote with vertical ribbing, lid grid, and handles.
// Group origin = BOTTOM of tote body.
//   Body: y = 0 → TOTE_BODY_H (black/clear, tapered with vertical ribs)
//   Rim:  y = TOTE_BODY_H → TOTE_BODY_H + TOTE_RIM_H (colored lid with grid)
//
// PLACEMENT RULE:
//   Rim sits ON TOP of rail → rim bottom = rail top
//   Rail top = railCenterY + RAIL_HEIGHT / 2
//   Rim bottom = toteGroupY + TOTE_BODY_H
//   So: toteGroupY = railCenterY + RAIL_HEIGHT/2 - TOTE_BODY_H
//   Body hangs BELOW the rail. Rim is above the rail.

// Rib/lid detail constants
const RIB_DEPTH = 0.15;       // How far ribs protrude from body face
const RIB_WIDTH = 0.3;        // Width of each vertical rib
const LID_GRID_H = 0.10;      // Height of raised grid lines on lid
const LID_GRID_W = 0.18;      // Width of grid lines
const LID_LIP = 0.4;          // How far lid overhangs body on each side

function Tote({ position, bayW, toteType, toteColor, unitType, orientation, unitDepth }: {
  position: [number, number, number];
  bayW: number;
  toteType: ToteType;
  toteColor: ToteColor;
  unitType: UnitType;
  orientation: Orientation;
  unitDepth: number;
}) {
  const isMini = unitType === "mini";
  const isSideways = unitType === "standard" && orientation === "sideways";
  const isClear = toteColor === "clear" && toteType === "HDX" && unitType === "standard";

  // Tote dimensions based on unit type and orientation
  const toteBodyH = isMini ? MINI_TOTE_H : TOTE_BODY_H;
  const toteRimH = isMini ? MINI_TOTE_RIM_H : TOTE_RIM_H;

  let toteW: number;
  let toteDepth: number;

  if (isMini) {
    toteW = MINI_TOTE_W;
    toteDepth = MINI_TOTE_D;
  } else if (isSideways) {
    toteW = bayW - BIN_GAP * 2;
    toteDepth = unitDepth - 2;
  } else {
    toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
    toteDepth = TOTE_DEPTH;
  }

  // Color logic — tuned to match real HDX/Greenmade injection-molded HDPE totes
  const rimColor = isMini ? "#f5b800" : (toteType === "HDX" ? "#f5b800" : "#f5b800");
  const rimDarkColor = isMini ? "#c99500" : (toteType === "HDX" ? "#c99500" : "#c99500");
  const bodyColor = (isMini || isClear) ? "#d4d4d8" : "#2a2a2a";
  const bodyRibColor = (isMini || isClear) ? "#c0c0c4" : "#333333";
  const bodyOpacity = (isMini || isClear) ? 0.55 : 1.0;

  // Cached materials — tuned for HDPE plastic (dielectric, NOT metallic)
  //   Plastic sheen comes from low roughness + Fresnel, NOT metalness.
  //   Metalness must stay near 0 or dark surfaces look transparent.
  const bodyMat = useMemo(() => getCachedMaterial("body", bodyColor, (isMini || isClear) ? 0.15 : 0.3, 0.0, { side: DoubleSide, ...(isMini || isClear ? { transparent: true, opacity: bodyOpacity } : {}) }), [bodyColor, isMini, isClear, bodyOpacity]);
  const bodyRibMat = useMemo(() => getCachedMaterial("rib", bodyRibColor, 0.35, 0.0), [bodyRibColor]);
  const rimMat = useMemo(() => getCachedMaterial("rim", rimColor, 0.2, 0.02), [rimColor]);
  const rimDarkMat = useMemo(() => getCachedMaterial("rimDark", rimDarkColor, 0.25, 0.02), [rimDarkColor]);
  const rimBottomMat = useMemo(() => getCachedMaterial("rimBot", bodyColor, 0.3, 0.0), [bodyColor]);
  const lidGridMat = useMemo(() => getCachedMaterial("grid", rimDarkColor, 0.28, 0.02), [rimDarkColor]);

  // Rim/lid dimensions — lid sits ON TOP of rails, overhangs body slightly
  // Lid width = bayW + small overhang per side (rim hooks over the rail edges)
  const rimW = isMini ? toteW : bayW + 0.5;
  // Lid depth — cannot extend past the posts. Rail runs full depth but lid
  // rests between post tops. Available = unitDepth - 2*POST_D + small overhang
  const rimD = isMini ? toteDepth : unitDepth - 2 * POST_D + 1.0;  // ~24" for 30" rack

  const bodyTopW = bayW - (isMini ? BIN_GAP * 2 : 0.75);  // 0.375" clearance per side
  const bodyBotW = bodyTopW * (isMini ? 0.92 : TOTE_BODY_TAPER);
  // Body must fit between front/back posts (clear depth = unitDepth - 2*POST_D = 23")
  const bodyTopD = isMini ? toteDepth * 0.90 : unitDepth - 2 * POST_D - 0.75;  // ~22.25"
  const bodyBotD = bodyTopD * (isMini ? 0.88 : TOTE_BODY_TAPER);  // subtle taper

  // Tapered body geometry
  const bodyGeo = useMemo(() => {
    const hw_t = bodyTopW / 2, hw_b = bodyBotW / 2;
    const hd_t = bodyTopD / 2, hd_b = bodyBotD / 2;
    const h = toteBodyH;
    const v = new Float32Array([
      -hw_b, 0, -hd_b, hw_b, 0, -hd_b, hw_b, 0, hd_b, -hw_b, 0, hd_b,
      -hw_t, h, -hd_t, hw_t, h, -hd_t, hw_t, h, hd_t, -hw_t, h, hd_t,
    ]);
    const idx = [
      0,2,1, 0,3,2, 4,5,6, 4,6,7,
      0,1,5, 0,5,4, 2,3,7, 2,7,6,
      0,4,7, 0,7,3, 1,2,6, 1,6,5,
    ];
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(v, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }, [bodyTopW, bodyBotW, bodyTopD, bodyBotD, toteBodyH]);

  // Generate vertical rib positions for each face
  const ribs = useMemo(() => {
    if (isMini) return []; // Mini totes are smooth
    const result: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    const midY = toteBodyH * 0.5;
    const ribH = toteBodyH * 0.75; // Ribs cover 75% of body height
    const avgW = (bodyTopW + bodyBotW) / 2;
    const avgD = (bodyTopD + bodyBotD) / 2;

    // Front and back faces: vertical ribs along width (Z faces)
    const numWRibs = Math.max(3, Math.floor(avgW / 3.5));
    for (let i = 0; i < numWRibs; i++) {
      const t = (i + 1) / (numWRibs + 1);
      const x = -avgW / 2 + avgW * t;
      // Front face (negative Z)
      result.push({ pos: [x, midY, -avgD / 2 - RIB_DEPTH / 2], size: [RIB_WIDTH, ribH, RIB_DEPTH] });
      // Back face (positive Z)
      result.push({ pos: [x, midY, avgD / 2 + RIB_DEPTH / 2], size: [RIB_WIDTH, ribH, RIB_DEPTH] });
    }

    // Left and right faces: vertical ribs along depth (X faces)
    const numDRibs = Math.max(2, Math.floor(avgD / 4));
    for (let i = 0; i < numDRibs; i++) {
      const t = (i + 1) / (numDRibs + 1);
      const z = -avgD / 2 + avgD * t;
      // Left face (negative X)
      result.push({ pos: [-avgW / 2 - RIB_DEPTH / 2, midY, z], size: [RIB_DEPTH, ribH, RIB_WIDTH] });
      // Right face (positive X)
      result.push({ pos: [avgW / 2 + RIB_DEPTH / 2, midY, z], size: [RIB_DEPTH, ribH, RIB_WIDTH] });
    }
    return result;
  }, [isMini, toteBodyH, bodyTopW, bodyBotW, bodyTopD, bodyBotD]);

  // Lid grid lines — axis-aligned X and Z lines forming a simple grid
  const lidGrid = useMemo(() => {
    if (isMini) return [];
    const lines: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    const lidY = toteBodyH + toteRimH + LID_GRID_H / 2;
    const innerW = rimW - 2.0;  // Inset from lid edge
    const innerD = rimD - 2.0;
    const spacing = 3.0;

    // Lines running along Z axis (width-wise spacing)
    const numW = Math.floor(innerW / spacing);
    for (let i = 0; i <= numW; i++) {
      const x = -innerW / 2 + i * (innerW / numW);
      lines.push({ pos: [x, lidY, 0], size: [LID_GRID_W, LID_GRID_H, innerD] });
    }

    // Lines running along X axis (depth-wise spacing)
    const numD = Math.floor(innerD / spacing);
    for (let i = 0; i <= numD; i++) {
      const z = -innerD / 2 + i * (innerD / numD);
      lines.push({ pos: [0, lidY, z], size: [innerW, LID_GRID_H, LID_GRID_W] });
    }

    return lines;
  }, [isMini, toteBodyH, toteRimH, rimW, rimD]);

  return (
    <group position={position}>
      {/* ── Body (tapered truncated pyramid) ─────────────────────────── */}
      <mesh geometry={bodyGeo} material={bodyMat} castShadow />

      {/* ── Vertical ribs on body faces ──────────────────────────────── */}
      {ribs.map((rib, i) => (
        <mesh key={`rib-${i}`} position={rib.pos} material={bodyRibMat}>
          <boxGeometry args={rib.size} />
        </mesh>
      ))}

      {/* ── Bottom rim (thick lip at body top) ───────────────────────── */}
      <mesh position={[0, toteBodyH - 0.25, 0]} material={rimBottomMat}>
        <boxGeometry args={[bodyTopW + 0.3, 0.5, bodyTopD + 0.3]} />
      </mesh>

      {/* ── Lid base (overhangs body with lip) ───────────────────────── */}
      <mesh position={[0, toteBodyH + toteRimH / 2, 0]} material={rimMat} castShadow>
        <boxGeometry args={[rimW + (isMini ? 0 : LID_LIP), toteRimH, rimD + (isMini ? 0 : LID_LIP)]} />
      </mesh>

      {/* ── Lid top surface (slightly inset, forms the tray) ─────────── */}
      <mesh position={[0, toteBodyH + toteRimH + 0.06, 0]} material={rimDarkMat}>
        <boxGeometry args={[rimW - 0.8, 0.12, rimD - 0.8]} />
      </mesh>

      {/* ── Lid grid pattern (rectangular cross-hatch) ─────────────── */}
      {!isMini && lidGrid.map((line, i) => (
        <mesh key={`grid-${i}`} position={line.pos} material={lidGridMat}>
          <boxGeometry args={line.size} />
        </mesh>
      ))}
    </group>
  );
}

// ── Hinge Material ──────────────────────────────────────────────────────
// (MeshStandardMaterial, Color imported at top of file)

const HINGE_MAT = new MeshStandardMaterial({
  color: new Color("#888888"),
  roughness: 0.3,
  metalness: 0.7,
});

// ── PlywoodDoor — flat plywood panel at front face of a bay opening ─────
function PlywoodDoor({ position, width, height, material }: {
  position: [number, number, number];
  width: number;
  height: number;
  material?: import("three").MeshStandardMaterial;
}) {
  return (
    <mesh position={position} material={material ?? PLYWOOD_MAT} castShadow receiveShadow>
      <boxGeometry args={[width, height, RAIL_THICKNESS]} />
    </mesh>
  );
}

// ── BlumConcealedHinge — Blum-style concealed cup hinge (invisible when closed)
// Modeled as a small mortised cup in the door edge + arm recessed into the post.
function BlumConcealedHinge({ position }: {
  position: [number, number, number];
}) {
  const cupR = 0.5;      // 35mm cup radius (≈0.69" but scaled for visual)
  const cupDepth = 0.45;
  const armW = 0.4;
  const armH = 0.35;
  const armD = 1.2;

  return (
    <group position={position}>
      {/* Hinge cup (recessed into door) */}
      <mesh position={[0, 0, -cupDepth / 2]} material={HINGE_MAT} castShadow>
        <cylinderGeometry args={[cupR, cupR, cupDepth, 12]} />
      </mesh>
      {/* Mounting arm (connects cup to post mounting plate) */}
      <mesh position={[0, 0, cupDepth / 2 + armD / 2]} material={HINGE_MAT} castShadow>
        <boxGeometry args={[armW, armH, armD]} />
      </mesh>
      {/* Mounting plate (screws into post/frame) */}
      <mesh position={[0, 0, cupDepth / 2 + armD + 0.1]} material={HINGE_MAT} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.2]} />
      </mesh>
    </group>
  );
}

// ── SidePanel — full-height plywood sheet on left or right side ──────────
function SidePanel({ position, height, depth, material }: {
  position: [number, number, number];
  height: number;
  depth: number;
  material?: import("three").MeshStandardMaterial;
}) {
  return (
    <mesh position={position} material={material ?? PLYWOOD_MAT} castShadow receiveShadow>
      <boxGeometry args={[RAIL_THICKNESS, height, depth]} />
    </mesh>
  );
}

// ── Rack Assembly ────────────────────────────────────────────────────────

function RackAssembly({
  cols, rows, toteType, toteColor, unitType, orientation, hasTotes, hasWheels, hasTop, addons,
  paintFrameColor, paintDoorColor, paintSidePanelColor, drawerSlideRows, drawerSlideColumns, drawersOpen,
  use2x4Rails,
}: Rack3DProps & { drawerSlideRows?: number; drawerSlideColumns?: number[]; drawersOpen?: boolean }) {
  const isMini = unitType === "mini";
  const is2x4 = use2x4Rails === true;

  // Resolve paint materials (null = use default wood texture)
  const frameMat = getPaintMaterial(paintFrameColor) ?? undefined;
  const doorMat = getPaintMaterial(paintDoorColor) ?? undefined;
  const sidePanelMat = getPaintMaterial(paintSidePanelColor) ?? undefined;
  // Rails: 2x4 mode uses lumber material, standard mode uses plywood (or frame paint)
  const railMat = is2x4 ? frameMat : frameMat;
  const standardBayW = is2x4
    ? (orientation === "sideways" ? SIDEWAYS_SLOT_W : RAILS_2X4_OPENING)
    : getBayWidth(toteType, unitType, orientation);
  // Drawer columns are 1" wider (0.5" per side for slide hardware)
  const DRAWER_SLIDE_EXTRA = 1.0;
  const colBayWidths = Array.from({ length: cols }, (_, c) =>
    (!is2x4 && drawerSlideColumns?.includes(c)) ? standardBayW + DRAWER_SLIDE_EXTRA : standardBayW
  );
  const bayW = standardBayW; // default for non-per-column calculations
  const totalW = colBayWidths.reduce((sum, w) => sum + w, 0) + (cols + 1) * POST_W;

  // Per-column post X positions (accounts for variable bay widths)
  const getColPostX = (postIdx: number) => {
    let x = POST_W / 2;
    for (let c = 0; c < postIdx; c++) {
      x += colBayWidths[c] + POST_W;
    }
    return x;
  };
  // Bay width for a specific column
  const getColBayW = (c: number) => colBayWidths[c] ?? standardBayW;

  // Get unit-specific values
  const unitDepth = is2x4 ? (orientation === "sideways" ? SIDEWAYS_DEPTH : RACK_DEPTH) : getUnitDepth(unitType, orientation);
  const railHeight = is2x4 ? RAILS_2X4_RAIL_H : getRailHeight(unitType);
  const effectiveRailThickness = is2x4 ? RAILS_2X4_RAIL_W : RAIL_THICKNESS;

  // 2x4 mode: use fixed rail positions; standard: uniform spacing
  const effectiveRows = is2x4 ? Math.min(rows, RAILS_2X4_POSITIONS.length) : rows;
  const tierSpacing = is2x4 ? 0 : getTierSpacing(unitType); // unused for 2x4 (positions are fixed)
  const firstRailY = is2x4 ? RAILS_2X4_POSITIONS[0] : getFirstRailY(unitType);
  // For 2x4: top rail position from fixed array
  const lastRailY = is2x4
    ? RAILS_2X4_POSITIONS[effectiveRows - 1]
    : firstRailY + (effectiveRows - 1) * tierSpacing;

  // Frame height calculation
  let frameH: number;
  if (is2x4) {
    // 2x4 rail: bottom plate + post height + top plate.
    // At 6 rows (max), post = full 96" stock; otherwise topRailPos + 2.75" gap.
    const postHeight = effectiveRows >= RAILS_2X4_POSITIONS.length
      ? RAILS_2X4_STOCK_LENGTH
      : lastRailY + RAILS_2X4_TOP_GAP;
    frameH = PLATE_H + postHeight + PLATE_H;
  } else if (isMini) {
    // Mini: bottom plate + rails + clearance above top rail + plywood top
    frameH = PLATE_H + lastRailY + 2 + PLY_TOP_H;
  } else {
    // Standard: bottom plate + rails + gap + top plate
    const topGap = 3;
    frameH = PLATE_H + lastRailY + topGap + PLATE_H;
  }

  const lift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + lift;

  const cx = totalW / 2;
  const cy = overallH / 2;
  const cz = unitDepth / 2;

  // Rails span the full depth
  const railLen = unitDepth;

  // Post height differs by mode
  const postH = is2x4
    ? (effectiveRows >= RAILS_2X4_POSITIONS.length
        ? RAILS_2X4_STOCK_LENGTH                      // 2x4 6-high: full 96" stock
        : lastRailY + RAILS_2X4_TOP_GAP)              // 2x4 1-5 high: top rail pos + 2.75"
    : isMini
      ? lastRailY + 2 // Mini: just past the top rail
      : frameH - PLATE_H * 2;

  // Tote body height for positioning
  const toteBodyH = isMini ? MINI_TOTE_H : TOTE_BODY_H;

  return (
    <group scale={[S, S, S]}>
      {/* scale X by -1 so bay 0 (lowest X) maps to LEFT when facing front (-Z face) */}
      <group position={[cx, -cy, -cz]} scale={[-1, 1, 1]}>

        {/* ── WOOD FRAME — lifted by caster height ── */}
        <group position={[0, lift, 0]}>

          {/* Bottom plates (same for both unit types) */}
          <Lumber position={[totalW / 2, PLATE_H / 2, POST_D / 2]} size={[totalW, PLATE_H, POST_D]} material={frameMat} />
          <Lumber position={[totalW / 2, PLATE_H / 2, unitDepth - POST_D / 2]} size={[totalW, PLATE_H, POST_D]} material={frameMat} />

          {/* Top plates — Standard and 2x4 rail units (not Mini) */}
          {(is2x4 || !isMini) && (
            <>
              <Lumber position={[totalW / 2, frameH - PLATE_H / 2, POST_D / 2]} size={[totalW, PLATE_H, POST_D]} material={frameMat} />
              <Lumber position={[totalW / 2, frameH - PLATE_H / 2, unitDepth - POST_D / 2]} size={[totalW, PLATE_H, POST_D]} material={frameMat} />
            </>
          )}

          {/* Ladder frames: posts + rails */}
          {Array.from({ length: cols + 1 }).map((_, i) => {
            const px = getColPostX(i);
            return (
              <group key={`ladder-${i}`}>
                {/* Front + Back posts */}
                <Lumber position={[px, PLATE_H + postH / 2, POST_D / 2]} size={[POST_W, postH, POST_D]} material={frameMat} />
                <Lumber position={[px, PLATE_H + postH / 2, unitDepth - POST_D / 2]} size={[POST_W, postH, POST_D]} material={frameMat} />

                {/* Right-face rails (serve bay i) — skip if rail_removed addon */}
                {i < cols && Array.from({ length: effectiveRows }).map((_, r) => {
                  const isRailRemoved = !is2x4 && addons?.some(
                    (a) => a.type === "rail_removed" && a.target === i && (a.row === undefined || a.row === r)
                  );
                  if (isRailRemoved) return null;
                  const railY = is2x4
                    ? PLATE_H + RAILS_2X4_POSITIONS[r]
                    : PLATE_H + firstRailY + r * tierSpacing;
                  const railX = px + POST_W / 2 + effectiveRailThickness / 2;
                  // Drawer column: rail slides out with tote (not in 2x4 mode)
                  const isDrawerCol = !is2x4 && (drawerSlideColumns?.includes(i) ?? (drawerSlideRows ? r < drawerSlideRows : false));
                  const railSlideZ = isDrawerCol && drawersOpen ? unitDepth * 0.6 : 0;
                  return is2x4 ? (
                    <Lumber
                      key={`rr-${i}-${r}`}
                      position={[railX, railY, unitDepth / 2 - railSlideZ]}
                      size={[RAILS_2X4_RAIL_W, RAILS_2X4_RAIL_H, railLen]}
                      material={frameMat}
                    />
                  ) : (
                    <PlywoodStrip
                      key={`rr-${i}-${r}`}
                      position={[railX, railY, unitDepth / 2 - railSlideZ]}
                      length={railLen}
                      railHeight={railHeight}
                      material={railMat}
                    />
                  );
                })}

                {/* Left-face rails (serve bay i-1) — skip if rail_removed addon */}
                {i > 0 && Array.from({ length: effectiveRows }).map((_, r) => {
                  const isRailRemoved = !is2x4 && addons?.some(
                    (a) => a.type === "rail_removed" && a.target === (i - 1) && (a.row === undefined || a.row === r)
                  );
                  if (isRailRemoved) return null;
                  const railY = is2x4
                    ? PLATE_H + RAILS_2X4_POSITIONS[r]
                    : PLATE_H + firstRailY + r * tierSpacing;
                  const railX = px - POST_W / 2 - effectiveRailThickness / 2;
                  // Drawer column: rail slides out with tote (not in 2x4 mode)
                  const isDrawerCol = !is2x4 && (drawerSlideColumns?.includes(i - 1) ?? (drawerSlideRows ? r < drawerSlideRows : false));
                  const railSlideZ = isDrawerCol && drawersOpen ? unitDepth * 0.6 : 0;
                  return is2x4 ? (
                    <Lumber
                      key={`rl-${i}-${r}`}
                      position={[railX, railY, unitDepth / 2 - railSlideZ]}
                      size={[RAILS_2X4_RAIL_W, RAILS_2X4_RAIL_H, railLen]}
                      material={frameMat}
                    />
                  ) : (
                    <PlywoodStrip
                      key={`rl-${i}-${r}`}
                      position={[railX, railY, unitDepth / 2 - railSlideZ]}
                      length={railLen}
                      railHeight={railHeight}
                      material={railMat}
                    />
                  );
                })}
              </group>
            );
          })}

          {/* Totes — rim ON TOP of rail, body hangs BELOW (skip for rail-removed slots) */}
          {hasTotes && Array.from({ length: cols }).map((_, c) => {
            const leftPostX = getColPostX(c);
            const rightPostX = getColPostX(c + 1);
            const bayCenterX = (leftPostX + rightPostX) / 2;

            return Array.from({ length: rows }).map((_, r) => {
              // Skip tote if rails are removed or shelf is placed for this bay/row
              const isRailRemoved = addons?.some(
                (a) => a.type === "rail_removed" && a.target === c && (a.row === undefined || a.row === r)
              );
              const hasShelfAddon = addons?.some(
                (a) => a.type === "shelf" && a.target === c && (a.row === undefined || a.row === r)
              );
              if (isRailRemoved || hasShelfAddon) return null;

              const railCenterY = is2x4
                ? PLATE_H + RAILS_2X4_POSITIONS[r]
                : PLATE_H + firstRailY + r * tierSpacing;
              const railTop = railCenterY + railHeight / 2;
              const toteGroupY = railTop - toteBodyH;

              // Drawer slide: drawer columns slide out when drawersOpen
              const isDrawerCol = drawerSlideColumns?.includes(c) ?? (drawerSlideRows ? r < drawerSlideRows : false);
              const slideOffset = isDrawerCol && drawersOpen ? unitDepth * 0.6 : 0;

              return (
                <group key={`tote-${c}-${r}`}>
                  <Tote
                    position={[bayCenterX, toteGroupY, unitDepth / 2 - slideOffset]}
                    bayW={getColBayW(c)}
                    toteType={toteType}
                    toteColor={toteColor}
                    unitType={unitType}
                    orientation={orientation}
                    unitDepth={unitDepth}
                  />
                </group>
              );
            });
          })}

          {/* Shelves — 3/4" plywood sitting on top of rails */}
          {addons && addons.filter((a) => a.type === "shelf").map((addon) => {
            const col = addon.target as number;
            const row = addon.row ?? 0;
            const leftPostX = getColPostX(col);
            const rightPostX = getColPostX(col + 1);
            const shelfCenterX = (leftPostX + rightPostX) / 2;
            const railCenterY = is2x4
              ? PLATE_H + RAILS_2X4_POSITIONS[row]
              : PLATE_H + firstRailY + row * tierSpacing;
            const railTop = railCenterY + railHeight / 2;
            const shelfY = railTop + PLY_TOP_H / 2; // sits on top of rails
            const shelfW = bayW - RAIL_THICKNESS; // fits between the two rail strips
            return (
              <mesh
                key={`shelf-${col}-${row}`}
                position={[shelfCenterX, shelfY, unitDepth / 2]}
                material={PLYWOOD_MAT}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[shelfW, PLY_TOP_H, unitDepth]} />
              </mesh>
            );
          })}

          {/* Plywood top — mandatory for Mini, optional for Standard */}
          {/* When side panels are present, the top extends an extra 3/4" on that side to cover the panel */}
          {hasTop && (() => {
            const hasLeftPanel = addons?.some((a) => a.type === "side_panel" && a.target === "left");
            const hasRightPanel = addons?.some((a) => a.type === "side_panel" && a.target === "right");
            // Left panel is at +X side, right panel at -X side (front-facing convention)
            const posXExt = hasLeftPanel ? RAIL_THICKNESS : 0;   // +X extension for left panel
            const negXExt = hasRightPanel ? RAIL_THICKNESS : 0;  // -X extension for right panel
            const topW = totalW + posXExt + negXExt;
            const topCenterX = totalW / 2 + (posXExt - negXExt) / 2;

            return (
              <mesh
                position={[
                  topCenterX,
                  isMini
                    ? PLATE_H + postH + PLY_TOP_H / 2
                    : frameH + PLY_TOP_H / 2,
                  unitDepth / 2
                ]}
                material={frameMat ?? PLYWOOD_TOP_MAT}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[topW, PLY_TOP_H, unitDepth]} />
              </mesh>
            );
          })()}

          {/* ── Section Addons (Organizer Customization) ────────────── */}
          {addons && addons.length > 0 && (() => {
            const sidePanelAddons = addons.filter((a) => a.type === "side_panel");
            const hasDoors = addons.some((a) => a.type === "plywood_door" && a.target === "doors_on");

            const hasLeftPanel = sidePanelAddons.some((a) => a.target === "left");
            const hasRightPanel = sidePanelAddons.some((a) => a.target === "right");

            // Side panels extend to cover both top and bottom 2x4 plates
            // For standard units: from 0 (bottom of bottom plate) to frameH (top of top plate)
            // For mini units: from 0 to PLATE_H + postH + PLY_TOP_H
            const panelBottom = 0;
            const panelTop = isMini
              ? PLATE_H + postH + PLY_TOP_H
              : frameH; // covers top 2x4 plates fully
            const panelH = panelTop - panelBottom;
            const panelCenterY = panelBottom + panelH / 2;

            return (
              <>
                {/* Full-height column doors — one door per column, spanning bottom to top */}
                {hasDoors && Array.from({ length: cols }).map((_, col) => {
                  const leftPostX = getColPostX(col);
                  const rightPostX = getColPostX(col + 1);
                  const bayCenterX = (leftPostX + rightPostX) / 2;

                  // Door is slightly larger than the opening (overlaps posts by 0.25" each side)
                  const doorW = bayW + 0.5;
                  // Door spans from bottom plate to top plate (full column height)
                  const doorH = panelH;
                  const doorCenterY = panelCenterY;
                  // Door sits in front of the organizer, touching the front vertical posts
                  // Pull it forward: sits flush against the front face of the front posts
                  const doorZ = -RAIL_THICKNESS / 2;

                  return (
                    <group key={`door-col-${col}`}>
                      <PlywoodDoor
                        position={[bayCenterX, doorCenterY, doorZ]}
                        width={doorW}
                        height={doorH}
                        material={doorMat}
                      />
                      {/* Blum concealed hinges — 2 per door (top and bottom third) */}
                      <BlumConcealedHinge
                        position={[leftPostX + POST_W / 2, doorCenterY + doorH * 0.3, doorZ]}
                      />
                      <BlumConcealedHinge
                        position={[leftPostX + POST_W / 2, doorCenterY - doorH * 0.3, doorZ]}
                      />
                    </group>
                  );
                })}

                {/* Side Panels — left and/or right side, extending to underside of top */}
                {sidePanelAddons.map((addon, idx) => {
                  const isLeft = addon.target === "left";
                  const isRight = addon.target === "right";
                  if (!isLeft && !isRight) return null;

                  // Inner group has scale={[-1,1,1]} so local X is mirrored.
                  // Left (low local X) → flipped to high world X → screen-left ✓
                  // Right (high local X) → flipped to low world X → screen-right ✓
                  const panelX = isLeft
                    ? -RAIL_THICKNESS / 2
                    : totalW + RAIL_THICKNESS / 2;

                  return (
                    <SidePanel
                      key={`side-${idx}`}
                      position={[panelX, panelCenterY, unitDepth / 2]}
                      height={panelH}
                      depth={unitDepth}
                      material={sidePanelMat}
                    />
                  );
                })}
              </>
            );
          })()}
        </group>

        {/* ── 4 CASTERS — outer corners only ── */}
        {hasWheels && (() => {
          const firstPostX = getColPostX(0);
          const lastPostX = getColPostX(cols);
          return (
            <>
              <IndustrialCaster position={[firstPostX, 0, POST_D / 2]} />
              <IndustrialCaster position={[lastPostX, 0, POST_D / 2]} />
              <IndustrialCaster position={[firstPostX, 0, unitDepth - POST_D / 2]} />
              <IndustrialCaster position={[lastPostX, 0, unitDepth - POST_D / 2]} />
            </>
          );
        })()}

        {/* ── Drawer Slides + Cross Support Backers ──────────────── */}
        {((drawerSlideColumns && drawerSlideColumns.length > 0) || (drawerSlideRows && drawerSlideRows > 0)) && (() => {
          const slideElements: React.ReactNode[] = [];
          const slideH = 1.5;
          const slideW = 0.4;
          const slideColor = "#c0c0c0";
          const backerMat = frameMat ?? PINE_MAT;
          const slideOffset = drawersOpen ? unitDepth * 0.6 : 0;
          const backerDepth = unitDepth - POST_D; // spans between front and back posts

          // Determine which columns have drawers
          const drawerCols = drawerSlideColumns ?? (drawerSlideRows ? Array.from({ length: cols }, (_, i) => i) : []);
          // All rows in a drawer column get slides
          const drawerRowCount = rows;

          for (let row = 0; row < drawerRowCount; row++) {
            const railCenterY = is2x4
              ? PLATE_H + RAILS_2X4_POSITIONS[row]
              : PLATE_H + firstRailY + row * tierSpacing;
            const slideCenterY = railCenterY;

            // Cross support backers — at posts adjacent to drawer columns only
            const backerPostSet: Record<number, boolean> = {};
            for (const col of drawerCols) {
              backerPostSet[col] = true;       // left post of drawer bay
              backerPostSet[col + 1] = true;   // right post of drawer bay
            }
            for (const postIdx of Object.keys(backerPostSet).map(Number)) {
              const px = getColPostX(postIdx);
              slideElements.push(
                <mesh key={`backer-${row}-${postIdx}`}
                  position={[px, slideCenterY, unitDepth / 2]}
                  material={backerMat}
                  castShadow>
                  <boxGeometry args={[POST_W, POST_W, backerDepth]} />
                </mesh>
              );
            }

            // Slides — only for drawer columns
            for (const col of drawerCols) {
              const leftPostX = getColPostX(col);
              const rightPostX = getColPostX(col + 1);

              // Left slide (on right face of left post, just inside the rail)
              const leftSlideX = leftPostX + POST_W / 2 + RAIL_THICKNESS + slideW / 2;
              // Right slide (on left face of right post, just inside the rail)
              const rightSlideX = rightPostX - POST_W / 2 - RAIL_THICKNESS - slideW / 2;

              // Fixed channel — stays on frame (back portion)
              const fixedLen = unitDepth * 0.4;
              slideElements.push(
                <mesh key={`sf-l-${row}-${col}`} position={[leftSlideX, slideCenterY, unitDepth - fixedLen / 2 - POST_D / 2]} material={SLIDE_FIXED_MAT}>
                  <boxGeometry args={[slideW, slideH, fixedLen]} />
                </mesh>
              );
              slideElements.push(
                <mesh key={`sf-r-${row}-${col}`} position={[rightSlideX, slideCenterY, unitDepth - fixedLen / 2 - POST_D / 2]} material={SLIDE_FIXED_MAT}>
                  <boxGeometry args={[slideW, slideH, fixedLen]} />
                </mesh>
              );

              // Extending slide — moves with tote/rail
              const extLen = unitDepth * 0.8;
              slideElements.push(
                <mesh key={`se-l-${row}-${col}`} position={[leftSlideX, slideCenterY, unitDepth / 2 - slideOffset]} material={SLIDE_EXTENDING_MAT}>
                  <boxGeometry args={[slideW * 0.6, slideH * 0.6, extLen]} />
                </mesh>
              );
              slideElements.push(
                <mesh key={`se-r-${row}-${col}`} position={[rightSlideX, slideCenterY, unitDepth / 2 - slideOffset]} material={SLIDE_EXTENDING_MAT}>
                  <boxGeometry args={[slideW * 0.6, slideH * 0.6, extLen]} />
                </mesh>
              );
            }
          }
          return <>{slideElements}</>;
        })()}
      </group>
    </group>
  );
}

// ── Camera rig ───────────────────────────────────────────────────────────

function CameraRig({ cols, rows, toteType, unitType, orientation, hasWheels, use2x4Rails }: Pick<Rack3DProps, "cols" | "rows" | "toteType" | "unitType" | "orientation" | "hasWheels" | "use2x4Rails">) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const isMini = unitType === "mini";
  const is2x4 = use2x4Rails === true;
  const bayW = is2x4
    ? (orientation === "sideways" ? SIDEWAYS_SLOT_W : RAILS_2X4_OPENING)
    : getBayWidth(toteType, unitType, orientation);
  const totalW = cols * bayW + (cols + 1) * POST_W;
  const unitDepth = is2x4 ? (orientation === "sideways" ? SIDEWAYS_DEPTH : RACK_DEPTH) : getUnitDepth(unitType, orientation);
  const effectiveRows = is2x4 ? Math.min(rows, RAILS_2X4_POSITIONS.length) : rows;
  const tierSpacing = is2x4 ? 0 : getTierSpacing(unitType);
  const firstRailY = is2x4 ? RAILS_2X4_POSITIONS[0] : getFirstRailY(unitType);

  const lastRailY = is2x4
    ? RAILS_2X4_POSITIONS[effectiveRows - 1]
    : firstRailY + (effectiveRows - 1) * tierSpacing;

  let frameH: number;
  if (is2x4) {
    // At 6 rows (max), post = full 96" stock; otherwise topRailPos + 2.75" gap.
    const postHeight = effectiveRows >= RAILS_2X4_POSITIONS.length
      ? RAILS_2X4_STOCK_LENGTH
      : lastRailY + RAILS_2X4_TOP_GAP;
    frameH = PLATE_H + postHeight + PLATE_H;
  } else if (isMini) {
    frameH = PLATE_H + lastRailY + 2 + PLY_TOP_H;
  } else {
    frameH = PLATE_H + lastRailY + 3 + PLATE_H;
  }

  const lift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + lift;

  const sw = totalW * S;
  const sh = overallH * S;
  const sd = unitDepth * S;
  const maxDim = Math.max(sw, sh, sd);
  const dist = maxDim * 2.2;

  useEffect(() => {
    // Camera at front-right: +X, +Y, -Z so doors (at -Z face) are visible
    camera.position.set(dist * 0.6, dist * 0.6, -dist * 0.6);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, dist]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      autoRotate
      autoRotateSpeed={0.5}
      enablePan
      panSpeed={0.5}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 1.5}
      minDistance={0.2}
      maxDistance={dist * 5}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

// ── Compound Preset Assembly ─────────────────────────────────────────────
// Renders multiple RackAssembly groups side by side as one compound unit.

function CompoundRackAssembly({ presetUnits, toteType, toteColor, unitType, orientation, hasTotes, use2x4Rails, drawerSlideRows, drawerSlideColumns, drawersOpen }: {
  presetUnits: SubUnit3D[];
  toteType: ToteType;
  toteColor: ToteColor;
  unitType: UnitType;
  orientation: Orientation;
  hasTotes: boolean;
  use2x4Rails?: boolean;
  drawerSlideRows?: number;
  drawerSlideColumns?: number[];
  drawersOpen?: boolean;
}) {
  const isMini = unitType === "mini";
  const is2x4 = use2x4Rails === true;
  const bayW = is2x4
    ? (orientation === "sideways" ? SIDEWAYS_SLOT_W : RAILS_2X4_OPENING)
    : getBayWidth(toteType, unitType, orientation);
  const GAP_INCHES = 1; // 1" gap between sub-units

  // Calculate overallH for each sub-unit and find the tallest
  const unitHeights = presetUnits.map((unit) => {
    let frameH: number;
    if (is2x4) {
      const effectiveRows = Math.min(unit.rows, RAILS_2X4_POSITIONS.length);
      // At 6 rows (max), upright = full 96" stock; otherwise topRailPos + 2.75".
      const uprightH = effectiveRows >= RAILS_2X4_POSITIONS.length
        ? RAILS_2X4_STOCK_LENGTH
        : RAILS_2X4_POSITIONS[effectiveRows - 1] + RAILS_2X4_TOP_GAP;
      frameH = PLATE_H + uprightH + PLATE_H;
    } else {
      const tierSpacing = getTierSpacing(unitType);
      const firstRailY = getFirstRailY(unitType);
      const lastRailY = firstRailY + (unit.rows - 1) * tierSpacing;
      frameH = isMini
        ? PLATE_H + lastRailY + 2 + PLY_TOP_H
        : PLATE_H + lastRailY + 3 + PLATE_H;
    }
    const lift = unit.hasWheels ? CASTER_HEIGHT : 0;
    return frameH + lift;
  });
  const maxH = Math.max(...unitHeights);

  // Calculate total combined width and positions for each sub-unit
  const positions: number[] = [];
  let totalCombinedW = 0;
  for (let i = 0; i < presetUnits.length; i++) {
    const unit = presetUnits[i];
    const unitW = unit.cols * bayW + (unit.cols + 1) * POST_W;
    positions.push(totalCombinedW + unitW / 2);
    totalCombinedW += unitW + (i < presetUnits.length - 1 ? GAP_INCHES : 0);
  }

  const centerOffset = totalCombinedW / 2;

  return (
    <group scale={[S, S, S]}>
      {presetUnits.map((unit, i) => {
        const xOffset = (positions[i] - centerOffset);
        const yOffset = (unitHeights[i] - maxH) / 2;
        return (
          <group key={`preset-unit-${i}`} position={[xOffset, yOffset, 0]}>
            <group scale={[1 / S, 1 / S, 1 / S]}>
              <RackAssembly
                cols={unit.cols}
                rows={unit.rows}
                toteType={toteType}
                toteColor={toteColor}
                unitType={unitType}
                orientation={orientation}
                hasTotes={hasTotes}
                hasWheels={unit.hasWheels}
                hasTop={unit.hasTop}
                use2x4Rails={use2x4Rails}
                drawerSlideRows={drawerSlideRows}
                drawerSlideColumns={drawerSlideColumns}
                drawersOpen={drawersOpen}
              />
            </group>
          </group>
        );
      })}
    </group>
  );
}

// ── Compound Camera Rig ─────────────────────────────────────────────────

function CompoundCameraRig({ presetUnits, toteType, unitType, orientation, use2x4Rails }: {
  presetUnits: SubUnit3D[];
  toteType: ToteType;
  unitType: UnitType;
  orientation: Orientation;
  use2x4Rails?: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const is2x4 = use2x4Rails === true;
  const bayW = is2x4
    ? (orientation === "sideways" ? SIDEWAYS_SLOT_W : RAILS_2X4_OPENING)
    : getBayWidth(toteType, unitType, orientation);
  const unitDepth = is2x4
    ? (orientation === "sideways" ? SIDEWAYS_DEPTH : RACK_DEPTH)
    : getUnitDepth(unitType, orientation);
  const GAP_INCHES = 1;

  let totalW = 0;
  let maxH = 0;
  for (const unit of presetUnits) {
    totalW += unit.cols * bayW + (unit.cols + 1) * POST_W + GAP_INCHES;
    let fH: number;
    if (is2x4) {
      const effectiveRows = Math.min(unit.rows, RAILS_2X4_POSITIONS.length);
      // At 6 rows (max), upright = full 96" stock; otherwise topRailPos + 2.75".
      const uprightH = effectiveRows >= RAILS_2X4_POSITIONS.length
        ? RAILS_2X4_STOCK_LENGTH
        : RAILS_2X4_POSITIONS[effectiveRows - 1] + RAILS_2X4_TOP_GAP;
      fH = PLATE_H + uprightH + PLATE_H;
    } else {
      const tierSpacing = getTierSpacing(unitType);
      const firstRailY = getFirstRailY(unitType);
      const lastRailY = firstRailY + (unit.rows - 1) * tierSpacing;
      fH = unitType === "mini"
        ? PLATE_H + lastRailY + 2 + PLY_TOP_H
        : PLATE_H + lastRailY + 3 + PLATE_H;
    }
    if (fH > maxH) maxH = fH;
  }

  const sw = totalW * S;
  const sh = maxH * S;
  const sd = unitDepth * S;
  const maxDim = Math.max(sw, sh, sd);
  const dist = maxDim * 2.2;

  useEffect(() => {
    // Camera at front-right: +X, +Y, -Z so doors (at -Z face) are visible
    camera.position.set(dist * 0.6, dist * 0.6, -dist * 0.6);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, dist]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      autoRotate
      autoRotateSpeed={0.5}
      enablePan
      panSpeed={0.5}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 1.5}
      minDistance={0.2}
      maxDistance={dist * 5}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

// ── Open Shelving Assembly ─────────────────────────────────────────────────
// Matches real construction: 2×4 vertical corner posts, horizontal 2×4
// supports (on edge, 3.5" tall) running front-to-back at each shelf level,
// with 3/4" plywood sheets sitting on top of each support pair.
// No totes — just open plywood shelving.

function ShelvingAssembly({ config }: { config: ShelvingConfig3D }) {
  const { widthIn, frameH, depth, shelves } = config;
  const totalW = widthIn;

  // 2×4 horizontal supports on edge (POST_D tall, POST_W wide)
  const SUPPORT_H = POST_D;  // 3.5" — on edge, wide face vertical
  const SUPPORT_W = POST_W;  // 1.5" — narrow face along width direction

  // Posts end so that plywood cap on top reaches frameH
  const postTopY = frameH - PLY_TOP_H;          // top of posts
  const postH = postTopY - PLATE_H;              // post length

  // Interior shelf positions (support base Y values — excludes top cap)
  const shelfYPositions: number[] = [];
  // Bottom shelf: support sits on the bottom plate
  shelfYPositions.push(PLATE_H);
  // Middle shelves: evenly spaced between bottom shelf top and post tops
  if (shelves > 0) {
    const regionBottom = PLATE_H + SUPPORT_H + PLY_TOP_H; // above bottom shelf
    const regionTop = postTopY;                             // up to post tops
    for (let i = 0; i < shelves; i++) {
      const y = regionBottom + ((i + 1) / (shelves + 1)) * (regionTop - regionBottom);
      shelfYPositions.push(y);
    }
  }

  const cx = totalW / 2;
  const overallH = frameH; // total height including top plywood cap
  const cy = overallH / 2;
  const cz = depth / 2;

  // Left post centers
  const leftPostX = POST_W / 2;
  const rightPostX = totalW - POST_W / 2;

  return (
    <group scale={[S, S, S]}>
      <group position={[cx, -cy, -cz]} scale={[-1, 1, 1]}>
        {/* Bottom plates — 2×4s running along width (front + back) */}
        <Lumber position={[totalW / 2, PLATE_H / 2, POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />
        <Lumber position={[totalW / 2, PLATE_H / 2, depth - POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />

        {/* 4 corner posts — 2×4s running vertically */}
        <Lumber position={[leftPostX, PLATE_H + postH / 2, POST_D / 2]} size={[POST_W, postH, POST_D]} />
        <Lumber position={[leftPostX, PLATE_H + postH / 2, depth - POST_D / 2]} size={[POST_W, postH, POST_D]} />
        <Lumber position={[rightPostX, PLATE_H + postH / 2, POST_D / 2]} size={[POST_W, postH, POST_D]} />
        <Lumber position={[rightPostX, PLATE_H + postH / 2, depth - POST_D / 2]} size={[POST_W, postH, POST_D]} />

        {/* Interior shelf levels: horizontal 2×4 supports + plywood */}
        {shelfYPositions.map((baseY, i) => {
          const supportCenterY = baseY + SUPPORT_H / 2;
          const supportLeftX = leftPostX + POST_W / 2 + SUPPORT_W / 2;
          const supportRightX = rightPostX - POST_W / 2 - SUPPORT_W / 2;
          const plyY = baseY + SUPPORT_H + PLY_TOP_H / 2;

          return (
            <group key={`shelf-level-${i}`}>
              <Lumber
                position={[supportLeftX, supportCenterY, depth / 2]}
                size={[SUPPORT_W, SUPPORT_H, depth - POST_D * 2]}
              />
              <Lumber
                position={[supportRightX, supportCenterY, depth / 2]}
                size={[SUPPORT_W, SUPPORT_H, depth - POST_D * 2]}
              />
              <mesh
                position={[totalW / 2, plyY, depth / 2]}
                material={PLYWOOD_MAT}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[totalW, PLY_TOP_H, depth]} />
              </mesh>
            </group>
          );
        })}

        {/* Top plywood cap — sits directly on post tops, no supports */}
        <mesh
          position={[totalW / 2, postTopY + PLY_TOP_H / 2, depth / 2]}
          material={PLYWOOD_TOP_MAT}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[totalW, PLY_TOP_H, depth]} />
        </mesh>
      </group>
    </group>
  );
}

function ShelvingCameraRig({ config }: { config: ShelvingConfig3D }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const sw = config.widthIn * S;
  const sh = config.frameH * S;
  const sd = config.depth * S;
  const maxDim = Math.max(sw, sh, sd);
  const dist = maxDim * 2.2;

  useEffect(() => {
    camera.position.set(dist * 0.6, dist * 0.6, -dist * 0.6);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, dist]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      autoRotate
      autoRotateSpeed={0.5}
      enablePan
      panSpeed={0.5}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 1.5}
      minDistance={0.2}
      maxDistance={dist * 5}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Ceiling Tote Rail System — 4-layer: nailer → padding → plywood rail
//
// Totes hang between adjacent rail assemblies by their rim/lip.
// Layer 1 (top): 2×4 nailer mounted flat — lagged to ceiling joists (1.5" drop)
// Layer 2 (mid): 2×4 padding block on-edge — creates clearance for tote lid (3.5" drop)
// Layer 3 (bot): 3/4" plywood rail strip — 4" wide, 1.25" ledge per side
// ═══════════════════════════════════════════════════════════════════════════

// Ceiling rail assembly constants (4-layer: nailer + 2× padding + rail)
const CEIL_NAILER_W = 3.5;    // 2×4 wide face against ceiling
const CEIL_NAILER_H = 1.5;    // 2×4 mounted belly-flat, 1.5" drop
const CEIL_PADDING_LAYERS = 2; // Two stacked 2×4 padding layers for lid clearance
const CEIL_SPACER_H = 1.5;    // Each 2×4 padding layer, 1.5" drop
const CEIL_SPACER_W = 3.5;    // 2×4 flat, wide face down
const CEIL_RAIL_W = 6.0;      // Plywood rail strip width (3.5" padding + 2×1.25" ledge)
const CEIL_RAIL_H = 0.75;     // 3/4" plywood
const CEIL_TOTE_SLOT_LEN = 30.5; // ~30" per tote position along the rail
const CEIL_SLOT_CLEARANCE = 0.25;
const CEIL_LIP_OVERHANG = 1.0;

function getCeilSlotWidth(toteType: "HDX" | "GM"): number {
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  return toteW - 2 * CEIL_LIP_OVERHANG + 2 * CEIL_SLOT_CLEARANCE;
}

function OverheadAssembly({ config }: { config: OverheadConfig3D }) {
  const { slotsWide, slotsDeep, toteType } = config;

  const slotW = getCeilSlotWidth(toteType);
  const railSpacing = slotW + CEIL_RAIL_W; // center-to-center of adjacent rail assemblies
  const systemW = (slotsWide + 1) * CEIL_RAIL_W + slotsWide * slotW;
  const systemD = slotsDeep * CEIL_TOTE_SLOT_LEN;

  // Total assembly height: nailer + (2 × padding) + rail
  const totalH = CEIL_NAILER_H + CEIL_PADDING_LAYERS * CEIL_SPACER_H + CEIL_RAIL_H;

  // Nailers run along the depth (Z axis), perpendicular to rail strips (X axis)
  // Need nailers at front, back, and intermediate for support (~48" spacing)
  const nailerCount = Math.max(2, Math.ceil(systemD / 48) + 1);
  const nailerPositions: number[] = [];
  for (let i = 0; i < nailerCount; i++) {
    nailerPositions.push(i * (systemD / (nailerCount - 1)));
  }

  // Rail assembly X positions (center of each rail strip)
  const railXPositions: number[] = [];
  for (let i = 0; i <= slotsWide; i++) {
    railXPositions.push(CEIL_RAIL_W / 2 + i * railSpacing);
  }

  // Center the assembly
  const cx = systemW / 2;
  const cy = totalH / 2;
  const cz = systemD / 2;

  // Tote dimensions for hanging totes
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;

  return (
    <group scale={[S, S, S]}>
      <group position={[cx, -cy, -cz]} scale={[-1, 1, 1]}>
        {/* ── Layer 1: Nailers (2×4) — at the top, run along X (system width) ── */}
        {nailerPositions.map((nz, ni) => (
          <Lumber
            key={`nailer-${ni}`}
            position={[systemW / 2, totalH - CEIL_NAILER_H / 2, nz]}
            size={[systemW, CEIL_NAILER_H, CEIL_NAILER_W]}
          />
        ))}

        {/* ── Layers 2 & 3: Double padding beams (2×4 perpendicular to nailers) ── */}
        {railXPositions.map((rx, ri) =>
          Array.from({ length: CEIL_PADDING_LAYERS }).map((_, li) => (
            <Lumber
              key={`padding-${ri}-${li}`}
              position={[rx, totalH - CEIL_NAILER_H - li * CEIL_SPACER_H - CEIL_SPACER_H / 2, systemD / 2]}
              size={[CEIL_SPACER_W, CEIL_SPACER_H, systemD]}
            />
          ))
        )}

        {/* ── Layer 4: Rail strips (plywood) — run along Z (system depth) ── */}
        {railXPositions.map((rx, ri) => (
          <mesh
            key={`rail-${ri}`}
            position={[rx, CEIL_RAIL_H / 2, systemD / 2]}
            material={PLYWOOD_TOP_MAT}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[CEIL_RAIL_W, CEIL_RAIL_H, systemD]} />
          </mesh>
        ))}

        {/* ── Totes hanging between rail strips ── */}
        {Array.from({ length: slotsWide }).map((_, col) => {
          const slotCenterX = railXPositions[col] + railSpacing / 2;
          return Array.from({ length: slotsDeep }).map((_, row) => {
            const toteZ = CEIL_TOTE_SLOT_LEN / 2 + row * CEIL_TOTE_SLOT_LEN;
            // Tote hangs from the rail: rim/lip rests ON TOP of plywood ledge
            const rimH = TOTE_RIM_H;
            const bodyH = TOTE_BODY_H;
            // Rim bottom sits on top of rail (Y = CEIL_RAIL_H)
            const rimCenterY = CEIL_RAIL_H + rimH / 2;
            return (
              <group key={`tote-${col}-${row}`} position={[slotCenterX, rimCenterY, toteZ]}>
                {/* Rim/lip resting on top of rail ledges */}
                <mesh position={[0, 0, 0]} castShadow>
                  <boxGeometry args={[toteW, rimH, TOTE_DEPTH * 0.95]} />
                  <meshStandardMaterial color="#f5b800" roughness={0.2} metalness={0.02} />
                </mesh>
                {/* Tote body hanging below rim */}
                <mesh position={[0, -rimH / 2 - bodyH / 2, 0]} castShadow>
                  <boxGeometry args={[toteW * TOTE_BODY_TAPER, bodyH, TOTE_DEPTH * 0.9]} />
                  <meshStandardMaterial color="#2a2a2a" roughness={0.3} metalness={0.0} />
                </mesh>
              </group>
            );
          });
        })}
      </group>
    </group>
  );
}

function OverheadCameraRig({ config }: { config: OverheadConfig3D }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const slotW = getCeilSlotWidth(config.toteType);
  const systemW = (config.slotsWide + 1) * CEIL_RAIL_W + config.slotsWide * slotW;
  const systemD = config.slotsDeep * CEIL_TOTE_SLOT_LEN;
  const totalH = CEIL_NAILER_H + CEIL_PADDING_LAYERS * CEIL_SPACER_H + CEIL_RAIL_H + TOTE_BODY_H + TOTE_RIM_H;

  const sw = systemW * S;
  const sh = totalH * S;
  const sd = systemD * S;
  const maxDim = Math.max(sw, sh, sd);
  const dist = maxDim * 2.4;

  useEffect(() => {
    // View from slightly below to see the hanging totes
    camera.position.set(dist * 0.7, -dist * 0.4, -dist * 0.7);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, dist]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan
      panSpeed={0.5}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 1.5}
      minDistance={0.2}
      maxDistance={dist * 5}
      target={[0, 0, 0]}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RAISED BED PLANTER — 3D Assembly
// Cedar box with corner posts, horizontal slats, optional legs, trim cap
// ═══════════════════════════════════════════════════════════════════════════

const CEDAR_COLOR = "#c87533";
const CEDAR_DARK = "#a0522d";
const SOIL_COLOR = "#3e2723";

const WIRE_COLOR = "#94a3b8";
const FRAME_WIRE_COLOR = "#78716c";

function RaisedBedAssembly({ config }: { config: { widthIn: number; lengthIn: number; heightIn: number; hasLegs: boolean; groundClearance: number; pestCover?: string; finish?: string; hasStringLightPost?: boolean; postHeightIn?: number } }) {
  const { widthIn, lengthIn, heightIn, hasLegs, groundClearance, pestCover, finish, hasStringLightPost, postHeightIn } = config;

  // Color based on finish
  const boardColor = finish === "painted_white" ? "#f5f5f4" : finish === "stain" ? "#8b5e3c" : CEDAR_COLOR;
  const postColor = finish === "painted_white" ? "#e7e5e4" : finish === "stain" ? "#6d4427" : CEDAR_DARK;

  const w = widthIn * S;    // depth (front-to-back)
  const l = lengthIn * S;   // length (left-to-right)
  const boxH = (hasLegs ? heightIn - groundClearance : heightIn) * S; // planter box height
  const legH = hasLegs ? groundClearance * S : 0;
  const postSize = 3.5 * S; // 4×4 corner posts
  const boardT = 0.75 * S;  // board thickness (3/4")
  const trimW = 3.5 * S;    // top trim width
  const trimT = 1.5 * S;    // top trim thickness

  // Number of horizontal boards per wall (each ~5.5" tall like a 1×6)
  const boardFaceH = 5.5 * S;
  const numBoards = Math.max(1, Math.round(boxH / boardFaceH));
  const actualBoardH = boxH / numBoards;
  const gapH = actualBoardH * 0.04; // tiny gap between boards

  return (
    <group position={[0, 0, 0]}>
      {/* ── LEGS (if elevated) ─────────────────────────── */}
      {hasLegs && [
        [-l / 2 + postSize / 2, -w / 2 + postSize / 2],
        [l / 2 - postSize / 2, -w / 2 + postSize / 2],
        [-l / 2 + postSize / 2, w / 2 - postSize / 2],
        [l / 2 - postSize / 2, w / 2 - postSize / 2],
      ].map(([px, pz], i) => (
        <mesh key={`leg-${i}`} position={[px, legH / 2, pz]}>
          <boxGeometry args={[postSize, legH, postSize]} />
          <meshStandardMaterial color={postColor} roughness={0.85} />
        </mesh>
      ))}

      {/* ── CORNER POSTS (run full height of box) ──────── */}
      {[
        [-l / 2 + postSize / 2, -w / 2 + postSize / 2],
        [l / 2 - postSize / 2, -w / 2 + postSize / 2],
        [-l / 2 + postSize / 2, w / 2 - postSize / 2],
        [l / 2 - postSize / 2, w / 2 - postSize / 2],
      ].map(([px, pz], i) => (
        <mesh key={`post-${i}`} position={[px, legH + boxH / 2, pz]}>
          <boxGeometry args={[postSize, boxH, postSize]} />
          <meshStandardMaterial color={postColor} roughness={0.85} />
        </mesh>
      ))}

      {/* ── FRONT & BACK WALLS (horizontal boards along length) ── */}
      {[-1, 1].map((side, si) => {
        const z = side * (w / 2 - boardT / 2);
        return Array.from({ length: numBoards }, (_, j) => {
          const y = legH + actualBoardH * j + actualBoardH / 2;
          return (
            <mesh key={`fb-${si}-${j}`} position={[0, y, z]}>
              <boxGeometry args={[l - postSize * 2, actualBoardH - gapH, boardT]} />
              <meshStandardMaterial color={boardColor} roughness={0.75} />
            </mesh>
          );
        });
      }).flat()}

      {/* ── LEFT & RIGHT WALLS (horizontal boards along width) ── */}
      {[-1, 1].map((side, si) => {
        const x = side * (l / 2 - boardT / 2);
        return Array.from({ length: numBoards }, (_, j) => {
          const y = legH + actualBoardH * j + actualBoardH / 2;
          return (
            <mesh key={`lr-${si}-${j}`} position={[x, y, 0]}>
              <boxGeometry args={[boardT, actualBoardH - gapH, w - postSize * 2]} />
              <meshStandardMaterial color={boardColor} roughness={0.75} />
            </mesh>
          );
        });
      }).flat()}

      {/* ── TOP TRIM (frame around the top edge, NOT solid) ──── */}
      {/* Front & back trim */}
      {[-1, 1].map((side, si) => (
        <mesh key={`trim-fb-${si}`} position={[0, legH + boxH + trimT / 2, side * (w / 2 - trimW / 2)]}>
          <boxGeometry args={[l, trimT, trimW]} />
          <meshStandardMaterial color={postColor} roughness={0.7} />
        </mesh>
      ))}
      {/* Left & right trim */}
      {[-1, 1].map((side, si) => (
        <mesh key={`trim-lr-${si}`} position={[side * (l / 2 - trimW / 2), legH + boxH + trimT / 2, 0]}>
          <boxGeometry args={[trimW, trimT, w - trimW * 2]} />
          <meshStandardMaterial color={postColor} roughness={0.7} />
        </mesh>
      ))}

      {/* ── SOIL (visible from top, inside the box) ────── */}
      <mesh position={[0, legH + boxH * 0.65, 0]}>
        <boxGeometry args={[l - postSize * 2 - boardT * 2, boxH * 0.05, w - postSize * 2 - boardT * 2]} />
        <meshStandardMaterial color={SOIL_COLOR} roughness={1} />
      </mesh>

      {/* ── STRING LIGHT POST (center 4x4, ~7.5' tall) ─── */}
      {/* Post starts at bottom of planter box (where dirt sits)
          and runs up through the box and above */}
      {hasStringLightPost && (() => {
        const centerPostSize = 3.5 * S;
        const ph = (postHeightIn ?? 90) * S;
        // Post base = bottom of the planter box (top of legs)
        const postBaseY = legH;
        // Total post height = from box bottom, through box, through trim, plus the exposed height above
        const totalPostH = boxH + trimT + ph;
        const capSize = 5.5 * S;
        const capH = 1.5 * S;
        return (
          <group>
            {/* 4x4 center post — runs from box bottom through to top */}
            <mesh position={[0, postBaseY + totalPostH / 2, 0]}>
              <boxGeometry args={[centerPostSize, totalPostH, centerPostSize]} />
              <meshStandardMaterial color={postColor} roughness={0.8} />
            </mesh>
            {/* Post cap (dark solar cap at top) */}
            <mesh position={[0, postBaseY + totalPostH + capH / 2, 0]}>
              <boxGeometry args={[capSize, capH, capSize]} />
              <meshStandardMaterial color="#1e293b" roughness={0.3} />
            </mesh>
          </group>
        );
      })()}

      {/* ── PEST PROTECTION CAGE ───────────────────────── */}
      {pestCover && pestCover !== "none" && (() => {
        const topOfBed = legH + boxH + trimT;
        const cageH = pestCover === "cabinet_48" ? 48 * S
          : pestCover === "cabinet_24" ? 24 * S
          : pestCover === "rigid_cage" ? 18 * S
          : 14 * S; // hoop
        const frameT = 1.5 * S;
        const isHoop = pestCover === "hoop";

        return (
          <group position={[0, topOfBed, 0]}>
            {/* Corner uprights */}
            {!isHoop && [
              [-l / 2 + frameT / 2, -w / 2 + frameT / 2],
              [l / 2 - frameT / 2, -w / 2 + frameT / 2],
              [-l / 2 + frameT / 2, w / 2 - frameT / 2],
              [l / 2 - frameT / 2, w / 2 - frameT / 2],
            ].map(([px, pz], i) => (
              <mesh key={`cage-post-${i}`} position={[px, cageH / 2, pz]}>
                <boxGeometry args={[frameT, cageH, frameT]} />
                <meshStandardMaterial color={postColor} roughness={0.8} />
              </mesh>
            ))}

            {/* Top frame */}
            {!isHoop && (
              <>
                {[-1, 1].map((side, i) => (
                  <mesh key={`cage-top-fb-${i}`} position={[0, cageH, side * (w / 2 - frameT / 2)]}>
                    <boxGeometry args={[l, frameT, frameT]} />
                    <meshStandardMaterial color={postColor} roughness={0.8} />
                  </mesh>
                ))}
                {[-1, 1].map((side, i) => (
                  <mesh key={`cage-top-lr-${i}`} position={[side * (l / 2 - frameT / 2), cageH, 0]}>
                    <boxGeometry args={[frameT, frameT, w]} />
                    <meshStandardMaterial color={postColor} roughness={0.8} />
                  </mesh>
                ))}
              </>
            )}

            {/* Wire mesh panels (front, back, left, right) */}
            {!isHoop && [-1, 1].map((side, si) => (
              <mesh key={`cage-wire-fb-${si}`} position={[0, cageH / 2, side * (w / 2 - 0.1 * S)]}>
                <boxGeometry args={[l - frameT * 2, cageH - frameT, 0.2 * S]} />
                <meshStandardMaterial color={WIRE_COLOR} transparent opacity={0.15} roughness={0.5} />
              </mesh>
            ))}
            {!isHoop && [-1, 1].map((side, si) => (
              <mesh key={`cage-wire-lr-${si}`} position={[side * (l / 2 - 0.1 * S), cageH / 2, 0]}>
                <boxGeometry args={[0.2 * S, cageH - frameT, w - frameT * 2]} />
                <meshStandardMaterial color={WIRE_COLOR} transparent opacity={0.15} roughness={0.5} />
              </mesh>
            ))}

            {/* Top mesh/cover */}
            <mesh position={[0, cageH + frameT / 2, 0]}>
              <boxGeometry args={[l - frameT * 2, 0.2 * S, w - frameT * 2]} />
              <meshStandardMaterial color={WIRE_COLOR} transparent opacity={isHoop ? 0.2 : 0.12} roughness={0.5} />
            </mesh>

            {/* Hoop arches — half-circle arches made from thin curved tubes */}
            {isHoop && Array.from({ length: Math.max(3, Math.round(lengthIn / 18)) }, (_, i) => {
              const count = Math.max(3, Math.round(lengthIn / 18));
              const x = -l / 2 + l * (i + 0.5) / count;
              const hoopRadius = w / 2;
              const tubeRadius = 0.5 * S;
              return (
                <mesh key={`hoop-${i}`} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                  <torusGeometry args={[hoopRadius, tubeRadius, 8, 24, Math.PI]} />
                  <meshStandardMaterial color={postColor} roughness={0.7} />
                </mesh>
              );
            })}

            {/* Hoop netting fabric — semi-transparent half-cylinder shell */}
            {isHoop && (
              <mesh position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[w / 2 - 0.5 * S, 0.1 * S, 4, 24, Math.PI]} />
                <meshStandardMaterial color={WIRE_COLOR} transparent opacity={0.08} roughness={0.3} side={2} />
              </mesh>
            )}
          </group>
        );
      })()}
    </group>
  );
}

function RaisedBedCameraRig({ config }: { config: { widthIn: number; lengthIn: number; heightIn: number } }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const rl = config.lengthIn * S;
  const rw = config.widthIn * S;
  const rh = config.heightIn * S;
  const maxDim = Math.max(rl, rw, rh);
  const dist = maxDim * 2.5;

  useEffect(() => {
    camera.position.set(dist * 0.7, dist * 0.5, dist * 0.7);
    camera.lookAt(0, rh / 2, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, rh / 2, 0);
      controlsRef.current.update();
    }
  }, [camera, dist, rh]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      autoRotate
      autoRotateSpeed={0.4}
      enablePan
      panSpeed={0.5}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 1.5}
      minDistance={0.2}
      maxDistance={dist * 5}
      target={[0, rh / 2, 0]}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/** Compute the overall height (in inches) of a multi-unit item for positioning */
function computeItemOverallH(item: MultiUnit3DItem): number {
  // Overhead ceiling rail — total drop is small; height is the assembly drop
  if (item.overheadConfig) {
    const totalDrop = CEIL_NAILER_H + CEIL_PADDING_LAYERS * CEIL_SPACER_H + CEIL_RAIL_H + TOTE_BODY_H + TOTE_RIM_H;
    return totalDrop;
  }
  // Raised bed planter (include string light post height if present)
  if (item.raisedBedConfig) {
    let h = item.raisedBedConfig.heightIn;
    if (item.raisedBedConfig.hasStringLightPost) h += (item.raisedBedConfig.postHeightIn ?? 90);
    return h;
  }
  // Open shelving unit — use its frameH directly
  if (item.shelvingConfig) {
    return item.shelvingConfig.frameH;
  }
  // Compound preset — use the tallest sub-unit
  if (item.presetUnits && item.presetUnits.length > 0) {
    const isMini = item.unitType === "mini";
    const tierSpacing = getTierSpacing(item.unitType);
    const firstRailY = getFirstRailY(item.unitType);
    return Math.max(...item.presetUnits.map((unit) => {
      const lastRailY = firstRailY + (unit.rows - 1) * tierSpacing;
      const frameH = isMini
        ? PLATE_H + lastRailY + 2 + PLY_TOP_H
        : PLATE_H + lastRailY + 3 + PLATE_H;
      const lift = unit.hasWheels ? CASTER_HEIGHT : 0;
      return frameH + lift;
    }));
  }
  // Simple unit
  const isMini = item.unitType === "mini";
  const tierSpacing = getTierSpacing(item.unitType);
  const firstRailY = getFirstRailY(item.unitType);
  const lastRailY = firstRailY + (item.rows - 1) * tierSpacing;
  const frameH = isMini
    ? PLATE_H + lastRailY + 2 + PLY_TOP_H
    : PLATE_H + lastRailY + 3 + PLATE_H;
  const lift = item.hasWheels ? CASTER_HEIGHT : 0;
  return frameH + lift;
}

/** Multi-unit camera rig — positions camera to see all units */
function MultiUnitCameraRig({ items }: { items: MultiUnit3DItem[] }) {
  const totalW = items.reduce((sum, it) => sum + it.totalW, 0) + (items.length - 1) * 6; // 6" gap
  const heights = items.map((it) => computeItemOverallH(it));
  const hasOverhead = items.some((it) => !!it.overheadConfig);
  const maxGroundH = Math.max(...items.map((it, i) => it.overheadConfig ? 0 : heights[i]), 1);
  // If overhead present, total scene height includes ceiling gap + overhead assembly
  const overheadH = hasOverhead ? Math.max(...items.map((it, i) => it.overheadConfig ? heights[i] : 0)) : 0;
  const sceneH = hasOverhead ? maxGroundH + 24 + overheadH : maxGroundH;
  const w = totalW * S;
  const h = sceneH * S;
  const dist = Math.max(w, h) * 1.8 + 1;

  return (
    <OrbitControls
      autoRotate
      autoRotateSpeed={0.5}
      enablePan
      panSpeed={0.5}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 1.5}
      minDistance={0.2}
      maxDistance={dist * 5}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

/** Multi-unit assembly — renders each visible unit side-by-side */
function MultiUnitAssembly({ items, drawersOpen }: { items: MultiUnit3DItem[]; drawersOpen?: boolean }) {
  const GAP = 6; // 6" gap between units

  // Compute height for each item and find the tallest ground-level unit
  const heights = items.map((it) => computeItemOverallH(it));
  const groundHeights = items.map((it, i) => it.overheadConfig ? 0 : heights[i]);
  const maxGroundH = Math.max(...groundHeights, 1);

  // Ceiling height: tallest ground unit + 24" gap above it
  const CEILING_GAP = 24; // gap between top of tallest unit and ceiling rail bottom
  const ceilingBaseY = maxGroundH + CEILING_GAP;

  // Calculate total width to center the group
  const totalW = items.reduce((sum, it) => sum + it.totalW, 0) + (items.length - 1) * GAP;
  let offsetX = -totalW / 2;

  return (
    <group>
      {items.map((item, i) => {
        const x = (offsetX + item.totalW / 2) * S;
        let y: number;
        if (item.overheadConfig) {
          // Overhead unit: position at ceiling level (above all ground units)
          y = (ceilingBaseY + heights[i] / 2) * S;
        } else {
          // Ground units: align bottoms to the tallest ground unit
          y = (heights[i] - maxGroundH) / 2 * S;
        }
        offsetX += item.totalW + GAP;
        return (
          <group key={i} position={[x, y, 0]}>
            {item.overheadConfig ? (
              <OverheadAssembly config={item.overheadConfig} />
            ) : item.raisedBedConfig ? (
              <RaisedBedAssembly config={item.raisedBedConfig} />
            ) : item.shelvingConfig ? (
              <ShelvingAssembly config={item.shelvingConfig} />
            ) : item.presetUnits && item.presetUnits.length > 0 ? (
              <CompoundRackAssembly
                presetUnits={item.presetUnits}
                toteType={item.toteType}
                toteColor={item.toteColor}
                unitType={item.unitType}
                orientation={item.orientation}
                hasTotes={item.hasTotes}
                drawerSlideRows={item.drawerSlideRows}
                drawerSlideColumns={item.drawerSlideColumns}
                drawersOpen={drawersOpen}
              />
            ) : (
              <RackAssembly
                cols={item.cols}
                rows={item.rows}
                toteType={item.toteType}
                toteColor={item.toteColor}
                unitType={item.unitType}
                orientation={item.orientation}
                hasTotes={item.hasTotes}
                hasWheels={item.hasWheels}
                hasTop={item.hasTop}
                addons={item.addons}
                paintFrameColor={item.paintFrameColor}
                paintDoorColor={item.paintDoorColor}
                paintSidePanelColor={item.paintSidePanelColor}
                drawerSlideRows={item.drawerSlideRows}
                drawerSlideColumns={item.drawerSlideColumns}
                drawersOpen={drawersOpen}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

/**
 * Invisible R3F component that restores procedural textures when the
 * browser tab becomes visible again. Browsers may GC detached canvas
 * pixel buffers during inactivity, turning all wood textures black.
 */
function TextureGuard() {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        restoreAllTextures();
        invalidate();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [gl, invalidate]);
  return null;
}

export default function Rack3D(props: Rack3DProps) {
  // Dispose textures and cached materials when the 3D canvas unmounts
  // to free GPU memory and prevent leaks on SPA navigation.
  useEffect(() => {
    return () => {
      disposeAllTextures();
      // Dispose all cached tote/slide materials
      _matCache.forEach((mat) => mat.dispose());
      _matCache.clear();
    };
  }, []);

  const isMultiUnit = props.multiUnitItems && props.multiUnitItems.length > 0;
  const isOverhead = !!props.overheadConfig;
  const isRaisedBed = !!props.raisedBedConfig;
  const isCompound = props.presetUnits && props.presetUnits.length > 0;
  const isShelving = !!props.shelvingConfig;
  const wmText = props.watermarkText || "Storage-Network.app";

  return (
    <div className="absolute inset-0" style={{ touchAction: "none" }}>
      {/* Watermark overlay — behind 3D canvas interaction via pointer-events:none */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            transform: "rotate(-30deg)",
            fontSize: "clamp(24px, 8vw, 72px)",
            fontWeight: "bold",
            fontFamily: "Arial, sans-serif",
            color: "rgba(0,0,0,0.03)",
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          {wmText}
        </span>
      </div>
      <Canvas
        shadows
        camera={{ fov: 45 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          const domEl = gl.domElement;
          domEl.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
          });
          domEl.addEventListener("webglcontextrestored", () => {
            restoreAllTextures();
          });
        }}
      >
        <TextureGuard />
        <ambientLight intensity={0.7} />
        {/* Key light — strong top-right, casts primary shadows */}
        <directionalLight
          position={[12, 18, 12]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
          shadow-bias={-0.0002}
        />
        {/* Fill light — front-below to illuminate tote bodies hanging under rails */}
        <directionalLight position={[6, 2, 14]} intensity={0.7} />
        {/* Back fill — separates silhouettes from background */}
        <directionalLight position={[-10, 12, -8]} intensity={0.5} />
        {/* Rim/accent light — adds specular edge highlights on glossy plastic */}
        <directionalLight position={[0, 8, -14]} intensity={0.4} />
        {/* Sky/ground color split — warm wood tones + cool shadow fill */}
        <hemisphereLight args={["#fffaf0", "#e8dcc8", 0.55]} />

        <ContactShadows
          position={[0, -0.001, 0]}
          opacity={0.35}
          scale={12}
          blur={2}
          far={5}
          color="#333333"
        />

        {isMultiUnit ? (
          <>
            <MultiUnitCameraRig items={props.multiUnitItems!} />
            <Stage intensity={0.8} environment={null} adjustCamera={false}>
              <MultiUnitAssembly items={props.multiUnitItems!} drawersOpen={props.drawersOpen} />
            </Stage>
          </>
        ) : isOverhead ? (
          <>
            <OverheadCameraRig config={props.overheadConfig!} />
            <Stage intensity={0.8} environment={null} adjustCamera={false}>
              <OverheadAssembly config={props.overheadConfig!} />
            </Stage>
          </>
        ) : isRaisedBed ? (
          <>
            <RaisedBedCameraRig config={props.raisedBedConfig!} />
            <Stage intensity={0.8} environment={null} adjustCamera={false}>
              <RaisedBedAssembly config={props.raisedBedConfig!} />
            </Stage>
          </>
        ) : isShelving ? (
          <>
            <ShelvingCameraRig config={props.shelvingConfig!} />
            <Stage intensity={0.8} environment={null} adjustCamera={false}>
              <ShelvingAssembly config={props.shelvingConfig!} />
            </Stage>
          </>
        ) : isCompound ? (
          <>
            <CompoundCameraRig
              presetUnits={props.presetUnits!}
              toteType={props.toteType}
              unitType={props.unitType}
              orientation={props.orientation}
              use2x4Rails={props.use2x4Rails}
            />
            <Stage intensity={0.8} environment={null} adjustCamera={false}>
              <CompoundRackAssembly
                presetUnits={props.presetUnits!}
                toteType={props.toteType}
                toteColor={props.toteColor}
                unitType={props.unitType}
                orientation={props.orientation}
                hasTotes={props.hasTotes}
                use2x4Rails={props.use2x4Rails}
                drawerSlideRows={props.drawerSlideRows}
                drawerSlideColumns={props.drawerSlideColumns}
                drawersOpen={props.drawersOpen}
              />
            </Stage>
          </>
        ) : (
          <>
            <CameraRig
              cols={props.cols}
              rows={props.rows}
              toteType={props.toteType}
              unitType={props.unitType}
              orientation={props.orientation}
              hasWheels={props.hasWheels}
              use2x4Rails={props.use2x4Rails}
            />
            <Stage intensity={0.8} environment={null} adjustCamera={false}>
              <RackAssembly {...props} />
            </Stage>
          </>
        )}
      </Canvas>
    </div>
  );
}
