"use client";

import { useMemo, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Stage } from "@react-three/drei";
import { MeshStandardMaterial, Color, BufferGeometry, BufferAttribute, DoubleSide } from "three";
import IndustrialCaster, { CASTER_HEIGHT } from "./IndustrialCaster";

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

type ToteType = "HDX" | "GM";
type ToteColor = "black" | "clear";
type UnitType = "standard" | "mini";
type Orientation = "standard" | "sideways";

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
// Uniform pine color — no canvas texture to avoid UV split artifacts.

const PINE_MAT = (() => {
  const mat = new MeshStandardMaterial({
    color: new Color("#C8A96E"),
    roughness: 0.82,
    metalness: 0.0,
  });
  return mat;
})();

const PLYWOOD_MAT = (() => {
  return new MeshStandardMaterial({
    color: new Color("#A8884E"),
    roughness: 0.6,
    metalness: 0.0,
  });
})();

function Lumber({ position, size }: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh position={position} material={PINE_MAT} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function PlywoodStrip({ position, length, railHeight }: {
  position: [number, number, number];
  length: number;
  railHeight?: number;
}) {
  const height = railHeight ?? RAIL_HEIGHT;
  return (
    <mesh position={position} material={PLYWOOD_MAT} castShadow receiveShadow>
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
  const rimColor = isMini ? "#fbbf24" : (toteType === "HDX" ? "#fbbf24" : "#ef4444");
  const rimDarkColor = isMini ? "#d4a017" : (toteType === "HDX" ? "#d4a017" : "#c0392b");
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

// ── Rack Assembly ────────────────────────────────────────────────────────

function RackAssembly({
  cols, rows, toteType, toteColor, unitType, orientation, hasTotes, hasWheels, hasTop,
}: Rack3DProps) {
  const isMini = unitType === "mini";
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
      <group position={[-cx, -cy, -cz]}>

        {/* ── WOOD FRAME — lifted by caster height ── */}
        <group position={[0, lift, 0]}>

          {/* Bottom plates (same for both unit types) */}
          <Lumber position={[totalW / 2, PLATE_H / 2, POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />
          <Lumber position={[totalW / 2, PLATE_H / 2, unitDepth - POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />

          {/* Top plates — only for Standard units */}
          {!isMini && (
            <>
              <Lumber position={[totalW / 2, frameH - PLATE_H / 2, POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />
              <Lumber position={[totalW / 2, frameH - PLATE_H / 2, unitDepth - POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />
            </>
          )}

          {/* Ladder frames: posts + rails */}
          {Array.from({ length: cols + 1 }).map((_, i) => {
            const px = getPostX(i, bayW);
            return (
              <group key={`ladder-${i}`}>
                {/* Front + Back posts */}
                <Lumber position={[px, PLATE_H + postH / 2, POST_D / 2]} size={[POST_W, postH, POST_D]} />
                <Lumber position={[px, PLATE_H + postH / 2, unitDepth - POST_D / 2]} size={[POST_W, postH, POST_D]} />

                {/* Right-face rails (serve bay i) */}
                {i < cols && Array.from({ length: rows }).map((_, r) => {
                  const railY = PLATE_H + firstRailY + r * tierSpacing;
                  const railX = px + POST_W / 2 + RAIL_THICKNESS / 2;
                  return (
                    <PlywoodStrip
                      key={`rr-${i}-${r}`}
                      position={[railX, railY, unitDepth / 2]}
                      length={railLen}
                      railHeight={railHeight}
                    />
                  );
                })}

                {/* Left-face rails (serve bay i-1) */}
                {i > 0 && Array.from({ length: rows }).map((_, r) => {
                  const railY = PLATE_H + firstRailY + r * tierSpacing;
                  const railX = px - POST_W / 2 - RAIL_THICKNESS / 2;
                  return (
                    <PlywoodStrip
                      key={`rl-${i}-${r}`}
                      position={[railX, railY, unitDepth / 2]}
                      length={railLen}
                      railHeight={railHeight}
                    />
                  );
                })}
              </group>
            );
          })}

          {/* Totes — rim ON TOP of rail, body hangs BELOW */}
          {hasTotes && Array.from({ length: cols }).map((_, c) => {
            const leftPostX = getPostX(c, bayW);
            const rightPostX = getPostX(c + 1, bayW);
            const bayCenterX = (leftPostX + rightPostX) / 2;

            return Array.from({ length: rows }).map((_, r) => {
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

          {/* Plywood top — mandatory for Mini, optional for Standard */}
          {hasTop && (
            <mesh
              position={[
                totalW / 2,
                // Mini: plywood sits directly on posts (postH + PLATE_H + half of plywood thickness)
                // Standard: plywood sits on top of top 2x4 plate (frameH + half of plywood thickness)
                isMini
                  ? PLATE_H + postH + PLY_TOP_H / 2
                  : frameH + PLY_TOP_H / 2,
                unitDepth / 2
              ]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[totalW + 2, PLY_TOP_H, unitDepth + 2]} />
              <meshStandardMaterial color="#D4B896" roughness={0.6} metalness={0.0} />
            </mesh>
          )}
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
    camera.position.set(dist * 0.6, dist * 0.6, dist * 0.6);
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
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default function Rack3D(props: Rack3DProps) {
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

        <CameraRig
          cols={props.cols}
          rows={props.rows}
          toteType={props.toteType}
          unitType={props.unitType}
          orientation={props.orientation}
          hasWheels={props.hasWheels}
        />

        <Stage intensity={0.6} environment="city" adjustCamera={false}>
          <RackAssembly {...props} />
        </Stage>
      </Canvas>
    </div>
  );
}
