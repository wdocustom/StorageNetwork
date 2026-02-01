"use client";

import { useMemo, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Stage } from "@react-three/drei";
import * as THREE from "three";
import IndustrialCaster, { CASTER_HEIGHT } from "./IndustrialCaster";

// ═══════════════════════════════════════════════════════════════════════════
// Rack3D — Precise CAD Blueprint (Rim-Glider System)
//
// All geometry in INCHES, uniformly scaled to scene units.
//
// PHYSICAL CONSTRUCTION:
//   - Vertical 2×4 posts at each column line (front + back)
//   - 3/4" plywood rails screwed to post SIDE FACES, full 30" depth
//   - Totes: yellow rim sits ON TOP of plywood rail, body hangs BELOW
//   - Bottom/Top plates span full width
//   - 4 industrial casters at the 4 outer corners
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

// ── Constants (inches) ───────────────────────────────────────────────────

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

// Tote
const TOTE_FULL_W_HDX = 19.75;
const TOTE_FULL_W_GM = 20.75;
const TOTE_RIM_H = 1.0;
const TOTE_BODY_H = 11.0;
const TOTE_BODY_TAPER = 0.85;
const TOTE_DEPTH = 28.6;       // Tote lid depth — slightly less than 30" for equal front/back gap

// Inches → scene units
const S = 1 / 48;

// ── Derived ──────────────────────────────────────────────────────────────

function getBayWidth(toteType: ToteType): number {
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  return toteW - 2 * BIN_LIP_WIDTH + 2 * BIN_GAP;
}

function getPostX(i: number, bayW: number): number {
  return i * (bayW + POST_W) + POST_W / 2;
}

// First rail Y offset from bottom plate top.
// Tote hangs: TOTE_BODY_H below rail top. Rail top = railY + RAIL_HEIGHT/2.
// Tote bottom = railY + RAIL_HEIGHT/2 - TOTE_BODY_H
// Must be > 0 (above bottom plate) with 2" safety.
const MIN_FIRST_RAIL_Y = TOTE_BODY_H - RAIL_HEIGHT / 2 + 2;

// ── Materials ────────────────────────────────────────────────────────────
// Uniform pine color — no canvas texture to avoid UV split artifacts.

const PINE_MAT = (() => {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#C8A96E"),
    roughness: 0.82,
    metalness: 0.0,
  });
  return mat;
})();

const PLYWOOD_MAT = (() => {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#A8884E"),
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

function PlywoodStrip({ position, length }: {
  position: [number, number, number];
  length: number;
}) {
  return (
    <mesh position={position} material={PLYWOOD_MAT} castShadow receiveShadow>
      <boxGeometry args={[RAIL_THICKNESS, RAIL_HEIGHT, length]} />
    </mesh>
  );
}

// ── Tote ─────────────────────────────────────────────────────────────────
// Group origin = BOTTOM of tote body.
//   Body: y = 0 → TOTE_BODY_H (black, tapered)
//   Rim:  y = TOTE_BODY_H → TOTE_BODY_H + TOTE_RIM_H (colored)
//
// PLACEMENT RULE:
//   Rim sits ON TOP of rail → rim bottom = rail top
//   Rail top = railCenterY + RAIL_HEIGHT / 2
//   Rim bottom = toteGroupY + TOTE_BODY_H
//   So: toteGroupY = railCenterY + RAIL_HEIGHT/2 - TOTE_BODY_H
//   Body hangs BELOW the rail. Rim is above the rail.

function Tote({ position, bayW, toteType }: {
  position: [number, number, number];
  bayW: number;
  toteType: ToteType;
}) {
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  const color = toteType === "HDX" ? "#fbbf24" : "#ef4444";

  const rimW = toteW;
  // Body fits between the rails
  const bodyTopW = bayW - BIN_GAP * 2;
  const bodyBotW = bodyTopW * TOTE_BODY_TAPER;
  // Tote depth = full 30" (matches unit depth)
  const bodyTopD = TOTE_DEPTH * 0.95;
  const bodyBotD = TOTE_DEPTH * 0.82;
  const rimD = TOTE_DEPTH;

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
      <mesh geometry={bodyGeo} castShadow>
        <meshStandardMaterial color="#1a1a1a" roughness={0.55} metalness={0.02} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H / 2, 0]} castShadow>
        <boxGeometry args={[rimW, TOTE_RIM_H, rimD]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.05} />
      </mesh>
      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H + 0.12, 0]}>
        <boxGeometry args={[rimW - 0.5, 0.25, rimD - 0.5]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.08} />
      </mesh>
    </group>
  );
}

