"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════════════════
// Rack3D — Interactive 3D Configurator (Visual Only)
// "Ladder Frame" construction — matches real carpentry.
// Accepts dimensions from server; does NOT calculate prices.
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

// ── Real-World Dimensions (inches) ───────────────────────────────────────

const POST_W = 1.5; // 2×4 actual width
const POST_D = 3.5; // 2×4 actual depth
const RAIL_H = 1.5; // 2×4 turned on side (rail thickness)
const RACK_DEPTH = 30; // Front-to-back depth
const TIER_H = 16; // Center-to-center between tiers
const PLATE_H = 1.5; // Top & bottom plate thickness
const TOP_GAP = 2.5; // Gap above first tier rail
const PLY_H = 0.75; // Plywood top thickness
const WHEEL_R = 2.5; // Caster wheel radius
const TOTE_BODY_H = 10.5; // Tote body (without lid)
const TOTE_LID_H = 1.5; // Tote lid thickness
const TOTE_TOLERANCE = 0.5; // Gap between tote and wood on each side

// Scale factor: convert inches to Three.js scene units
const S = 0.02;

// ── Materials (shared via hooks) ─────────────────────────────────────────

function useWoodMat() {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#E5CFA6"), // Unfinished pine
        roughness: 0.85,
        metalness: 0.0,
      }),
    []
  );
}

function usePlywoodMat() {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#D4B896"),
        roughness: 0.7,
        metalness: 0.0,
      }),
    []
  );
}

// ── Lumber — Reusable box with wood material ─────────────────────────────

function Lumber({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  const mat = useWoodMat();
  return (
    <mesh position={position} material={mat} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

// ── Ladder Frame ─────────────────────────────────────────────────────────
// Each "ladder" is a vertical frame: front post + back post + rungs.
// Rungs span the full RACK_DEPTH connecting front/back posts at each tier.

function LadderFrame({
  x,
  postH,
  rows,
}: {
  x: number;
  postH: number;
  rows: number;
}) {
  const postCenterY = PLATE_H + postH / 2;

  return (
    <group>
      {/* Front vertical post */}
      <Lumber
        position={[x, postCenterY, POST_D / 2]}
        size={[POST_W, postH, POST_D]}
      />
      {/* Back vertical post */}
      <Lumber
        position={[x, postCenterY, RACK_DEPTH - POST_D / 2]}
        size={[POST_W, postH, POST_D]}
      />

      {/* Rungs — horizontal rails connecting front & back at each tier */}
      {Array.from({ length: rows }).map((_, r) => {
        const railY = PLATE_H + TOP_GAP + r * TIER_H;
        const rungLength = RACK_DEPTH - POST_D * 2; // span between inner faces
        const rungZ = RACK_DEPTH / 2;
        return (
          <Lumber
            key={`rung-${r}`}
            position={[x, railY, rungZ]}
            size={[POST_W, RAIL_H, rungLength]}
          />
        );
      })}
    </group>
  );
}

// ── Tote ─────────────────────────────────────────────────────────────────

function Tote({
  position,
  width,
  toteType,
}: {
  position: [number, number, number];
  width: number;
  toteType: ToteType;
}) {
  const lidColor = toteType === "HDX" ? "#fbbf24" : "#ef4444";

  // Tote body is slightly tapered (narrower at bottom)
  const bodyTopW = width;
  const bodyBottomW = width * 0.88;
  const bodyDepth = RACK_DEPTH - POST_D * 2 - TOTE_TOLERANCE * 2;

  return (
    <group position={position}>
      {/* Body — matte black plastic */}
      <mesh position={[0, TOTE_BODY_H / 2, 0]} castShadow>
        <boxGeometry args={[bodyBottomW, TOTE_BODY_H, bodyDepth * 0.85]} />
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.6}
          metalness={0.02}
        />
      </mesh>
      {/* Rim/lip at top of body */}
      <mesh position={[0, TOTE_BODY_H - 0.3, 0]}>
        <boxGeometry args={[bodyTopW, 0.6, bodyDepth * 0.9]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.5} metalness={0.03} />
      </mesh>
      {/* Lid — slightly glossy colored plastic */}
      <mesh position={[0, TOTE_BODY_H + TOTE_LID_H / 2, 0]} castShadow>
        <boxGeometry args={[bodyTopW + 0.3, TOTE_LID_H, bodyDepth * 0.92]} />
        <meshStandardMaterial
          color={lidColor}
          roughness={0.3}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}

// ── Caster Wheel ─────────────────────────────────────────────────────────

function Caster({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Mounting plate */}
      <mesh position={[0, WHEEL_R * 2 + 0.5, 0]}>
        <boxGeometry args={[3.5, 0.5, 3.5]} />
        <meshStandardMaterial color="#444" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Fork */}
      <mesh position={[0, WHEEL_R + 0.75, 0]}>
        <boxGeometry args={[0.8, WHEEL_R + 0.5, 2.5]} />
        <meshStandardMaterial color="#555" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Wheel — rubber */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WHEEL_R, 0]} castShadow>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, 1.2, 24]} />
        <meshStandardMaterial color="#222" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Axle */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WHEEL_R, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 2, 8]} />
        <meshStandardMaterial color="#888" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Rack Assembly — The Full Unit
