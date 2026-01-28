"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stage, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════════════════
// Rack3D — Interactive 3D Configurator (Visual Only)
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

// ── Scale: 1 Three.js unit = 1 inch (real dimensions) ────────────────────

// Real 2×4 lumber = 1.5" × 3.5"
const STUD_W = 1.5;
const STUD_D = 3.5;

// Tote dimensions (height includes lid)
const TOTE_H = 12;
const TOTE_D = 15; // depth of tote body

// Tier height (center-to-center of rails)
const TIER_H = 16;

// Top/bottom plate thickness
const PLATE_H = 1.5;

// Plywood top thickness
const PLY_H = 0.75;

// Wheel dimensions
const WHEEL_R = 2.5;

// Gap above top rail
const TOP_GAP = 2.5;

// Depth of the rack frame
const FRAME_DEPTH = 30;

// ── Materials ────────────────────────────────────────────────────────────

function useWoodMaterial() {
  return useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#d4c5a9"),
      roughness: 0.75,
      metalness: 0.0,
    });
    return mat;
  }, []);
}

function usePlywoodMaterial() {
  return useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#e8d5a8"),
      roughness: 0.65,
      metalness: 0.0,
    });
  }, []);
}

// ── Lumber Component ─────────────────────────────────────────────────────

function Lumber({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  const mat = useWoodMaterial();
  return (
    <mesh position={position} material={mat} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

// ── Tote Component ───────────────────────────────────────────────────────

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
  const bodyColor = "#1a1a1a";

  const bodyW = width * 0.9;
  const bodyH = TOTE_H - 1.5;
  const lidH = 1.5;

  return (
    <group position={position}>
      {/* Tote body */}
      <mesh position={[0, bodyH / 2, 0]} castShadow>
        <boxGeometry args={[bodyW, bodyH, TOTE_D * 0.9]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>
      {/* Lid */}
      <mesh position={[0, bodyH + lidH / 2, 0]} castShadow>
        <boxGeometry args={[width, lidH, TOTE_D * 0.95]} />
        <meshStandardMaterial
          color={lidColor}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}

// ── Wheel Component ──────────────────────────────────────────────────────

function Wheel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Bracket */}
      <mesh position={[0, WHEEL_R + 1, 0]}>
        <boxGeometry args={[3, 2, 3]} />
        <meshStandardMaterial color="#555" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* Wheel */}
      <mesh
        position={[0, WHEEL_R, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, 1.5, 16]} />
        <meshStandardMaterial color="#333" roughness={0.3} metalness={0.7} />
      </mesh>
    </group>
  );
}

// ── The Rack Assembly ────────────────────────────────────────────────────

