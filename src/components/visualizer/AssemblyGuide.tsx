"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import IndustrialCaster, { CASTER_HEIGHT } from "./IndustrialCaster";
import ConstructionScrew from "./ConstructionScrew";
import {
  ASSEMBLY_STEPS,
  computeMaterials,
  type AssemblyStep,
  type PartGroup,
  type PartVisibility,
} from "./assemblySteps";
import {
  ChevronRight,
  ChevronLeft,
  Play,
  RotateCcw,
  Wrench,
  CheckCircle2,
  Package,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — mirrors Rack3D.tsx exactly
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";

const POST_W = 1.5;
const POST_D = 3.5;
const RAIL_THICKNESS = 0.75;
const RAIL_HEIGHT = 1.875;
const BIN_LIP_WIDTH = 1.0;
const BIN_GAP = 0.25;
const PLATE_H = 1.5;
const RACK_DEPTH = 30;
const TIER_SPACING = 16;
const PLY_TOP_H = 0.75;

const TOTE_FULL_W_HDX = 19.75;
const TOTE_FULL_W_GM = 20.75;
const TOTE_RIM_H = 1.0;
const TOTE_BODY_H = 11.0;
const TOTE_BODY_TAPER = 0.85;
const TOTE_DEPTH = 28.6;

const S = 1 / 48;

function getBayWidth(toteType: ToteType): number {
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  return toteW - 2 * BIN_LIP_WIDTH + 2 * BIN_GAP;
}

function getPostX(i: number, bayW: number): number {
  return i * (bayW + POST_W) + POST_W / 2;
}

const MIN_FIRST_RAIL_Y = TOTE_BODY_H - RAIL_HEIGHT / 2 + 2;

// ═══════════════════════════════════════════════════════════════════════════
// MATERIALS
// ═══════════════════════════════════════════════════════════════════════════

function makeMat(color: string, roughness: number, metalness: number) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
  });
}

const PINE_MAT = makeMat("#C8A96E", 0.82, 0.0);
const PLYWOOD_MAT = makeMat("#A8884E", 0.6, 0.0);

// Ghosted variants (semi-transparent)
const PINE_GHOST = (() => {
  const m = PINE_MAT.clone();
  m.transparent = true;
  m.opacity = 0.12;
  m.depthWrite = false;
  return m;
})();

const PLYWOOD_GHOST = (() => {
  const m = PLYWOOD_MAT.clone();
  m.transparent = true;
  m.opacity = 0.12;
  m.depthWrite = false;
  return m;
})();

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED GROUP — lerps position via useFrame
// ═══════════════════════════════════════════════════════════════════════════

interface AnimatedGroupProps {
  targetPos: [number, number, number];
  children: React.ReactNode;
  speed?: number;
}

function AnimatedGroup({ targetPos, children, speed = 0.04 }: AnimatedGroupProps) {
  const ref = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(...targetPos), [targetPos]);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.lerp(target, speed);
  });

  return <group ref={ref}>{children}</group>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PART PRIMITIVES — with visibility/ghost support
// ═══════════════════════════════════════════════════════════════════════════

function Lumber({
  position,
  size,
  vis,
}: {
  position: [number, number, number];
  size: [number, number, number];
  vis: PartVisibility;
}) {
  if (vis === "hidden") return null;
  const mat = vis === "ghosted" ? PINE_GHOST : PINE_MAT;
  return (
    <mesh position={position} material={mat} castShadow={vis === "visible"} receiveShadow={vis === "visible"}>
      <boxGeometry args={size} />
    </mesh>
  );
}

function PlywoodStrip({
  position,
  length,
  vis,
}: {
  position: [number, number, number];
  length: number;
  vis: PartVisibility;
}) {
  if (vis === "hidden") return null;
  const mat = vis === "ghosted" ? PLYWOOD_GHOST : PLYWOOD_MAT;
  return (
    <mesh position={position} material={mat} castShadow={vis === "visible"} receiveShadow={vis === "visible"}>
      <boxGeometry args={[RAIL_THICKNESS, RAIL_HEIGHT, length]} />
    </mesh>
  );
}