// ═══════════════════════════════════════════════════════════════════════════

function RackAssembly({
  cols,
  rows,
  toteType,
  hasTotes,
  hasWheels,
  hasTop,
}: Rack3DProps) {
  const opening = toteType === "HDX" ? 19.75 : 20.75;
  const totalW = cols * opening + (cols + 1) * POST_W;
  const frameH = rows * TIER_H + PLATE_H * 2 + TOP_GAP;
  const wheelOffset = hasWheels ? WHEEL_R * 2 + 1 : 0;

  // Center the rack at scene origin
  const centerX = totalW / 2;
  const centerY = frameH / 2 + wheelOffset;
  const centerZ = RACK_DEPTH / 2;

  return (
    <group
      scale={[S, S, S]}
      position={[-centerX * S, -centerY * S, -centerZ * S]}
    >
      <group position={[0, wheelOffset, 0]}>
        {/* ── Bottom Plate (front & back rails) ───────────────── */}
        <Lumber
          position={[totalW / 2, PLATE_H / 2, POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />
        <Lumber
          position={[totalW / 2, PLATE_H / 2, RACK_DEPTH - POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />

        {/* ── Top Plate (front & back rails) ──────────────────── */}
        <Lumber
          position={[totalW / 2, frameH - PLATE_H / 2, POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />
        <Lumber
          position={[totalW / 2, frameH - PLATE_H / 2, RACK_DEPTH - POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />

        {/* ── Ladder Frames (cols + 1) ────────────────────────── */}
        {Array.from({ length: cols + 1 }).map((_, i) => {
          const x = i * (opening + POST_W) + POST_W / 2;
          const postH = frameH - PLATE_H * 2;
          return (
            <LadderFrame key={`ladder-${i}`} x={x} postH={postH} rows={rows} />
          );
        })}

        {/* ── Totes (placed between ladders, resting on rungs) ── */}
        {hasTotes &&
          Array.from({ length: cols }).map((_, c) => {
            const bayLeft = POST_W + c * (opening + POST_W);
            const bayCenter = bayLeft + opening / 2;
            const toteW = opening - TOTE_TOLERANCE * 2;

            return Array.from({ length: rows }).map((_, r) => {
              const railY = PLATE_H + TOP_GAP + r * TIER_H;
              // Tote sits on top of the rail
              const toteY = railY + RAIL_H / 2;
              return (
                <Tote
                  key={`tote-${c}-${r}`}
                  position={[bayCenter, toteY, RACK_DEPTH / 2]}
                  width={toteW}
                  toteType={toteType}
                />
              );
            });
          })}

        {/* ── Plywood Top ─────────────────────────────────────── */}
        {hasTop && (
          <mesh
            position={[totalW / 2, frameH + PLY_H / 2, RACK_DEPTH / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[totalW + 2, PLY_H, RACK_DEPTH + 2]} />
            <meshStandardMaterial
              color="#D4B896"
              roughness={0.7}
              metalness={0.0}
            />
          </mesh>
        )}
      </group>

      {/* ── Caster Wheels ───────────────────────────────────────── */}
      {hasWheels && (
        <>
          <Caster position={[POST_W * 3, 0, POST_D * 2]} />
          <Caster position={[totalW - POST_W * 3, 0, POST_D * 2]} />
          <Caster position={[POST_W * 3, 0, RACK_DEPTH - POST_D * 2]} />
          <Caster position={[totalW - POST_W * 3, 0, RACK_DEPTH - POST_D * 2]} />
        </>
      )}
    </group>
  );
}

// ── Ground Plane ─────────────────────────────────────────────────────────

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial color="#141414" roughness={0.95} metalness={0.0} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Export — The 3D Canvas Wrapper
// ═══════════════════════════════════════════════════════════════════════════

export default function Rack3D(props: Rack3DProps) {
  return (
    <div className="absolute inset-0" style={{ touchAction: "none" }}>
      <Canvas
        shadows
        camera={{ position: [3, 2.5, 4], fov: 40 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={["#111118"]} />

        {/* Studio Lighting — soft, directional with fill */}
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
          shadow-bias={-0.0005}
        />
        <directionalLight position={[-8, 10, -6]} intensity={0.35} />
        <pointLight position={[0, 6, 3]} intensity={0.25} color="#ffeedd" />

        {/* Controls — rotate around the rack center, panning enabled */}
        <OrbitControls
          makeDefault
          autoRotate
          autoRotateSpeed={0.5}
          enablePan={true}
          panSpeed={0.5}
          rotateSpeed={0.6}
          zoomSpeed={0.8}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 1.6}
          minDistance={1.2}
          maxDistance={10}
          target={[0, 0, 0]}
          enableDamping
          dampingFactor={0.08}
        />

        <Ground />
        <RackAssembly {...props} />
      </Canvas>
    </div>
  );
}
