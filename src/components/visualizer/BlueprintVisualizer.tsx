"use client";

// ═══════════════════════════════════════════════════════════════════════════
// BLUEPRINT VISUALIZER — Step-by-Step 3D Snapshot Engine
//
// Renders isolated phases of the storage unit build using a hidden WebGL
// canvas and captures high-res JPEG images of each assembly step.
//
// Steps:
//   1. Base Frame (bottom plates + casters)
//   2. Uprights (base + vertical 2×4 posts)
//   3. Horizontal Rails (base + uprights + plywood rail strips)
//   4. Complete Unit (everything + plywood top if applicable)
//
// Each step is rendered at an isometric camera angle, then captured via
// canvas.toDataURL(). The resulting image URLs are stored in state and
// passed to the PDF generator.
//
// This component re-uses the same geometry constants and material system
// as Rack3D.tsx for pixel-perfect accuracy.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Stage } from "@react-three/drei";
import * as THREE from "three";
import IndustrialCaster, { CASTER_HEIGHT } from "./IndustrialCaster";
import {
  createDougFirMaterial,
  createPlywoodMaterial,
  createPlywoodTopMaterial,
} from "./woodTextures";

// ── Types ──────────────────────────────────────────────────────────────

export interface BlueprintConfig {
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  unitType: "standard" | "mini";
  orientation: "standard" | "sideways";
  hasWheels: boolean;
  hasTop: boolean;
  hasTotes: boolean;
  totalW: number;
  totalH: number;
  depth: number;
  /** Installer context (optional — carried through for PDF branding) */
  installerId?: string;
  installerSlug?: string | null;
  installerPhone?: string | null;
  installerName?: string;
}

export interface BuildStep {
  id: string;
  title: string;
  description: string;
  /** Which part groups are visible in this step */
  visible: {
    bottomPlates: boolean;
    topPlates: boolean;
    posts: boolean;
    rails: boolean;
    casters: boolean;
    plyTop: boolean;
    totes: boolean;
  };
}

// ── Constants (mirror Rack3D.tsx exactly) ───────────────────────────────

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
const TOTE_BODY_H = 11.0;

const SIDEWAYS_SLOT_W = 30.25;
const SIDEWAYS_DEPTH = 20;

const MINI_SLOT_W = 8.25;
const MINI_TIER_SPACING = 7;
const MINI_FIRST_RAIL_H = 5.25;
const MINI_DEPTH = 12.75;
const MINI_RAIL_HEIGHT = 1.0;

const S = 1 / 48;

function getBayWidth(
  toteType: "HDX" | "GM",
  unitType: "standard" | "mini",
  orientation: "standard" | "sideways"
): number {
  if (unitType === "mini") return MINI_SLOT_W;
  if (orientation === "sideways") return SIDEWAYS_SLOT_W;
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  return toteW - 2 * BIN_LIP_WIDTH + 2 * BIN_GAP;
}

function getPostX(i: number, bayW: number): number {
  return i * (bayW + POST_W) + POST_W / 2;
}

function getUnitDepth(
  unitType: "standard" | "mini",
  orientation: "standard" | "sideways"
): number {
  if (unitType === "mini") return MINI_DEPTH;
  if (orientation === "sideways") return SIDEWAYS_DEPTH;
  return RACK_DEPTH;
}

function getTierSpacing(unitType: "standard" | "mini"): number {
  return unitType === "mini" ? MINI_TIER_SPACING : TIER_SPACING;
}

function getFirstRailY(unitType: "standard" | "mini"): number {
  if (unitType === "mini") return MINI_FIRST_RAIL_H;
  const MIN_FIRST_RAIL_Y = TOTE_BODY_H - RAIL_HEIGHT / 2 + 2;
  return Math.max(MIN_FIRST_RAIL_Y, PLATE_H + 2);
}

function getRailHeight(unitType: "standard" | "mini"): number {
  return unitType === "mini" ? MINI_RAIL_HEIGHT : RAIL_HEIGHT;
}

// ── Materials ──────────────────────────────────────────────────────────