function Tote({
  position,
  bayW,
  toteType,
  vis,
}: {
  position: [number, number, number];
  bayW: number;
  toteType: ToteType;
  vis: PartVisibility;
}) {
  if (vis === "hidden") return null;
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  const color = toteType === "HDX" ? "#fbbf24" : "#ef4444";
  const bodyTopW = bayW - BIN_GAP * 2;
  const bodyBotW = bodyTopW * TOTE_BODY_TAPER;
  const bodyTopD = TOTE_DEPTH * 0.95;
  const bodyBotD = TOTE_DEPTH * 0.82;
  const alpha = vis === "ghosted" ? 0.12 : 1;

  const bodyGeo = useMemo(() => {
    const hw_t = bodyTopW / 2, hw_b = bodyBotW / 2;
    const hd_t = bodyTopD / 2, hd_b = bodyBotD / 2;
    const h = TOTE_BODY_H;
    const v = new Float32Array([
      -hw_b, 0, -hd_b, hw_b, 0, -hd_b, hw_b, 0, hd_b, -hw_b, 0, hd_b,
      -hw_t, h, -hd_t, hw_t, h, -hd_t, hw_t, h, hd_t, -hw_t, h, hd_t,
    ]);
    const idx = [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,2,3,7,2,7,6,0,4,7,0,7,3,1,2,6,1,6,5];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }, [bodyTopW, bodyBotW, bodyTopD, bodyBotD]);

  return (
    <group position={position}>
      <mesh geometry={bodyGeo} castShadow={vis === "visible"}>
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.55}
          metalness={0.02}
          side={THREE.DoubleSide}
          transparent={vis === "ghosted"}
          opacity={alpha}
          depthWrite={vis !== "ghosted"}
        />
      </mesh>
      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H / 2, 0]} castShadow={vis === "visible"}>
        <boxGeometry args={[toteW, TOTE_RIM_H, TOTE_DEPTH]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.05}
          transparent={vis === "ghosted"}
          opacity={alpha}
          depthWrite={vis !== "ghosted"}
        />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPLODED VIEW ENGINE
//
// Mode: "exploded" | "step"
// In "exploded" mode, all parts get explosion offsets.
// In "step" mode, parts animate to their final positions based on step.
// ═══════════════════════════════════════════════════════════════════════════

interface ExplodedAssemblyProps {
  cols: number;
  rows: number;
  toteType: ToteType;
  mode: "exploded" | "step";
  stepIndex: number; // 0-3
}

