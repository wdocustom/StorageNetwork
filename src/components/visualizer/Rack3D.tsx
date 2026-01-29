"use client";

import { useMemo, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import IndustrialCaster, { CASTER_HEIGHT } from "./IndustrialCaster";

// ═══════════════════════════════════════════════════════════════════════════
// Rack3D — Precise CAD Blueprint (Rim-Glider System)
//
// CONSTRUCTION ORDER:
//   1. Place Ladder Frames (vertical posts front+back at each column line)
//   2. Attach Plywood Rails to SIDE FACES of posts (not between them)
//   3. Hang Totes: yellow rim ON TOP of rail, black body BELOW
//   4. Bottom/Top plates span full width
//   5. Industrial Casters under each post pair
//
// COORDINATE SYSTEM (inches, pre-scale):
//   Origin = front-left corner at floor level
//   +X = width (left to right)
//   +Y = height (floor to ceiling)
//   +Z = depth (front to back)
//
// The entire assembly is then scaled by S and centered.
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";

interface Rack3DProps {
  cols: number;
  rows: number;
  toteType: ToteType;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  1. THE DEFINITIONS (CONSTANTS) — All in inches                     ║
// ╚═══════════════════════════════════════════════════════════════════════╝

const POST_W = 1.5;            // 2×4 actual width (narrow face)
const POST_D = 3.5;            // 2×4 actual depth (wide face)
const RAIL_THICKNESS = 0.75;   // 3/4" plywood strip thickness
const RAIL_HEIGHT = 1.75;      // Plywood strip height (visible face)
const BIN_LIP_WIDTH = 1.0;     // How much tote rim overhangs each rail
const BIN_GAP = 0.25;          // Tolerance gap between rim and post

const PLATE_H = 1.5;           // Bottom/top plate thickness (2×4 flat)
const RACK_DEPTH = 30;         // Front-to-back total depth
const TIER_SPACING = 16;       // Center-to-center between tier rails
const PLY_TOP_H = 0.75;        // Plywood top sheet thickness

// Tote geometry
const TOTE_FULL_W_HDX = 19.75; // HDX tote rim-to-rim width
const TOTE_FULL_W_GM = 20.75;  // Greenmade tote rim-to-rim width
const TOTE_RIM_H = 1.0;        // Yellow rim strip height
const TOTE_BODY_H = 11.0;      // Black body height below rim
const TOTE_BODY_TAPER = 0.85;  // Bottom width = top width * taper

// Scene scale: inches → Three.js scene units
const S = 0.02;

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  2. DERIVED GEOMETRY — The "Skeleton" Math                          ║
// ╚═══════════════════════════════════════════════════════════════════════╝
//
// BAY WIDTH: Posts must be CLOSER together than the tote, so the rim
// can rest on the rails while the body hangs inside.
//
//   Bay_W = Tote_W - (2 × BIN_LIP_WIDTH) + (2 × BIN_GAP)
//         = 19.75 - 2.0 + 0.5 = 18.25  (for HDX)
//
// POST X POSITIONS: Post center at x = i * (Bay_W + POST_W) + POST_W/2
//
// RAIL X POSITIONS:
//   Left rail of bay i  → right face of post i  → x = postX + POST_W/2 + RAIL_THICKNESS/2
//   Right rail of bay i → left face of post i+1 → x = postX+1 - POST_W/2 - RAIL_THICKNESS/2
//
// TOTE Y POSITION:
//   Rim top sits on rail top → rim center = railY + RAIL_HEIGHT/2 + TOTE_RIM_H/2
//   Body hangs below rim    → body top = rim bottom = railY + RAIL_HEIGHT/2
//   Body center = railY + RAIL_HEIGHT/2 - TOTE_BODY_H/2
//
// BOTTOM RAIL CLEARANCE (when casters present):
//   Tote bottom = railY + RAIL_HEIGHT/2 - TOTE_BODY_H
//   Must be > 0 (relative to bottom plate) with 2" safety
//   → railY > TOTE_BODY_H - RAIL_HEIGHT/2 + 2

function getBayWidth(toteType: ToteType): number {
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  return toteW - 2 * BIN_LIP_WIDTH + 2 * BIN_GAP;
}

function getPostX(i: number, bayW: number): number {
  return i * (bayW + POST_W) + POST_W / 2;
}

// Minimum distance from bottom plate top to first rail center
const MIN_FIRST_RAIL_Y = TOTE_BODY_H - RAIL_HEIGHT / 2 + 2; // ~12.125"

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  MATERIALS                                                           ║
// ╚═══════════════════════════════════════════════════════════════════════╝

function usePineMat() {
  return useMemo(() => {
    if (typeof document === "undefined") {
      return new THREE.MeshStandardMaterial({
        color: "#C8A96E",
        roughness: 0.85,
        metalness: 0.0,
      });
    }

    // Procedural pine grain
    const cw = 64, ch = 256;
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;

    // Base
    ctx.fillStyle = "#C8A96E";
    ctx.fillRect(0, 0, cw, ch);

    // Grain lines
    for (let i = 0; i < 50; i++) {
      const y0 = (i / 50) * ch + (Math.random() - 0.5) * 8;
      ctx.strokeStyle = `rgba(130, 85, 40, ${0.05 + Math.random() * 0.12})`;
      ctx.lineWidth = 0.3 + Math.random() * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= cw; x += 3) {
        ctx.lineTo(x, y0 + Math.sin(x * 0.06 + i * 0.7) * 1.8);
      }
      ctx.stroke();
    }

    // Knots
    for (let k = 0; k < 2; k++) {
      const kx = 8 + Math.random() * (cw - 16);
      const ky = 30 + Math.random() * (ch - 60);
      const kr = 2 + Math.random() * 4;
      const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
      g.addColorStop(0, "rgba(90, 55, 25, 0.25)");
      g.addColorStop(1, "rgba(90, 55, 25, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(kx, ky, kr, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;

    return new THREE.MeshStandardMaterial({
      map: tex,
      color: "#C8A96E",
      roughness: 0.85,
      metalness: 0.0,
    });
  }, []);
}

function usePlywoodMat() {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#A8884E",
        roughness: 0.6,
        metalness: 0.0,
      }),
    []
  );
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  PRIMITIVES                                                          ║
// ╚═══════════════════════════════════════════════════════════════════════╝

function Lumber({ position, size }: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  const mat = usePineMat();
  return (
    <mesh position={position} material={mat} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function PlywoodStrip({ position, length }: {
  position: [number, number, number];
  length: number;
}) {
  const mat = usePlywoodMat();
  return (
    <mesh position={position} material={mat} castShadow receiveShadow>
      <boxGeometry args={[RAIL_THICKNESS, RAIL_HEIGHT, length]} />
    </mesh>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  TOTE — Tapered Trapezoid                                           ║
// ║                                                                      ║
// ║  The GROUP origin is at the BOTTOM of the tote body.                 ║
// ║  Body: y = 0 → TOTE_BODY_H  (black, tapered)                        ║
// ║  Rim:  y = TOTE_BODY_H → TOTE_BODY_H + TOTE_RIM_H  (colored)       ║
// ║                                                                      ║
// ║  PLACEMENT: The rim top must align with rail top.                    ║
// ║  So tote group Y = railY + RAIL_HEIGHT/2 - TOTE_RIM_H - TOTE_BODY_H ║
// ╚═══════════════════════════════════════════════════════════════════════╝

function Tote({ position, rimWidth, toteType }: {
  position: [number, number, number];
  rimWidth: number;
  toteType: ToteType;
}) {
  const color = toteType === "HDX" ? "#fbbf24" : "#ef4444";
  const bodyTopW = rimWidth - TOTE_RIM_H; // slightly narrower than rim
  const bodyBotW = bodyTopW * TOTE_BODY_TAPER;
  const bodyDepth = RACK_DEPTH - POST_D * 2 - 1; // fits between front/back posts
  const bodyTopD = bodyDepth * 0.93;
  const bodyBotD = bodyDepth * 0.82;

  const bodyGeo = useMemo(() => {
    const hw_t = bodyTopW / 2, hw_b = bodyBotW / 2;
    const hd_t = bodyTopD / 2, hd_b = bodyBotD / 2;
    const h = TOTE_BODY_H;

    const v = new Float32Array([
      -hw_b, 0, -hd_b, hw_b, 0, -hd_b, hw_b, 0, hd_b, -hw_b, 0, hd_b,
      -hw_t, h, -hd_t, hw_t, h, -hd_t, hw_t, h, hd_t, -hw_t, h, hd_t,
    ]);
    const idx = [
      0,2,1, 0,3,2, 4,5,6, 4,6,7,
      0,1,5, 0,5,4, 2,3,7, 2,7,6,
      0,4,7, 0,7,3, 1,2,6, 1,6,5,
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }, [bodyTopW, bodyBotW, bodyTopD, bodyBotD]);

  return (
    <group position={position}>
      {/* Black tapered body */}
      <mesh geometry={bodyGeo} castShadow>
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.55}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Colored rim — sits ON TOP of body */}
      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H / 2, 0]} castShadow>
        <boxGeometry args={[rimWidth, TOTE_RIM_H, bodyTopD + 1]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.05} />
      </mesh>

      {/* Lid snap ridge */}
      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H + 0.12, 0]}>
        <boxGeometry args={[rimWidth - 0.5, 0.25, bodyTopD + 0.5]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.08} />
      </mesh>
    </group>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  RACK ASSEMBLY                                                       ║
// ╚═══════════════════════════════════════════════════════════════════════╝

function RackAssembly({
  cols,
  rows,
  toteType,
  hasTotes,
  hasWheels,
  hasTop,
}: Rack3DProps) {
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  const bayW = getBayWidth(toteType);

  // Total width = cols bays + (cols+1) posts
  const totalW = cols * bayW + (cols + 1) * POST_W;

  // First rail offset from bottom plate top
  const firstRailY = Math.max(MIN_FIRST_RAIL_Y, PLATE_H + 2);

  // Frame height calculation
  const lastRailY = firstRailY + (rows - 1) * TIER_SPACING;
  const topGap = 3; // space above last rail to top plate bottom
  const frameH = PLATE_H + lastRailY + topGap + PLATE_H;

  // Caster lift
  const lift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + lift;

  // Center in scene
  const cx = totalW / 2;
  const cy = overallH / 2;
  const cz = RACK_DEPTH / 2;

  // Rail length (spans between front and back posts, inside faces)
  const railLen = RACK_DEPTH - POST_D * 2;

  // Post height (between plates)
  const postH = frameH - PLATE_H * 2;

  return (
    <group scale={[S, S, S]} position={[-cx * S, -cy * S, -cz * S]}>
      {/* ── WOODEN STRUCTURE — shifted up by caster height ── */}
      <group position={[0, lift, 0]}>

        {/* ═══ BOTTOM PLATE (front + back 2×4s laid flat) ═══ */}
        <Lumber
          position={[totalW / 2, PLATE_H / 2, POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />
        <Lumber
          position={[totalW / 2, PLATE_H / 2, RACK_DEPTH - POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />

        {/* ═══ TOP PLATE ═══ */}
        <Lumber
          position={[totalW / 2, frameH - PLATE_H / 2, POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />
        <Lumber
          position={[totalW / 2, frameH - PLATE_H / 2, RACK_DEPTH - POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />

        {/* ═══ LADDER FRAMES (posts + rails) ═══ */}
        {Array.from({ length: cols + 1 }).map((_, i) => {
          const px = getPostX(i, bayW);

          return (
            <group key={`ladder-${i}`}>
              {/* ── Front Post ── */}
              <Lumber
                position={[px, PLATE_H + postH / 2, POST_D / 2]}
                size={[POST_W, postH, POST_D]}
              />
              {/* ── Back Post ── */}
              <Lumber
                position={[px, PLATE_H + postH / 2, RACK_DEPTH - POST_D / 2]}
                size={[POST_W, postH, POST_D]}
              />

              {/* ── STEP C: Rails screwed to SIDE FACES ── */}
              {/* Right-face rails: serve bay to the right (bay index = i) */}
              {i < cols &&
                Array.from({ length: rows }).map((_, r) => {
                  const railY = PLATE_H + firstRailY + r * TIER_SPACING;
                  // Rail on the RIGHT face of this post
                  const railX = px + POST_W / 2 + RAIL_THICKNESS / 2;
                  return (
                    <PlywoodStrip
                      key={`rr-${i}-${r}`}
                      position={[railX, railY, RACK_DEPTH / 2]}
                      length={railLen}
                    />
                  );
                })}

              {/* Left-face rails: serve bay to the left (bay index = i-1) */}
              {i > 0 &&
                Array.from({ length: rows }).map((_, r) => {
                  const railY = PLATE_H + firstRailY + r * TIER_SPACING;
                  // Rail on the LEFT face of this post
                  const railX = px - POST_W / 2 - RAIL_THICKNESS / 2;
                  return (
                    <PlywoodStrip
                      key={`rl-${i}-${r}`}
                      position={[railX, railY, RACK_DEPTH / 2]}
                      length={railLen}
                    />
                  );
                })}
            </group>
          );
        })}

        {/* ═══ TOTES — "THE HANG" ═══ */}
        {/*
          For each bay, the tote is centered between left and right rails.

          Rim width = toteW (the full tote width including lip overhang).
          The rim overhangs each rail by BIN_LIP_WIDTH.

          Y positioning:
            Rail center Y = PLATE_H + firstRailY + r * TIER_SPACING
            Rail top = railCenterY + RAIL_HEIGHT / 2
            Rim sits ON the rail top → rim top = rail top
            Rim bottom = rail top - TOTE_RIM_H
            Body top = rim bottom
            Body bottom = rim bottom - TOTE_BODY_H

            Group origin is at body bottom, so:
            toteGroupY = railTop - TOTE_RIM_H - TOTE_BODY_H
        */}
        {hasTotes &&
          Array.from({ length: cols }).map((_, c) => {
            // Bay center X
            const leftPostX = getPostX(c, bayW);
            const rightPostX = getPostX(c + 1, bayW);
            const bayCenterX = (leftPostX + rightPostX) / 2;

            return Array.from({ length: rows }).map((_, r) => {
              const railCenterY = PLATE_H + firstRailY + r * TIER_SPACING;
              const railTop = railCenterY + RAIL_HEIGHT / 2;
              const toteGroupY = railTop - TOTE_RIM_H - TOTE_BODY_H;

              return (
                <Tote
                  key={`tote-${c}-${r}`}
                  position={[bayCenterX, toteGroupY, RACK_DEPTH / 2]}
                  rimWidth={toteW}
                  toteType={toteType}
                />
              );
            });
          })}

        {/* ═══ PLYWOOD TOP ═══ */}
        {hasTop && (
          <mesh
            position={[totalW / 2, frameH + PLY_TOP_H / 2, RACK_DEPTH / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[totalW + 2, PLY_TOP_H, RACK_DEPTH + 2]} />
            <meshStandardMaterial color="#D4B896" roughness={0.6} metalness={0.0} />
          </mesh>
        )}
      </group>

      {/* ═══ INDUSTRIAL CASTERS — under every post pair ═══ */}
      {hasWheels &&
        Array.from({ length: cols + 1 }).map((_, i) => {
          const px = getPostX(i, bayW);
          return (
            <group key={`casters-${i}`}>
              {/* Front caster */}
              <IndustrialCaster position={[px, 0, POST_D / 2]} />
              {/* Back caster */}
              <IndustrialCaster position={[px, 0, RACK_DEPTH - POST_D / 2]} />
            </group>
          );
        })}
    </group>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  GROUND PLANE                                                        ║
// ╚═══════════════════════════════════════════════════════════════════════╝

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.003, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#f0f0f0" roughness={0.95} metalness={0.0} />
    </mesh>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  CAMERA RIG — locked, dynamic zoom                                   ║
// ╚═══════════════════════════════════════════════════════════════════════╝

function CameraRig({ cols, rows, toteType, hasWheels }: Pick<Rack3DProps, "cols" | "rows" | "toteType" | "hasWheels">) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const bayW = getBayWidth(toteType);
  const totalW = cols * bayW + (cols + 1) * POST_W;
  const firstRailY = Math.max(MIN_FIRST_RAIL_Y, PLATE_H + 2);
  const lastRailY = firstRailY + (rows - 1) * TIER_SPACING;
  const frameH = PLATE_H + lastRailY + 3 + PLATE_H;
  const lift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + lift;

  const sw = totalW * S;
  const sh = overallH * S;
  const sd = RACK_DEPTH * S;
  const maxDim = Math.max(sw, sh, sd);
  const dist = maxDim * 1.8;

  useEffect(() => {
    camera.position.set(dist * 0.9, dist * 0.6, dist * 1.1);
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
      autoRotate={false}
      enablePan
      panSpeed={0.5}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 1.5}
      minDistance={0.3}
      maxDistance={dist * 4}
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
        camera={{ fov: 40 }}
        gl={{ antialias: true, alpha: false }}
      >
        {/* Pure white background */}
        <color attach="background" args={["#ffffff"]} />

        {/* Studio lighting */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[12, 18, 12]}
          intensity={1.3}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.0002}
        />
        <directionalLight position={[-10, 12, -8]} intensity={0.25} />
        <pointLight position={[0, 8, 4]} intensity={0.15} color="#ffeedd" />
        <hemisphereLight args={["#ffffff", "#e8dcc8", 0.4]} />

        {/* Contact shadows — visible where wheels/base meets floor */}
        <ContactShadows
          position={[0, -0.002, 0]}
          opacity={0.5}
          scale={16}
          blur={2}
          far={6}
          color="#000000"
        />

        <CameraRig
          cols={props.cols}
          rows={props.rows}
          toteType={props.toteType}
          hasWheels={props.hasWheels}
        />

        <Ground />
        <RackAssembly {...props} />
      </Canvas>
    </div>
  );
}
