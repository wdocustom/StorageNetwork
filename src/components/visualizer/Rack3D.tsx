"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════════════════
// Rack3D — Interactive 3D Configurator (Visual Only)
// "Rim-Glider" construction: 2×4 posts + 3/4" plywood rail strips.
// Totes hang between rails; yellow rim rests on plywood edge.
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

const POST_W = 1.5;       // 2×4 actual width
const POST_D = 3.5;       // 2×4 actual depth
const RAIL_THICK = 0.75;  // 3/4" plywood strip thickness
const RAIL_H = 1.75;      // Plywood strip height
const RACK_DEPTH = 30;    // Front-to-back
const TIER_H = 16;        // Center-to-center between tiers
const PLATE_H = 1.5;      // Top & bottom plate thickness
const TOP_GAP = 2.5;      // Gap above first tier rail
const PLY_H = 0.75;       // Plywood top thickness
const WHEEL_R = 2.5;      // Caster wheel radius
const TOTE_RIM_H = 1.0;   // Yellow rim height
const TOTE_RIM_OVERHANG = 0.5; // How much rim overhangs body
const TOTE_BODY_H = 11.0; // Tote body below rim
const TOTE_TOLERANCE = 0.25;

// Scale: inches → scene units
const S = 0.02;

// ── Materials ────────────────────────────────────────────────────────────

function useWoodMat() {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#E5CFA6"),
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
        color: new THREE.Color("#C9B07C"),
        roughness: 0.7,
        metalness: 0.0,
      }),
    []
  );
}

// ── Lumber — 2×4 box ────────────────────────────────────────────────────

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

// ── Plywood Rail Strip ──────────────────────────────────────────────────

function PlywoodRail({
  position,
  length,
}: {
  position: [number, number, number];
  length: number;
}) {
  const mat = usePlywoodMat();
  return (
    <mesh position={position} material={mat} castShadow receiveShadow>
      <boxGeometry args={[RAIL_THICK, RAIL_H, length]} />
    </mesh>
  );
}

// ── Ladder Frame ────────────────────────────────────────────────────────
// Front post + back post + plywood rail strips at each tier.
// Rails are attached to the SIDES of the posts (not spanning between them).

function LadderFrame({
  x,
  postH,
  rows,
  side,
}: {
  x: number;
  postH: number;
  rows: number;
  side: "left" | "right";
}) {
  const postCenterY = PLATE_H + postH / 2;
  // Rail is flush against the inner face of the post
  const railOffsetX = side === "left" ? RAIL_THICK / 2 : -RAIL_THICK / 2;
  const railX = x + railOffsetX;
  const railDepth = RACK_DEPTH - POST_D * 2;

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

      {/* Plywood rail strips at each tier — attached to inner face */}
      {Array.from({ length: rows }).map((_, r) => {
        const railY = PLATE_H + TOP_GAP + r * TIER_H;
        return (
          <PlywoodRail
            key={`rail-${r}`}
            position={[railX, railY, RACK_DEPTH / 2]}
            length={railDepth}
          />
        );
      })}
    </group>
  );
}

// ── Tote — Tapered Trapezoid ────────────────────────────────────────────
// Body is narrower at bottom, wider at top. Yellow rim sits on plywood edge.