const PINE_MAT = createDougFirMaterial(42);
const PLYWOOD_MAT = createPlywoodMaterial(137);
const PLYWOOD_TOP_MAT = createPlywoodTopMaterial(250);

// ── Build Steps ────────────────────────────────────────────────────────

export function getBuildSteps(config: BlueprintConfig): BuildStep[] {
  const steps: BuildStep[] = [
    {
      id: "base-frame",
      title: "Step 1: Base Frame",
      description:
        "Assemble the bottom 2×4 plates (front and back). If your unit has casters, mount them now while the frame is still on its side.",
      visible: {
        bottomPlates: true,
        topPlates: false,
        posts: false,
        rails: false,
        casters: config.hasWheels,
        plyTop: false,
        totes: false,
      },
    },
    {
      id: "uprights",
      title: "Step 2: Uprights",
      description:
        "Attach all vertical 2×4 upright posts to the bottom plates. Space them at the exact tote-width opening between each post pair.",
      visible: {
        bottomPlates: true,
        topPlates: false,
        posts: true,
        rails: false,
        casters: config.hasWheels,
        plyTop: false,
        totes: false,
      },
    },
    {
      id: "rails",
      title: "Step 3: Plywood Rails",
      description:
        "Screw plywood rail strips to the inside faces of each post pair, forming the ladder frames that support the totes.",
      visible: {
        bottomPlates: true,
        topPlates: true,
        posts: true,
        rails: true,
        casters: config.hasWheels,
        plyTop: false,
        totes: false,
      },
    },
    {
      id: "complete",
      title: "Step 4: Complete Assembly",
      description: config.hasTop
        ? "Attach top plates, plywood worktop, and load totes. Stand the unit upright and verify level."
        : "Attach top plates and load totes. Stand the unit upright and verify level.",
      visible: {
        bottomPlates: true,
        topPlates: true,
        posts: true,
        rails: true,
        casters: config.hasWheels,
        plyTop: config.hasTop,
        totes: config.hasTotes,
      },
    },
  ];

  return steps;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3D Scene — Renders a single build step
// ═══════════════════════════════════════════════════════════════════════════

function Lumber({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh position={position} material={PINE_MAT} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function PlywoodStrip({
  position,
  length,
  railHeight,
}: {
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

/** Simplified tote for blueprint visualization (no ribs/grid detail) */
function SimpleTote({
  position,
  bayW,
  unitDepth,
}: {
  position: [number, number, number];
  bayW: number;
  unitDepth: number;
}) {
  const bodyW = bayW - BIN_GAP * 2;
  const rimW = bodyW + 2;
  return (
    <group position={position}>
      {/* Body */}
      <mesh position={[0, TOTE_BODY_H / 2, 0]} castShadow>
        <boxGeometry args={[bodyW, TOTE_BODY_H, unitDepth * 0.9]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.35} />
      </mesh>
      {/* Lid */}
      <mesh position={[0, TOTE_BODY_H + 0.5, 0]} castShadow>
        <boxGeometry args={[rimW, 1, unitDepth * 0.92]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.25} />
      </mesh>
    </group>
  );
}

function BlueprintScene({
  config,
  step,
}: {
  config: BlueprintConfig;
  step: BuildStep;
}) {
  const isMini = config.unitType === "mini";
  const bayW = getBayWidth(config.toteType, config.unitType, config.orientation);
  const totalW = config.cols * bayW + (config.cols + 1) * POST_W;
  const unitDepth = getUnitDepth(config.unitType, config.orientation);
  const railHeight = getRailHeight(config.unitType);
  const tierSpacing = getTierSpacing(config.unitType);
  const firstRailY = getFirstRailY(config.unitType);
  const lastRailY = firstRailY + (config.rows - 1) * tierSpacing;

  let frameH: number;
  if (isMini) {
    frameH = PLATE_H + lastRailY + 2 + PLY_TOP_H;
  } else {
    const topGap = 3;
    frameH = PLATE_H + lastRailY + topGap + PLATE_H;
  }

  const lift = config.hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + lift;
  const cx = totalW / 2;
  const cy = overallH / 2;
  const cz = unitDepth / 2;
  const railLen = unitDepth;
  const postH = isMini ? lastRailY + 2 : frameH - PLATE_H * 2;

  const v = step.visible;

  return (
    <group scale={[S, S, S]}>
      <group position={[cx, -cy, -cz]} scale={[-1, 1, 1]}>
        <group position={[0, lift, 0]}>
          {/* Bottom plates */}
          {v.bottomPlates && (
            <>
              <Lumber
                position={[totalW / 2, PLATE_H / 2, POST_D / 2]}
                size={[totalW, PLATE_H, POST_D]}
              />
              <Lumber
                position={[
                  totalW / 2,
                  PLATE_H / 2,
                  unitDepth - POST_D / 2,
                ]}
                size={[totalW, PLATE_H, POST_D]}
              />
            </>
          )}

          {/* Top plates */}
          {v.topPlates && !isMini && (
            <>
              <Lumber
                position={[
                  totalW / 2,
                  frameH - PLATE_H / 2,
                  POST_D / 2,
                ]}
                size={[totalW, PLATE_H, POST_D]}
              />
              <Lumber
                position={[
                  totalW / 2,
                  frameH - PLATE_H / 2,
                  unitDepth - POST_D / 2,
                ]}
                size={[totalW, PLATE_H, POST_D]}
              />
            </>
          )}

          {/* Upright posts */}
          {v.posts &&
            Array.from({ length: config.cols + 1 }).map((_, i) => {
              const px = getPostX(i, bayW);
              return (
                <group key={`post-${i}`}>
                  <Lumber
                    position={[
                      px,
                      PLATE_H + postH / 2,
                      POST_D / 2,
                    ]}
                    size={[POST_W, postH, POST_D]}
                  />
                  <Lumber
                    position={[
                      px,
                      PLATE_H + postH / 2,
                      unitDepth - POST_D / 2,
                    ]}
                    size={[POST_W, postH, POST_D]}
                  />
                </group>
              );
            })}

          {/* Plywood rails */}
          {v.rails &&
            Array.from({ length: config.cols + 1 }).map((_, i) => {
              const px = getPostX(i, bayW);
              return (
                <group key={`rail-group-${i}`}>
                  {/* Right-face rails */}
                  {i < config.cols &&
                    Array.from({ length: config.rows }).map((_, r) => {
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
                  {/* Left-face rails */}
                  {i > 0 &&
                    Array.from({ length: config.rows }).map((_, r) => {
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

          {/* Plywood top */}
          {v.plyTop && (
            <mesh
              position={[
                totalW / 2,
                isMini
                  ? PLATE_H + postH + PLY_TOP_H / 2
                  : frameH + PLY_TOP_H / 2,
                unitDepth / 2,
              ]}
              material={PLYWOOD_TOP_MAT}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[totalW, PLY_TOP_H, unitDepth]} />
            </mesh>
          )}

          {/* Simplified totes */}
          {v.totes &&
            Array.from({ length: config.cols }).map((_, c) => {
              const leftPostX = getPostX(c, bayW);
              const rightPostX = getPostX(c + 1, bayW);
              const bayCenterX = (leftPostX + rightPostX) / 2;
              return Array.from({ length: config.rows }).map((_, r) => {
                const railCenterY = PLATE_H + firstRailY + r * tierSpacing;
                const railTop = railCenterY + railHeight / 2;
                const toteGroupY = railTop - TOTE_BODY_H;
                return (
                  <SimpleTote
                    key={`tote-${c}-${r}`}
                    position={[bayCenterX, toteGroupY, unitDepth / 2]}
                    bayW={bayW}
                    unitDepth={unitDepth}
                  />
                );
              });
            })}
        </group>

        {/* Casters */}
        {v.casters && (
          <>
            <IndustrialCaster position={[POST_W / 2, 0, POST_D / 2]} />
            <IndustrialCaster
              position={[totalW - POST_W / 2, 0, POST_D / 2]}
            />
            <IndustrialCaster
              position={[POST_W / 2, 0, unitDepth - POST_D / 2]}
            />
            <IndustrialCaster
              position={[
                totalW - POST_W / 2,
                0,
                unitDepth - POST_D / 2,
              ]}
            />
          </>
        )}
      </group>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Isometric Camera — fixed angle, no orbit controls
// ═══════════════════════════════════════════════════════════════════════════

function IsometricCamera({
  config,
}: {
  config: BlueprintConfig;
}) {
  const { camera } = useThree();

  useEffect(() => {
    // Position camera at a consistent isometric angle
    const bayW = getBayWidth(config.toteType, config.unitType, config.orientation);
    const totalW = config.cols * bayW + (config.cols + 1) * POST_W;
    const unitDepth = getUnitDepth(config.unitType, config.orientation);
    const maxDim = Math.max(totalW, unitDepth) * S;

    const dist = maxDim * 2.8;
    camera.position.set(dist * 0.8, dist * 0.7, dist * 0.9);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, config]);

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Snapshot Capture — captures one frame then resolves
// ═══════════════════════════════════════════════════════════════════════════

function SnapshotCapture({
  onCapture,
}: {
  onCapture: (dataUrl: string) => void;
}) {
  const { gl, scene, camera } = useThree();
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;

    // Wait 2 frames for materials/geometry to settle
    let frameCount = 0;
    const id = setInterval(() => {
      frameCount++;
      if (frameCount >= 3) {
        clearInterval(id);
        gl.render(scene, camera);
        const dataUrl = gl.domElement.toDataURL("image/jpeg", 0.92);
        captured.current = true;
        onCapture(dataUrl);
      }
    }, 100);

    return () => clearInterval(id);
  }, [gl, scene, camera, onCapture]);

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component — orchestrates step-by-step rendering + capture
// ═══════════════════════════════════════════════════════════════════════════

export interface BlueprintSnapshotResult {
  stepId: string;
  title: string;
  description: string;
  imageDataUrl: string;
}

interface BlueprintVisualizerProps {
  config: BlueprintConfig;
  onComplete: (snapshots: BlueprintSnapshotResult[]) => void;
  /** Canvas size for rendering (higher = better quality) */
  width?: number;
  height?: number;
}

export default function BlueprintVisualizer({
  config,
  onComplete,
  width = 1200,
  height = 900,
}: BlueprintVisualizerProps) {
  const steps = useMemo(() => getBuildSteps(config), [config]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const results = useRef<BlueprintSnapshotResult[]>([]);
  const completed = useRef(false);

  const handleCapture = useCallback(
    (dataUrl: string) => {
      if (completed.current) return;

      const step = steps[currentStepIdx];
      results.current.push({
        stepId: step.id,
        title: step.title,
        description: step.description,
        imageDataUrl: dataUrl,
      });

      if (currentStepIdx + 1 < steps.length) {
        setCurrentStepIdx((prev) => prev + 1);
      } else {
        completed.current = true;
        onComplete(results.current);
      }
    },
    [currentStepIdx, steps, onComplete]
  );

  const currentStep = steps[currentStepIdx];

  if (completed.current) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: -9999,
        top: -9999,
        width,
        height,
        overflow: "hidden",
        pointerEvents: "none",
      }}
      aria-hidden
    >
      <Canvas
        key={currentStep.id}
        shadows
        camera={{ fov: 45 }}
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          alpha: false,
        }}
        style={{ width, height, background: "#f8f9fa" }}
      >
        <color attach="background" args={["#f8f9fa"]} />
        <ambientLight intensity={0.85} />
        <directionalLight
          position={[12, 18, 12]}
          intensity={1.0}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight position={[-10, 12, -8]} intensity={0.5} />
        <hemisphereLight args={["#ffffff", "#f5ead6", 0.5]} />

        <ContactShadows
          position={[0, -0.001, 0]}
          opacity={0.2}
          scale={10}
          blur={2.5}
          far={4}
        />

        <IsometricCamera config={config} />

        <Stage intensity={0.6} environment={null} adjustCamera={false}>
          <BlueprintScene config={config} step={currentStep} />
        </Stage>

        <SnapshotCapture onCapture={handleCapture} />
      </Canvas>
    </div>
  );
}