function RackAssembly({
  cols,
  rows,
  toteType,
  hasTotes,
  hasWheels,
  hasTop,
}: Rack3DProps) {
  const opening = toteType === "HDX" ? 19.75 : 20.75;
  const totalW = cols * opening + (cols + 1) * STUD_W;
  const frameH = rows * TIER_H + PLATE_H * 2 + TOP_GAP;

  // Center the rack at origin
  const offsetX = -totalW / 2;
  const offsetY = hasWheels ? WHEEL_R * 2 + 2 : 0;
  const offsetZ = -FRAME_DEPTH / 2;

  // Scale down so it fits nicely in the scene
  const scaleFactor = 0.02;

  const woodMat = useWoodMaterial();
  const plyMat = usePlywoodMaterial();

  return (
    <group scale={[scaleFactor, scaleFactor, scaleFactor]}>
      <group position={[offsetX, offsetY, offsetZ]}>
        {/* ── Bottom Plate ──────────────────────────────────────── */}
        <Lumber
          position={[totalW / 2, PLATE_H / 2, FRAME_DEPTH / 2]}
          size={[totalW, PLATE_H, STUD_D]}
        />
        {/* Back bottom rail */}
        <Lumber
          position={[totalW / 2, PLATE_H / 2, FRAME_DEPTH - STUD_D / 2]}
          size={[totalW, PLATE_H, STUD_D]}
        />

        {/* ── Top Plate ─────────────────────────────────────────── */}
        <Lumber
          position={[totalW / 2, frameH - PLATE_H / 2, FRAME_DEPTH / 2]}
          size={[totalW, PLATE_H, STUD_D]}
        />
        <Lumber
          position={[
            totalW / 2,
            frameH - PLATE_H / 2,
            FRAME_DEPTH - STUD_D / 2,
          ]}
          size={[totalW, PLATE_H, STUD_D]}
        />

        {/* ── Vertical Posts ────────────────────────────────────── */}
        {Array.from({ length: cols + 1 }).map((_, i) => {
          const x = i * (opening + STUD_W) + STUD_W / 2;
          const postH = frameH - PLATE_H * 2;
          const postY = PLATE_H + postH / 2;
          return (
            <group key={`post-${i}`}>
              {/* Front post */}
              <Lumber
                position={[x, postY, STUD_D / 2]}
                size={[STUD_W, postH, STUD_D]}
              />
              {/* Back post */}
              <Lumber
                position={[x, postY, FRAME_DEPTH - STUD_D / 2]}
                size={[STUD_W, postH, STUD_D]}
              />
            </group>
          );
        })}

        {/* ── Horizontal Rails (per tier) ──────────────────────── */}
        {Array.from({ length: cols }).map((_, c) => {
          const bayLeft = STUD_W + c * (opening + STUD_W);
          const bayCenter = bayLeft + opening / 2;

          return Array.from({ length: rows }).map((_, r) => {
            const railY = PLATE_H + TOP_GAP + r * TIER_H;
            return (
              <group key={`rails-${c}-${r}`}>
                {/* Front left rail cleat */}
                <Lumber
                  position={[bayLeft + STUD_W / 2, railY, STUD_D / 2]}
                  size={[STUD_W, STUD_W, STUD_D]}
                />
                {/* Front right rail cleat */}
                <Lumber
                  position={[
                    bayLeft + opening - STUD_W / 2,
                    railY,
                    STUD_D / 2,
                  ]}
                  size={[STUD_W, STUD_W, STUD_D]}
                />
                {/* Back left rail cleat */}
                <Lumber
                  position={[
                    bayLeft + STUD_W / 2,
                    railY,
                    FRAME_DEPTH - STUD_D / 2,
                  ]}
                  size={[STUD_W, STUD_W, STUD_D]}
                />
                {/* Back right rail cleat */}
                <Lumber
                  position={[
                    bayLeft + opening - STUD_W / 2,
                    railY,
                    FRAME_DEPTH - STUD_D / 2,
                  ]}
                  size={[STUD_W, STUD_W, STUD_D]}
                />

                {/* ── Totes ─────────────────────────────────────── */}
                {hasTotes && (
                  <Tote
                    position={[bayCenter, railY + STUD_W / 2, FRAME_DEPTH / 2]}
                    width={opening * 0.95}
                    toteType={toteType}
                  />
                )}
              </group>
            );
          });
        })}

        {/* ── Plywood Top ──────────────────────────────────────── */}
        {hasTop && (
          <mesh
            position={[totalW / 2, frameH + PLY_H / 2, FRAME_DEPTH / 2]}
            material={plyMat}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[totalW + 2, PLY_H, FRAME_DEPTH + 2]}
            />
          </mesh>
        )}

        {/* ── Wheels ───────────────────────────────────────────── */}
        {hasWheels && (
          <>
            <Wheel position={[STUD_W * 3, -offsetY, STUD_D]} />
            <Wheel
              position={[totalW - STUD_W * 3, -offsetY, STUD_D]}
            />
            <Wheel
              position={[STUD_W * 3, -offsetY, FRAME_DEPTH - STUD_D]}
            />
            <Wheel
              position={[
                totalW - STUD_W * 3,
                -offsetY,
                FRAME_DEPTH - STUD_D,
              ]}
            />
          </>
        )}
      </group>
    </group>
  );
}

// ── Auto-Rotate Controller ───────────────────────────────────────────────

function AutoRotate() {
  const controlsRef = useRef<any>(null);
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      autoRotate
      autoRotateSpeed={0.8}
      enablePan={false}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI / 1.5}
      minDistance={1.5}
      maxDistance={8}
    />
  );
}

// ── Ground Plane ─────────────────────────────────────────────────────────

function Ground() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow
    >
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial
        color="#1e1e1e"
        roughness={0.9}
        metalness={0.0}
      />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Export — The 3D Canvas Wrapper
// ═══════════════════════════════════════════════════════════════════════════

export default function Rack3D(props: Rack3DProps) {
  return (
    <div
      className="absolute inset-0"
      style={{ touchAction: "none" }}
    >
      <Canvas
        shadows
        camera={{ position: [3, 2, 5], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "linear-gradient(180deg, #0f0f0f 0%, #1a1a2e 100%)" }}
      >
        <color attach="background" args={["#0f0f0f"]} />

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[8, 12, 8]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />
        <directionalLight
          position={[-5, 8, -5]}
          intensity={0.4}
        />
        <pointLight position={[0, 5, 0]} intensity={0.3} />

        {/* Controls */}
        <AutoRotate />

        {/* Scene */}
        <Ground />
        <RackAssembly {...props} />
      </Canvas>
    </div>
  );
}