function Tote({
  position,
  topWidth,
  toteType,
}: {
  position: [number, number, number];
  topWidth: number;
  toteType: ToteType;
}) {
  const lidColor = toteType === "HDX" ? "#fbbf24" : "#ef4444";
  const bodyDepth = RACK_DEPTH - POST_D * 2 - TOTE_TOLERANCE * 4;

  // Tapered body: bottom is ~85% of top width
  const bottomWidth = topWidth * 0.85;
  const bodyTopDepth = bodyDepth * 0.92;
  const bodyBottomDepth = bodyDepth * 0.82;

  // Custom trapezoid geometry for the body
  const bodyVerts = useMemo(() => {
    const hw_t = topWidth / 2;
    const hw_b = bottomWidth / 2;
    const hd_t = bodyTopDepth / 2;
    const hd_b = bodyBottomDepth / 2;
    const h = TOTE_BODY_H;

    // 8 corners: bottom-front-left, bottom-front-right, bottom-back-right, bottom-back-left,
    //            top-front-left, top-front-right, top-back-right, top-back-left
    const vertices = new Float32Array([
      // Bottom face (y=0)
      -hw_b, 0, -hd_b,   hw_b, 0, -hd_b,   hw_b, 0, hd_b,   -hw_b, 0, hd_b,
      // Top face (y=h)
      -hw_t, h, -hd_t,   hw_t, h, -hd_t,   hw_t, h, hd_t,   -hw_t, h, hd_t,
    ]);

    const indices = [
      // Bottom
      0, 2, 1, 0, 3, 2,
      // Top
      4, 5, 6, 4, 6, 7,
      // Front
      0, 1, 5, 0, 5, 4,
      // Back
      2, 3, 7, 2, 7, 6,
      // Left
      0, 4, 7, 0, 7, 3,
      // Right
      1, 2, 6, 1, 6, 5,
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [topWidth, bottomWidth, bodyTopDepth, bodyBottomDepth]);

  return (
    <group position={position}>
      {/* Tote body — tapered matte black */}
      <mesh geometry={bodyVerts} castShadow>
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.6}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rim — rests ON TOP of plywood rails, overhangs body */}
      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H / 2, 0]} castShadow>
        <boxGeometry
          args={[
            topWidth + TOTE_RIM_OVERHANG * 2,
            TOTE_RIM_H,
            bodyTopDepth + TOTE_RIM_OVERHANG * 2,
          ]}
        />
        <meshStandardMaterial
          color={lidColor}
          roughness={0.3}
          metalness={0.05}
        />
      </mesh>

      {/* Lid snap detail — thin line on rim */}
      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H + 0.15, 0]}>
        <boxGeometry
          args={[topWidth + TOTE_RIM_OVERHANG, 0.3, bodyTopDepth + TOTE_RIM_OVERHANG]}
        />
        <meshStandardMaterial
          color={lidColor}
          roughness={0.25}
          metalness={0.08}
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
        <meshStandardMaterial color="#555" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Fork */}
      <mesh position={[0, WHEEL_R + 0.75, 0]}>
        <boxGeometry args={[0.8, WHEEL_R + 0.5, 2.5]} />
        <meshStandardMaterial color="#666" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Wheel */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WHEEL_R, 0]} castShadow>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, 1.2, 24]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Axle */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WHEEL_R, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 2, 8]} />
        <meshStandardMaterial color="#999" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Rack Assembly
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

  const centerX = totalW / 2;
  const centerY = frameH / 2 + wheelOffset;
  const centerZ = RACK_DEPTH / 2;

  return (
    <group
      scale={[S, S, S]}
      position={[-centerX * S, -centerY * S, -centerZ * S]}
    >
      <group position={[0, wheelOffset, 0]}>
        {/* ── Bottom Plate ──────────────────────────────────── */}
        <Lumber
          position={[totalW / 2, PLATE_H / 2, POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />
        <Lumber
          position={[totalW / 2, PLATE_H / 2, RACK_DEPTH - POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />

        {/* ── Top Plate ─────────────────────────────────────── */}
        <Lumber
          position={[totalW / 2, frameH - PLATE_H / 2, POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />
        <Lumber
          position={[totalW / 2, frameH - PLATE_H / 2, RACK_DEPTH - POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />

        {/* ── Ladder Frames with Plywood Rails ──────────────── */}
        {/* Each bay has rails on its left post (right side) and right post (left side) */}
        {Array.from({ length: cols + 1 }).map((_, i) => {
          const x = i * (opening + POST_W) + POST_W / 2;
          const postH = frameH - PLATE_H * 2;

          // First post: rails on right side only
          // Last post: rails on left side only
          // Middle posts: rails on both sides
          const showRight = i < cols;
          const showLeft = i > 0;

          return (
            <group key={`frame-${i}`}>
              {/* Posts (always) */}
              <Lumber
                position={[x, PLATE_H + postH / 2, POST_D / 2]}
                size={[POST_W, postH, POST_D]}
              />
              <Lumber
                position={[x, PLATE_H + postH / 2, RACK_DEPTH - POST_D / 2]}
                size={[POST_W, postH, POST_D]}
              />

              {/* Right-side plywood rails (serve left bay) */}
              {showRight &&
                Array.from({ length: rows }).map((_, r) => {
                  const railY = PLATE_H + TOP_GAP + r * TIER_H;
                  const railX = x + POST_W / 2 + RAIL_THICK / 2;
                  const railLen = RACK_DEPTH - POST_D * 2;
                  return (
                    <PlywoodRail
                      key={`rr-${i}-${r}`}
                      position={[railX, railY, RACK_DEPTH / 2]}
                      length={railLen}
                    />
                  );
                })}

              {/* Left-side plywood rails (serve right bay) */}
              {showLeft &&
                Array.from({ length: rows }).map((_, r) => {
                  const railY = PLATE_H + TOP_GAP + r * TIER_H;
                  const railX = x - POST_W / 2 - RAIL_THICK / 2;
                  const railLen = RACK_DEPTH - POST_D * 2;
                  return (
                    <PlywoodRail
                      key={`rl-${i}-${r}`}
                      position={[railX, railY, RACK_DEPTH / 2]}
                      length={railLen}
                    />
                  );
                })}
            </group>
          );
        })}

        {/* ── Totes (hanging between plywood rails) ─────────── */}
        {hasTotes &&
          Array.from({ length: cols }).map((_, c) => {
            const bayLeft = POST_W + c * (opening + POST_W);
            const bayCenter = bayLeft + opening / 2;
            // Tote top width = opening minus rail thickness on each side minus tolerance
            const toteTopW = opening - RAIL_THICK * 2 - TOTE_TOLERANCE * 2;

            return Array.from({ length: rows }).map((_, r) => {
              const railY = PLATE_H + TOP_GAP + r * TIER_H;
              // Rim rests ON the plywood rail edge
              // So tote body hangs below: rimTop = railY + RAIL_H/2
              const rimTop = railY + RAIL_H / 2;
              const toteBaseY = rimTop - TOTE_RIM_H - TOTE_BODY_H;

              return (
                <Tote
                  key={`tote-${c}-${r}`}
                  position={[bayCenter, toteBaseY, RACK_DEPTH / 2]}
                  topWidth={toteTopW}
                  toteType={toteType}
                />
              );
            });
          })}

        {/* ── Plywood Top ───────────────────────────────────── */}
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

      {/* ── Caster Wheels ─────────────────────────────────────── */}
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
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#f5f5f5" roughness={0.95} metalness={0.0} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Export
// ═══════════════════════════════════════════════════════════════════════════

export default function Rack3D(props: Rack3DProps) {
  return (
    <div className="absolute inset-0" style={{ touchAction: "none" }}>
      <Canvas
        shadows
        camera={{ position: [3, 2.5, 4], fov: 40 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={["#ffffff"]} />

        {/* Studio lighting on white */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
          shadow-bias={-0.0005}
        />
        <directionalLight position={[-8, 10, -6]} intensity={0.3} />
        <pointLight position={[0, 6, 3]} intensity={0.2} color="#ffeedd" />
        {/* Subtle fill from below to prevent dark undersides */}
        <hemisphereLight
          args={["#ffffff", "#e0d8c8", 0.3]}
        />

        {/* Controls */}
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