// ── Rack Assembly ────────────────────────────────────────────────────────

function RackAssembly({
  cols, rows, toteType, hasTotes, hasWheels, hasTop,
}: Rack3DProps) {
  const bayW = getBayWidth(toteType);
  const totalW = cols * bayW + (cols + 1) * POST_W;

  const firstRailY = Math.max(MIN_FIRST_RAIL_Y, PLATE_H + 2);
  const lastRailY = firstRailY + (rows - 1) * TIER_SPACING;
  const topGap = 3;
  const frameH = PLATE_H + lastRailY + topGap + PLATE_H;

  const lift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + lift;

  const cx = totalW / 2;
  const cy = overallH / 2;
  const cz = RACK_DEPTH / 2;

  // Rails span the FULL 30" depth (front face to back face of the unit).
  // They are the "rungs" of the ladder — full length.
  const railLen = RACK_DEPTH;

  const postH = frameH - PLATE_H * 2;

  return (
    <group scale={[S, S, S]}>
      <group position={[-cx, -cy, -cz]}>

        {/* ── WOOD FRAME — lifted by caster height ── */}
        <group position={[0, lift, 0]}>

          {/* Bottom plates */}
          <Lumber position={[totalW / 2, PLATE_H / 2, POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />
          <Lumber position={[totalW / 2, PLATE_H / 2, RACK_DEPTH - POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />

          {/* Top plates */}
          <Lumber position={[totalW / 2, frameH - PLATE_H / 2, POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />
          <Lumber position={[totalW / 2, frameH - PLATE_H / 2, RACK_DEPTH - POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />

          {/* Ladder frames: posts + rails */}
          {Array.from({ length: cols + 1 }).map((_, i) => {
            const px = getPostX(i, bayW);
            return (
              <group key={`ladder-${i}`}>
                {/* Front + Back posts */}
                <Lumber position={[px, PLATE_H + postH / 2, POST_D / 2]} size={[POST_W, postH, POST_D]} />
                <Lumber position={[px, PLATE_H + postH / 2, RACK_DEPTH - POST_D / 2]} size={[POST_W, postH, POST_D]} />

                {/* Right-face rails (serve bay i) — full 30" depth */}
                {i < cols && Array.from({ length: rows }).map((_, r) => {
                  const railY = PLATE_H + firstRailY + r * TIER_SPACING;
                  const railX = px + POST_W / 2 + RAIL_THICKNESS / 2;
                  return <PlywoodStrip key={`rr-${i}-${r}`} position={[railX, railY, RACK_DEPTH / 2]} length={railLen} />;
                })}

                {/* Left-face rails (serve bay i-1) — full 30" depth */}
                {i > 0 && Array.from({ length: rows }).map((_, r) => {
                  const railY = PLATE_H + firstRailY + r * TIER_SPACING;
                  const railX = px - POST_W / 2 - RAIL_THICKNESS / 2;
                  return <PlywoodStrip key={`rl-${i}-${r}`} position={[railX, railY, RACK_DEPTH / 2]} length={railLen} />;
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
              const railCenterY = PLATE_H + firstRailY + r * TIER_SPACING;
              const railTop = railCenterY + RAIL_HEIGHT / 2;
              // Rim bottom = rail top → body bottom = rail top - TOTE_BODY_H
              const toteGroupY = railTop - TOTE_BODY_H;

              return (
                <Tote
                  key={`tote-${c}-${r}`}
                  position={[bayCenterX, toteGroupY, RACK_DEPTH / 2]}
                  bayW={bayW}
                  toteType={toteType}
                />
              );
            });
          })}

          {/* Plywood top */}
          {hasTop && (
            <mesh position={[totalW / 2, frameH + PLY_TOP_H / 2, RACK_DEPTH / 2]} castShadow receiveShadow>
              <boxGeometry args={[totalW + 2, PLY_TOP_H, RACK_DEPTH + 2]} />
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
              <IndustrialCaster position={[firstPostX, 0, RACK_DEPTH - POST_D / 2]} />
              <IndustrialCaster position={[lastPostX, 0, RACK_DEPTH - POST_D / 2]} />
            </>
          );
        })()}
      </group>
    </group>
  );
}

// ── Camera rig ───────────────────────────────────────────────────────────

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
  const dist = maxDim * 2.2;

  useEffect(() => {
    camera.position.set(dist * 0.7, dist * 0.5, dist * 0.7);
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
          hasWheels={props.hasWheels}
        />

        <Stage intensity={0.5} environment="city" adjustCamera={false}>
          <RackAssembly {...props} />
        </Stage>
      </Canvas>
    </div>
  );
}
