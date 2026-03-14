"use client";

import { useMemo, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Stage } from "@react-three/drei";
import { BufferGeometry, BufferAttribute, DoubleSide } from "three";
import IndustrialCaster, { CASTER_HEIGHT } from "./IndustrialCaster";
import { createDougFirMaterial, createPlywoodMaterial, createPlywoodTopMaterial, createPaintedMaterial } from "./woodTextures";
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
  /** Multi-unit mode: renders multiple finished units side-by-side */
  multiUnitItems?: MultiUnit3DItem[];
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
const TOTE_BODY_TAPER = 0.85;
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

  // Color logic
  const rimColor = isMini ? "#fbbf24" : (toteType === "HDX" ? "#fbbf24" : "#fbbf24");
  const rimDarkColor = isMini ? "#d4a017" : (toteType === "HDX" ? "#d4a017" : "#d4a017");
  const bodyColor = (isMini || isClear) ? "#d4d4d8" : "#1a1a1a";
  const bodyRibColor = (isMini || isClear) ? "#c0c0c4" : "#222222";
  const bodyOpacity = (isMini || isClear) ? 0.7 : 1.0;

  const rimW = toteW;
  const bodyTopW = bayW - BIN_GAP * 2;
  const bodyBotW = bodyTopW * (isMini ? 0.92 : TOTE_BODY_TAPER);
  const bodyTopD = toteDepth * 0.95;
  const bodyBotD = toteDepth * 0.82;
  const rimD = toteDepth;

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
      <mesh geometry={bodyGeo} castShadow>
        <meshStandardMaterial
          color={bodyColor}
          roughness={(isMini || isClear) ? 0.3 : 0.35}
          metalness={(isMini || isClear) ? 0.02 : 0.05}
          transparent={isMini || isClear}
          opacity={bodyOpacity}
          side={DoubleSide}
        />
      </mesh>

      {/* ── Vertical ribs on body faces ──────────────────────────────── */}
      {ribs.map((rib, i) => (
        <mesh key={`rib-${i}`} position={rib.pos}>
          <boxGeometry args={rib.size} />
          <meshStandardMaterial
            color={bodyRibColor}
            roughness={0.4}
            metalness={0.03}
            transparent={isMini || isClear}
            opacity={bodyOpacity}
          />
        </mesh>
      ))}

      {/* ── Bottom rim (thick lip at body top) ───────────────────────── */}
      <mesh position={[0, toteBodyH - 0.25, 0]}>
        <boxGeometry args={[bodyTopW + 0.3, 0.5, bodyTopD + 0.3]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.3}
          metalness={0.04}
          transparent={isMini || isClear}
          opacity={bodyOpacity}
        />
      </mesh>

      {/* ── Lid base (overhangs body with lip) ───────────────────────── */}
      <mesh position={[0, toteBodyH + toteRimH / 2, 0]} castShadow>
        <boxGeometry args={[rimW + (isMini ? 0 : LID_LIP), toteRimH, rimD + (isMini ? 0 : LID_LIP)]} />
        <meshStandardMaterial color={rimColor} roughness={0.25} metalness={0.06} />
      </mesh>

      {/* ── Lid top surface (slightly inset, forms the tray) ─────────── */}
      <mesh position={[0, toteBodyH + toteRimH + 0.06, 0]}>
        <boxGeometry args={[rimW - 0.8, 0.12, rimD - 0.8]} />
        <meshStandardMaterial color={rimDarkColor} roughness={0.35} metalness={0.04} />
      </mesh>

      {/* ── Lid grid pattern (rectangular cross-hatch) ─────────────── */}
      {!isMini && lidGrid.map((line, i) => (
        <mesh key={`grid-${i}`} position={line.pos}>
          <boxGeometry args={line.size} />
          <meshStandardMaterial color={rimDarkColor} roughness={0.3} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

// ── Hinge Material ──────────────────────────────────────────────────────
import { MeshStandardMaterial, Color } from "three";

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
  paintFrameColor, paintDoorColor, paintSidePanelColor,
}: Rack3DProps) {
  const isMini = unitType === "mini";

  // Resolve paint materials (null = use default wood texture)
  const frameMat = getPaintMaterial(paintFrameColor) ?? undefined;
  const doorMat = getPaintMaterial(paintDoorColor) ?? undefined;
  const sidePanelMat = getPaintMaterial(paintSidePanelColor) ?? undefined;
  // Rails are part of the frame, so they get frame paint
  const railMat = frameMat;
  const bayW = getBayWidth(toteType, unitType, orientation);
  const totalW = cols * bayW + (cols + 1) * POST_W;

  // Get unit-specific values
  const unitDepth = getUnitDepth(unitType, orientation);
  const railHeight = getRailHeight(unitType);
  const tierSpacing = getTierSpacing(unitType);
  const firstRailY = getFirstRailY(unitType);

  const lastRailY = firstRailY + (rows - 1) * tierSpacing;

  // Frame height calculation differs for Mini (no top plates)
  let frameH: number;
  if (isMini) {
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

  // Post height differs for Mini (no top 2x4 plates)
  const postH = isMini
    ? lastRailY + 2 // Just past the top rail
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

          {/* Top plates — only for Standard units */}
          {!isMini && (
            <>
              <Lumber position={[totalW / 2, frameH - PLATE_H / 2, POST_D / 2]} size={[totalW, PLATE_H, POST_D]} material={frameMat} />
              <Lumber position={[totalW / 2, frameH - PLATE_H / 2, unitDepth - POST_D / 2]} size={[totalW, PLATE_H, POST_D]} material={frameMat} />
            </>
          )}

          {/* Ladder frames: posts + rails */}
          {Array.from({ length: cols + 1 }).map((_, i) => {
            const px = getPostX(i, bayW);
            return (
              <group key={`ladder-${i}`}>
                {/* Front + Back posts */}
                <Lumber position={[px, PLATE_H + postH / 2, POST_D / 2]} size={[POST_W, postH, POST_D]} material={frameMat} />
                <Lumber position={[px, PLATE_H + postH / 2, unitDepth - POST_D / 2]} size={[POST_W, postH, POST_D]} material={frameMat} />

                {/* Right-face rails (serve bay i) — skip if rail_removed addon */}
                {i < cols && Array.from({ length: rows }).map((_, r) => {
                  const isRailRemoved = addons?.some(
                    (a) => a.type === "rail_removed" && a.target === i && (a.row === undefined || a.row === r)
                  );
                  if (isRailRemoved) return null;
                  const railY = PLATE_H + firstRailY + r * tierSpacing;
                  const railX = px + POST_W / 2 + RAIL_THICKNESS / 2;
                  return (
                    <PlywoodStrip
                      key={`rr-${i}-${r}`}
                      position={[railX, railY, unitDepth / 2]}
                      length={railLen}
                      railHeight={railHeight}
                      material={railMat}
                    />
                  );
                })}

                {/* Left-face rails (serve bay i-1) — skip if rail_removed addon */}
                {i > 0 && Array.from({ length: rows }).map((_, r) => {
                  const isRailRemoved = addons?.some(
                    (a) => a.type === "rail_removed" && a.target === (i - 1) && (a.row === undefined || a.row === r)
                  );
                  if (isRailRemoved) return null;
                  const railY = PLATE_H + firstRailY + r * tierSpacing;
                  const railX = px - POST_W / 2 - RAIL_THICKNESS / 2;
                  return (
                    <PlywoodStrip
                      key={`rl-${i}-${r}`}
                      position={[railX, railY, unitDepth / 2]}
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
            const leftPostX = getPostX(c, bayW);
            const rightPostX = getPostX(c + 1, bayW);
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

              const railCenterY = PLATE_H + firstRailY + r * tierSpacing;
              const railTop = railCenterY + railHeight / 2;
              // Rim bottom = rail top → body bottom = rail top - toteBodyH
              const toteGroupY = railTop - toteBodyH;

              return (
                <Tote
                  key={`tote-${c}-${r}`}
                  position={[bayCenterX, toteGroupY, unitDepth / 2]}
                  bayW={bayW}
                  toteType={toteType}
                  toteColor={toteColor}
                  unitType={unitType}
                  orientation={orientation}
                  unitDepth={unitDepth}
                />
              );
            });
          })}

          {/* Shelves — 3/4" plywood sitting on top of rails */}
          {addons && addons.filter((a) => a.type === "shelf").map((addon) => {
            const col = addon.target as number;
            const row = addon.row ?? 0;
            const leftPostX = getPostX(col, bayW);
            const rightPostX = getPostX(col + 1, bayW);
            const shelfCenterX = (leftPostX + rightPostX) / 2;
            const railCenterY = PLATE_H + firstRailY + row * tierSpacing;
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
                  const leftPostX = getPostX(col, bayW);
                  const rightPostX = getPostX(col + 1, bayW);
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
          const firstPostX = getPostX(0, bayW);
          const lastPostX = getPostX(cols, bayW);
          return (
            <>
              <IndustrialCaster position={[firstPostX, 0, POST_D / 2]} />
              <IndustrialCaster position={[lastPostX, 0, POST_D / 2]} />
              <IndustrialCaster position={[firstPostX, 0, unitDepth - POST_D / 2]} />
              <IndustrialCaster position={[lastPostX, 0, unitDepth - POST_D / 2]} />
            </>
          );
        })()}
      </group>
    </group>
  );
}

// ── Camera rig ───────────────────────────────────────────────────────────

function CameraRig({ cols, rows, toteType, unitType, orientation, hasWheels }: Pick<Rack3DProps, "cols" | "rows" | "toteType" | "unitType" | "orientation" | "hasWheels">) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const isMini = unitType === "mini";
  const bayW = getBayWidth(toteType, unitType, orientation);
  const totalW = cols * bayW + (cols + 1) * POST_W;
  const unitDepth = getUnitDepth(unitType, orientation);
  const tierSpacing = getTierSpacing(unitType);
  const firstRailY = getFirstRailY(unitType);

  const lastRailY = firstRailY + (rows - 1) * tierSpacing;

  let frameH: number;
  if (isMini) {
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

function CompoundRackAssembly({ presetUnits, toteType, toteColor, unitType, orientation, hasTotes }: {
  presetUnits: SubUnit3D[];
  toteType: ToteType;
  toteColor: ToteColor;
  unitType: UnitType;
  orientation: Orientation;
  hasTotes: boolean;
}) {
  const isMini = unitType === "mini";
  const bayW = getBayWidth(toteType, unitType, orientation);
  const tierSpacing = getTierSpacing(unitType);
  const firstRailY = getFirstRailY(unitType);
  const GAP_INCHES = 1; // 1" gap between sub-units

  // Calculate overallH for each sub-unit and find the tallest
  const unitHeights = presetUnits.map((unit) => {
    const lastRailY = firstRailY + (unit.rows - 1) * tierSpacing;
    const frameH = isMini
      ? PLATE_H + lastRailY + 2 + PLY_TOP_H
      : PLATE_H + lastRailY + 3 + PLATE_H;
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
        // Bottom-align: RackAssembly centers each unit at y=0 using cy=overallH/2.
        // Shift shorter units DOWN so all bottoms sit at -maxH/2.
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
              />
            </group>
          </group>
        );
      })}
    </group>
  );
}

// ── Compound Camera Rig ─────────────────────────────────────────────────

function CompoundCameraRig({ presetUnits, toteType, unitType, orientation }: {
  presetUnits: SubUnit3D[];
  toteType: ToteType;
  unitType: UnitType;
  orientation: Orientation;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const bayW = getBayWidth(toteType, unitType, orientation);
  const unitDepth = getUnitDepth(unitType, orientation);
  const GAP_INCHES = 1;

  let totalW = 0;
  let maxH = 0;
  for (const unit of presetUnits) {
    totalW += unit.cols * bayW + (unit.cols + 1) * POST_W + GAP_INCHES;
    const tierSpacing = getTierSpacing(unitType);
    const firstRailY = getFirstRailY(unitType);
    const lastRailY = firstRailY + (unit.rows - 1) * tierSpacing;
    const fH = unitType === "mini"
      ? PLATE_H + lastRailY + 2 + PLY_TOP_H
      : PLATE_H + lastRailY + 3 + PLATE_H;
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
// Ceiling Tote Rail System — 3-layer: nailer → padding → plywood rail
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
                  <meshStandardMaterial color="#fbbf24" roughness={0.3} />
                </mesh>
                {/* Tote body hanging below rim */}
                <mesh position={[0, -rimH / 2 - bodyH / 2, 0]} castShadow>
                  <boxGeometry args={[toteW * TOTE_BODY_TAPER, bodyH, TOTE_DEPTH * 0.9]} />
                  <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
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
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/** Compute the overall height (in inches) of a multi-unit item for positioning */
function computeItemOverallH(item: MultiUnit3DItem): number {
  // Overhead ceiling rail — total drop is small; height is the assembly drop
  if (item.overheadConfig) {
    const totalDrop = CEIL_NAILER_H + CEIL_PADDING_LAYERS * CEIL_SPACER_H + CEIL_RAIL_H + TOTE_BODY_H + TOTE_RIM_H;
    return totalDrop;
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
function MultiUnitAssembly({ items }: { items: MultiUnit3DItem[] }) {
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
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

export default function Rack3D(props: Rack3DProps) {
  const isMultiUnit = props.multiUnitItems && props.multiUnitItems.length > 0;
  const isOverhead = !!props.overheadConfig;
  const isCompound = props.presetUnits && props.presetUnits.length > 0;
  const isShelving = !!props.shelvingConfig;

  return (
    <div className="absolute inset-0" style={{ touchAction: "none" }}>
      <Canvas
        shadows
        camera={{ fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >

        <ambientLight intensity={0.85} />
        <directionalLight
          position={[12, 18, 12]}
          intensity={1.0}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
          shadow-bias={-0.0002}
        />
        <directionalLight position={[-10, 12, -8]} intensity={0.5} />
        <directionalLight position={[0, 6, -12]} intensity={0.3} />
        <hemisphereLight args={["#ffffff", "#f5ead6", 0.5]} />

        <ContactShadows
          position={[0, -0.001, 0]}
          opacity={0.2}
          scale={10}
          blur={2.5}
          far={4}
          color="#444444"
        />

        {isMultiUnit ? (
          <>
            <MultiUnitCameraRig items={props.multiUnitItems!} />
            <Stage intensity={0.6} environment={null} adjustCamera={false}>
              <MultiUnitAssembly items={props.multiUnitItems!} />
            </Stage>
          </>
        ) : isOverhead ? (
          <>
            <OverheadCameraRig config={props.overheadConfig!} />
            <Stage intensity={0.6} environment={null} adjustCamera={false}>
              <OverheadAssembly config={props.overheadConfig!} />
            </Stage>
          </>
        ) : isShelving ? (
          <>
            <ShelvingCameraRig config={props.shelvingConfig!} />
            <Stage intensity={0.6} environment={null} adjustCamera={false}>
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
            />
            <Stage intensity={0.6} environment={null} adjustCamera={false}>
              <CompoundRackAssembly
                presetUnits={props.presetUnits!}
                toteType={props.toteType}
                toteColor={props.toteColor}
                unitType={props.unitType}
                orientation={props.orientation}
                hasTotes={props.hasTotes}
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
            />
            <Stage intensity={0.6} environment={null} adjustCamera={false}>
              <RackAssembly {...props} />
            </Stage>
          </>
        )}
      </Canvas>
    </div>
  );
}