function ExplodedAssembly({ cols, rows, toteType, mode, stepIndex }: ExplodedAssemblyProps) {
  const bayW = getBayWidth(toteType);
  const totalW = cols * bayW + (cols + 1) * POST_W;
  const firstRailY = Math.max(MIN_FIRST_RAIL_Y, PLATE_H + 2);
  const lastRailY = firstRailY + (rows - 1) * TIER_SPACING;
  const topGap = 3;
  const frameH = PLATE_H + lastRailY + topGap + PLATE_H;
  const lift = CASTER_HEIGHT;
  const overallH = frameH + lift;

  const cx = totalW / 2;
  const cy = overallH / 2;
  const cz = RACK_DEPTH / 2;

  const railLen = RACK_DEPTH;
  const postH = frameH - PLATE_H * 2;

  // Current step data
  const step = ASSEMBLY_STEPS[stepIndex] ?? ASSEMBLY_STEPS[0];

  function vis(group: PartGroup): PartVisibility {
    if (mode === "exploded") return "visible";
    return step.partStates[group];
  }

  // Explosion offsets (inches) — only active in exploded mode
  const EX = mode === "exploded" ? 1 : 0;

  // Post explosion: spread outward on X
  const postExpX = 6 * EX;
  // Rail explosion: float away from posts on X
  const railExpX = 10 * EX;
  // Plate explosion: float up/down on Y
  const bottomPlateExpY = -8 * EX;
  const topPlateExpY = 8 * EX;
  // Tote explosion: hover in air
  const toteExpY = 18 * EX;
  const toteExpZ = 8 * EX;
  // Caster explosion: drop below
  const casterExpY = -10 * EX;

  // Step-specific animations
  const stepAnimations = useMemo(() => {
    if (mode !== "step") return { posts: [0,0,0], rails: [0,0,0], bp: [0,0,0], tp: [0,0,0] };
    switch (step.id) {
      case "cut-mark":
        // Lay everything flat on floor
        return { posts: [0, -lift - PLATE_H, 0], rails: [8, -lift - PLATE_H, 0], bp: [0,0,0], tp: [0,0,0] };
      case "ladders":
        return { posts: [0, 0, 0], rails: [0, 0, 0], bp: [0,0,0], tp: [0,0,0] };
      case "frame-assembly":
        return { posts: [0, 0, 0], rails: [0, 0, 0], bp: [0, 0, 0], tp: [0, 0, 0] };
      case "wheels-finish":
        return { posts: [0, 0, 0], rails: [0, 0, 0], bp: [0, 0, 0], tp: [0, 0, 0] };
      default:
        return { posts: [0,0,0], rails: [0,0,0], bp: [0,0,0], tp: [0,0,0] };
    }
  }, [mode, step.id, lift]);

  // Screw positions for rail-to-post connections
  const railScrewPositions = useMemo(() => {
    if (vis("screws") !== "visible") return [];
    const screws: { pos: [number, number, number]; rot: [number, number, number]; len: number; label: string }[] = [];

    if (step.id === "ladders" || mode === "exploded") {
      // Screws at rail-to-post junctions
      for (let i = 0; i <= cols; i++) {
        const px = getPostX(i, bayW);
        for (let r = 0; r < rows; r++) {
          const railY = PLATE_H + firstRailY + r * TIER_SPACING;
          // Right-face screws
          if (i < cols) {
            const sx = px + POST_W / 2 + RAIL_THICKNESS + 0.3;
            screws.push({
              pos: [sx, railY + lift, 2],
              rot: [0, 0, Math.PI / 2],
              len: 1.625,
              label: '#9 × 1-5/8" Star Drive Construction Screw',
            });
            screws.push({
              pos: [sx, railY + lift, RACK_DEPTH - 2],
              rot: [0, 0, Math.PI / 2],
              len: 1.625,
              label: '#9 × 1-5/8" Star Drive Construction Screw',
            });
          }
          // Left-face screws
          if (i > 0) {
            const sx = px - POST_W / 2 - RAIL_THICKNESS - 0.3;
            screws.push({
              pos: [sx, railY + lift, 2],
              rot: [0, 0, -Math.PI / 2],
              len: 1.625,
              label: '#9 × 1-5/8" Star Drive Construction Screw',
            });
            screws.push({
              pos: [sx, railY + lift, RACK_DEPTH - 2],
              rot: [0, 0, -Math.PI / 2],
              len: 1.625,
              label: '#9 × 1-5/8" Star Drive Construction Screw',
            });
          }
        }
      }
    }

    if (step.id === "frame-assembly" || mode === "exploded") {
      // Plate screws — angled into posts
      for (let i = 0; i <= cols; i++) {
        const px = getPostX(i, bayW);
        // Bottom plate screws
        screws.push({
          pos: [px, PLATE_H + lift + 0.5, POST_D / 2 + 1.5],
          rot: [0.5, 0, 0],
          len: 3.0,
          label: '#9 × 3" Star Drive Construction Screw',
        });
        screws.push({
          pos: [px, PLATE_H + lift + 0.5, RACK_DEPTH - POST_D / 2 - 1.5],
          rot: [-0.5, 0, 0],
          len: 3.0,
          label: '#9 × 3" Star Drive Construction Screw',
        });
        // Top plate screws
        screws.push({
          pos: [px, frameH - PLATE_H + lift - 0.5, POST_D / 2 + 1.5],
          rot: [-0.5, 0, 0],
          len: 3.0,
          label: '#9 × 3" Star Drive Construction Screw',
        });
        screws.push({
          pos: [px, frameH - PLATE_H + lift - 0.5, RACK_DEPTH - POST_D / 2 - 1.5],
          rot: [0.5, 0, 0],
          len: 3.0,
          label: '#9 × 3" Star Drive Construction Screw',
        });
      }
    }

    return screws;
  }, [cols, rows, bayW, firstRailY, lift, frameH, mode, step.id]);

  return (
    <group scale={[S, S, S]}>
      <group position={[-cx, -cy, -cz]}>

        {/* ── WOOD FRAME ── */}
        <group position={[0, lift, 0]}>

          {/* Bottom plates */}
          <AnimatedGroup targetPos={[0, bottomPlateExpY + (stepAnimations.bp[1] as number), 0]}>
            <Lumber position={[totalW / 2, PLATE_H / 2, POST_D / 2]} size={[totalW, PLATE_H, POST_D]} vis={vis("bottomPlates")} />
            <Lumber position={[totalW / 2, PLATE_H / 2, RACK_DEPTH - POST_D / 2]} size={[totalW, PLATE_H, POST_D]} vis={vis("bottomPlates")} />
          </AnimatedGroup>

          {/* Top plates */}
          <AnimatedGroup targetPos={[0, topPlateExpY + (stepAnimations.tp[1] as number), 0]}>
            <Lumber position={[totalW / 2, frameH - PLATE_H / 2, POST_D / 2]} size={[totalW, PLATE_H, POST_D]} vis={vis("topPlates")} />
            <Lumber position={[totalW / 2, frameH - PLATE_H / 2, RACK_DEPTH - POST_D / 2]} size={[totalW, PLATE_H, POST_D]} vis={vis("topPlates")} />
          </AnimatedGroup>

          {/* Plywood top */}
          <AnimatedGroup targetPos={[0, topPlateExpY + 4 * EX, 0]}>
            {vis("plyTop") !== "hidden" && (
              <mesh
                position={[totalW / 2, frameH + PLY_TOP_H / 2, RACK_DEPTH / 2]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[totalW + 2, PLY_TOP_H, RACK_DEPTH + 2]} />
                <meshStandardMaterial
                  color="#D4B896"
                  roughness={0.6}
                  metalness={0.0}
                  transparent={vis("plyTop") === "ghosted"}
                  opacity={vis("plyTop") === "ghosted" ? 0.12 : 1}
                  depthWrite={vis("plyTop") !== "ghosted"}
                />
              </mesh>
            )}
          </AnimatedGroup>

          {/* Ladder frames: posts + rails */}
          {Array.from({ length: cols + 1 }).map((_, i) => {
            const px = getPostX(i, bayW);
            const isLeft = i === 0;
            const isRight = i === cols;
            // Explosion: first post shifts left, last shifts right, middle stays
            const expDir = isLeft ? -1 : isRight ? 1 : 0;

            return (
              <group key={`ladder-${i}`}>
                {/* Posts */}
                <AnimatedGroup
                  targetPos={[
                    postExpX * expDir + (stepAnimations.posts[0] as number),
                    stepAnimations.posts[1] as number,
                    0,
                  ]}
                >
                  <Lumber position={[px, PLATE_H + postH / 2, POST_D / 2]} size={[POST_W, postH, POST_D]} vis={vis("posts")} />
                  <Lumber position={[px, PLATE_H + postH / 2, RACK_DEPTH - POST_D / 2]} size={[POST_W, postH, POST_D]} vis={vis("posts")} />
                </AnimatedGroup>

                {/* Right-face rails */}
                {i < cols &&
                  Array.from({ length: rows }).map((_, r) => {
                    const railY = PLATE_H + firstRailY + r * TIER_SPACING;
                    const railX = px + POST_W / 2 + RAIL_THICKNESS / 2;
                    return (
                      <AnimatedGroup
                        key={`rr-${i}-${r}`}
                        targetPos={[
                          railExpX + (stepAnimations.rails[0] as number),
                          stepAnimations.rails[1] as number,
                          0,
                        ]}
                      >
                        <PlywoodStrip position={[railX, railY, RACK_DEPTH / 2]} length={railLen} vis={vis("rails")} />
                      </AnimatedGroup>
                    );
                  })}

                {/* Left-face rails */}
                {i > 0 &&
                  Array.from({ length: rows }).map((_, r) => {
                    const railY = PLATE_H + firstRailY + r * TIER_SPACING;
                    const railX = px - POST_W / 2 - RAIL_THICKNESS / 2;
                    return (
                      <AnimatedGroup
                        key={`rl-${i}-${r}`}
                        targetPos={[
                          -railExpX + (stepAnimations.rails[0] as number),
                          stepAnimations.rails[1] as number,
                          0,
                        ]}
                      >
                        <PlywoodStrip position={[railX, railY, RACK_DEPTH / 2]} length={railLen} vis={vis("rails")} />
                      </AnimatedGroup>
                    );
                  })}
              </group>
            );
          })}

          {/* Totes */}
          {Array.from({ length: cols }).map((_, c) => {
            const leftPostX = getPostX(c, bayW);
            const rightPostX = getPostX(c + 1, bayW);
            const bayCenterX = (leftPostX + rightPostX) / 2;

            return Array.from({ length: rows }).map((_, r) => {
              const railCenterY = PLATE_H + firstRailY + r * TIER_SPACING;
              const railTop = railCenterY + RAIL_HEIGHT / 2;
              const toteGroupY = railTop - TOTE_BODY_H;

              return (
                <AnimatedGroup
                  key={`tote-${c}-${r}`}
                  targetPos={[0, toteExpY, toteExpZ * (r % 2 === 0 ? 1 : -1)]}
                >
                  <Tote
                    position={[bayCenterX, toteGroupY, RACK_DEPTH / 2]}
                    bayW={bayW}
                    toteType={toteType}
                    vis={vis("totes")}
                  />
                </AnimatedGroup>
              );
            });
          })}
        </group>

        {/* ── CASTERS ── */}
        {(() => {
          const casterVis = vis("casters");
          if (casterVis === "hidden") return null;
          const firstPostX = getPostX(0, bayW);
          const lastPostX = getPostX(cols, bayW);
          // In ghosted mode, we still show them but dim
          const opacity = casterVis === "ghosted" ? 0.15 : 1;
          return (
            <AnimatedGroup targetPos={[0, casterExpY, 0]}>
              <group>
                {opacity < 1 ? (
                  // Ghosted casters — simplified placeholder
                  <>
                    {[[firstPostX, POST_D / 2], [lastPostX, POST_D / 2],
                      [firstPostX, RACK_DEPTH - POST_D / 2], [lastPostX, RACK_DEPTH - POST_D / 2],
                    ].map(([x, z], i) => (
                      <mesh key={`ghost-caster-${i}`} position={[x, CASTER_HEIGHT / 2, z]}>
                        <boxGeometry args={[3, CASTER_HEIGHT, 3]} />
                        <meshStandardMaterial color="#888" transparent opacity={opacity} depthWrite={false} />
                      </mesh>
                    ))}
                  </>
                ) : (
                  <>
                    <IndustrialCaster position={[firstPostX, 0, POST_D / 2]} />
                    <IndustrialCaster position={[lastPostX, 0, POST_D / 2]} />
                    <IndustrialCaster position={[firstPostX, 0, RACK_DEPTH - POST_D / 2]} />
                    <IndustrialCaster position={[lastPostX, 0, RACK_DEPTH - POST_D / 2]} />
                  </>
                )}
              </group>
            </AnimatedGroup>
          );
        })()}

        {/* ── SCREWS ── */}
        {railScrewPositions.map((s, i) => (
          <ConstructionScrew
            key={`screw-${i}`}
            position={s.pos}
            rotation={s.rot}
            length={s.len}
            label={s.label}
            visible={true}
          />
        ))}
      </group>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMERA RIG — adapts to step camera hints
// ═══════════════════════════════════════════════════════════════════════════

function GuideCameraRig({
  cols,
  rows,
  toteType,
  cameraHint,
}: {
  cols: number;
  rows: number;
  toteType: ToteType;
  cameraHint?: string;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const bayW = getBayWidth(toteType);
  const totalW = cols * bayW + (cols + 1) * POST_W;
  const firstRailY = Math.max(MIN_FIRST_RAIL_Y, PLATE_H + 2);
  const lastRailY = firstRailY + (rows - 1) * TIER_SPACING;
  const frameH = PLATE_H + lastRailY + 3 + PLATE_H;
  const overallH = frameH + CASTER_HEIGHT;

  const sw = totalW * S;
  const sh = overallH * S;
  const sd = RACK_DEPTH * S;
  const maxDim = Math.max(sw, sh, sd);
  const dist = maxDim * 2.8;

  useEffect(() => {
    let px: number, py: number, pz: number;
    switch (cameraHint) {
      case "side":
        px = dist * 1.4; py = dist * 0.5; pz = dist * 0.3;
        break;
      case "front":
        px = dist * 0.2; py = dist * 0.5; pz = dist * 1.4;
        break;
      case "bottom":
        px = dist * 0.8; py = -dist * 0.3; pz = dist * 1.0;
        break;
      default:
        px = dist * 0.9; py = dist * 0.65; pz = dist * 1.1;
    }
    camera.position.set(px, py, pz);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, dist, cameraHint]);

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
      maxPolarAngle={Math.PI * 0.85}
      minDistance={0.15}
      maxDistance={dist * 5}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP CARD — floating UI panel
// ═══════════════════════════════════════════════════════════════════════════

function StepCard({
  step,
  stepIndex,
  totalSteps,
  cols,
  rows,
  onNext,
  onPrev,
  onReset,
}: {
  step: AssemblyStep;
  stepIndex: number;
  totalSteps: number;
  cols: number;
  rows: number;
  onNext: () => void;
  onPrev: () => void;
  onReset: () => void;
}) {
  const materials = computeMaterials(step, cols, rows);
  const isLast = stepIndex === totalSteps - 1;

  return (
    <div className="flex h-full flex-col">
      {/* Step header */}
      <div className="border-b border-slate-700 px-5 py-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-gray-950">
            {stepIndex + 1}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Step {stepIndex + 1} of {totalSteps}
          </span>
        </div>
        <h3 className="text-lg font-extrabold text-white">{step.title}</h3>
      </div>

      {/* Instruction */}
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="flex items-start gap-2">
          <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
          <p className="text-sm leading-relaxed text-stone-300">
            {step.instruction}
          </p>
        </div>
      </div>

      {/* Screw callout */}
      {step.screwType && (
        <div className="border-b border-slate-800 px-5 py-3">
          <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
              Fastener
            </p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {step.screwType.label}
            </p>
            <p className="text-[11px] text-stone-400">
              {step.screwType.description}
            </p>
          </div>
        </div>
      )}

      {/* Material checklist */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-yellow-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Materials for this step
          </span>
        </div>
        <ul className="space-y-1.5">
          {materials.map((m, i) => (
            <li
              key={i}
              className="flex items-center gap-2.5 rounded-lg bg-slate-800/60 px-3 py-2"
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{m.name}</p>
                <p className="text-[10px] text-stone-500">{m.detail}</p>
              </div>
              <span className="font-mono text-sm font-bold text-yellow-400">
                ×{m.qty}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Navigation */}
      <div className="border-t border-slate-700 px-5 py-4">
        <div className="flex gap-2">
          {stepIndex > 0 ? (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 rounded-lg border border-slate-600 px-4 py-2.5 text-xs font-bold uppercase text-stone-300 transition-colors hover:border-stone-400 hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
          ) : (
            <button
              onClick={onReset}
              className="flex items-center gap-1 rounded-lg border border-slate-600 px-4 py-2.5 text-xs font-bold uppercase text-stone-300 transition-colors hover:border-stone-400 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Exploded
            </button>
          )}
          <button
            onClick={isLast ? onReset : onNext}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
          >
            {isLast ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                Restart
              </>
            ) : (
              <>
                Next Step
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — AssemblyGuide
// ═══════════════════════════════════════════════════════════════════════════

interface AssemblyGuideProps {
  cols: number;
  rows: number;
  toteType: ToteType;
  onClose?: () => void;
}

export default function AssemblyGuide({
  cols,
  rows,
  toteType,
  onClose,
}: AssemblyGuideProps) {
  const [mode, setMode] = useState<"exploded" | "step">("exploded");
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = ASSEMBLY_STEPS[stepIndex];

  const handleStartBuild = useCallback(() => {
    setMode("step");
    setStepIndex(0);
  }, []);

  const handleNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, ASSEMBLY_STEPS.length - 1));
  }, []);

  const handlePrev = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleReset = useCallback(() => {
    setMode("exploded");
    setStepIndex(0);
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 lg:flex-row">
      {/* ── 3D Viewport ─────────────────────────────────────────────── */}
      <div className="relative flex-1" style={{ minHeight: "400px" }}>
        <Canvas
          shadows
          camera={{ fov: 40 }}
          gl={{ antialias: true, alpha: false }}
          style={{ touchAction: "none" }}
        >
          <color attach="background" args={["#ffffff"]} />

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

          <GuideCameraRig
            cols={cols}
            rows={rows}
            toteType={toteType}
            cameraHint={mode === "step" ? currentStep?.cameraHint : "overview"}
          />

          <ExplodedAssembly
            cols={cols}
            rows={rows}
            toteType={toteType}
            mode={mode}
            stepIndex={stepIndex}
          />
        </Canvas>

        {/* Overlay: Exploded mode "Start Build" button */}
        {mode === "exploded" && (
          <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
            <button
              onClick={handleStartBuild}
              className="pointer-events-auto flex items-center gap-2.5 rounded-2xl bg-yellow-400 px-8 py-4 text-base font-extrabold uppercase tracking-wider text-gray-950 shadow-2xl shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:-translate-y-1 hover:shadow-yellow-400/50 animate-pulse"
            >
              <Play className="h-5 w-5" />
              Start Build
            </button>
          </div>
        )}

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-slate-900/80 p-2 text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Exploded mode label */}
        {mode === "exploded" && (
          <div className="absolute left-4 top-4">
            <div className="rounded-lg bg-slate-900/80 px-4 py-2 backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                Exploded View
              </p>
              <p className="text-xs text-stone-400">
                {cols}×{rows} Unit — Hover screws for details
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Step Card Panel (visible in step mode) ────────────────── */}
      {mode === "step" && currentStep && (
        <aside className="w-full shrink-0 border-t border-slate-700 bg-slate-900 lg:w-[340px] lg:border-l lg:border-t-0">
          <StepCard
            step={currentStep}
            stepIndex={stepIndex}
            totalSteps={ASSEMBLY_STEPS.length}
            cols={cols}
            rows={rows}
            onNext={handleNext}
            onPrev={handlePrev}
            onReset={handleReset}
          />
        </aside>
      )}
    </div>
  );
}
