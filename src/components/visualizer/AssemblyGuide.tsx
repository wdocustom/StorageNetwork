"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Html } from "@react-three/drei";
import { MeshStandardMaterial, Color, Group, Vector3 } from "three";
import IndustrialCaster, { CASTER_HEIGHT } from "./IndustrialCaster";
import ConstructionScrew from "./ConstructionScrew";
import {
  getStepsForConfig,
  computeMaterials,
  resolveTokens,
  type AssemblyStep,
  type PartGroup,
  type PartVisibility,
  type BuildConfig,
} from "./assemblySteps";
import { toFraction } from "@/lib/utils";
import {
  ChevronRight,
  ChevronLeft,
  Play,
  RotateCcw,
  Wrench,
  CheckCircle2,
  Package,
  Lightbulb,
  Hammer,
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

const S = 1 / 48; // Inches-to-scene scale factor

function getBayWidth(toteType: ToteType): number {
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  return toteW - 2 * BIN_LIP_WIDTH + 2 * BIN_GAP;
}

function getPostX(i: number, bayW: number): number {
  return i * (bayW + POST_W) + POST_W / 2;
}

const MIN_FIRST_RAIL_Y = 13; // First rail at 13" from bottom of upright

// ═══════════════════════════════════════════════════════════════════════════
// MATERIALS
// ═══════════════════════════════════════════════════════════════════════════

function makeMat(color: string, roughness: number, metalness: number) {
  return new MeshStandardMaterial({
    color: new Color(color),
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
// ANIMATED GROUP — lerps position via useFrame with opacity fade
// ═══════════════════════════════════════════════════════════════════════════

interface AnimatedGroupProps {
  targetPos: [number, number, number];
  children: React.ReactNode;
  speed?: number;
}

function AnimatedGroup({ targetPos, children, speed = 0.06 }: AnimatedGroupProps) {
  const ref = useRef<Group>(null);
  const target = useMemo(() => new Vector3(...targetPos), [targetPos]);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.lerp(target, speed);
  });

  return <group ref={ref}>{children}</group>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED ROTATION — lerps rotation via useFrame for smooth tipping
// ═══════════════════════════════════════════════════════════════════════════

function AnimatedRotation({
  targetRot,
  children,
  speed = 0.08,
}: {
  targetRot: [number, number, number];
  children: React.ReactNode;
  speed?: number;
}) {
  const ref = useRef<Group>(null);
  const target = useRef(new Vector3(...targetRot));

  useEffect(() => {
    target.current.set(...targetRot);
  }, [targetRot[0], targetRot[1], targetRot[2]]);

  useFrame(() => {
    if (!ref.current) return;
    const r = ref.current.rotation;
    r.x += (target.current.x - r.x) * speed;
    r.y += (target.current.y - r.y) * speed;
    r.z += (target.current.z - r.z) * speed;
  });

  return <group ref={ref}>{children}</group>;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOVERABLE PART WRAPPER — shows dimensions/material on hover
// ═══════════════════════════════════════════════════════════════════════════

function HoverablePart({
  children,
  label,
  position,
  visible = true,
}: {
  children: React.ReactNode;
  label: string;
  position?: [number, number, number];
  visible?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  if (!visible) return <>{children}</>;

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {children}
      {hovered && (
        <Html center position={[0, 2, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              color: "#fbbf24",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "11px",
              fontWeight: 700,
              whiteSpace: "normal",
              border: "1px solid rgba(251, 191, 36, 0.3)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
              maxWidth: "280px",
              width: "max-content",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PART PRIMITIVES — with visibility/ghost support + hover labels
// ═══════════════════════════════════════════════════════════════════════════

function Lumber({
  position,
  size,
  vis,
  label,
}: {
  position: [number, number, number];
  size: [number, number, number];
  vis: PartVisibility;
  label?: string;
}) {
  if (vis === "hidden") return null;
  const mat = vis === "ghosted" ? PINE_GHOST : PINE_MAT;
  const mesh = (
    <mesh position={position} material={mat} castShadow={vis === "visible"} receiveShadow={vis === "visible"}>
      <boxGeometry args={size} />
    </mesh>
  );

  if (label && vis === "visible") {
    return (
      <HoverablePart label={label} position={position}>
        <mesh material={mat} castShadow receiveShadow>
          <boxGeometry args={size} />
        </mesh>
      </HoverablePart>
    );
  }

  return mesh;
}

function PlywoodStrip({
  position,
  length,
  vis,
  label,
}: {
  position: [number, number, number];
  length: number;
  vis: PartVisibility;
  label?: string;
}) {
  if (vis === "hidden") return null;
  const mat = vis === "ghosted" ? PLYWOOD_GHOST : PLYWOOD_MAT;
  const mesh = (
    <mesh position={position} material={mat} castShadow={vis === "visible"} receiveShadow={vis === "visible"}>
      <boxGeometry args={[RAIL_THICKNESS, RAIL_HEIGHT, length]} />
    </mesh>
  );

  if (label && vis === "visible") {
    return (
      <HoverablePart label={label} position={position}>
        <mesh material={mat} castShadow receiveShadow>
          <boxGeometry args={[RAIL_THICKNESS, RAIL_HEIGHT, length]} />
        </mesh>
      </HoverablePart>
    );
  }

  return mesh;
}

// ═══════════════════════════════════════════════════════════════════════════
// FADE MANAGER — handles opacity transitions between steps
// ═══════════════════════════════════════════════════════════════════════════

function FadeGroup({
  vis,
  children,
}: {
  vis: PartVisibility;
  children: React.ReactNode;
}) {
  const ref = useRef<Group>(null);
  const targetOpacity = vis === "visible" ? 1 : vis === "ghosted" ? 0.12 : 0;
  const currentOpacity = useRef(targetOpacity);

  useFrame(() => {
    currentOpacity.current += (targetOpacity - currentOpacity.current) * 0.08;
    if (!ref.current) return;
    ref.current.visible = currentOpacity.current > 0.01;
  });

  if (vis === "hidden") return null;

  return <group ref={ref}>{children}</group>;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPLODED VIEW ENGINE v2
//
// Mode: "exploded" | "step"
// In "exploded" mode, all parts get explosion offsets.
// In "step" mode, parts animate to positions based on step with fades.
// ═══════════════════════════════════════════════════════════════════════════

interface ExplodedAssemblyProps {
  cols: number;
  rows: number;
  toteType: ToteType;
  mode: "exploded" | "step";
  stepIndex: number;
  steps: AssemblyStep[];
  hasWheels: boolean;
  hasTop: boolean;
}

function ExplodedAssembly({
  cols,
  rows,
  toteType,
  mode,
  stepIndex,
  steps,
  hasWheels,
  hasTop,
}: ExplodedAssemblyProps) {
  const bayW = getBayWidth(toteType);
  const totalW = cols * bayW + (cols + 1) * POST_W;
  const firstRailY = Math.max(MIN_FIRST_RAIL_Y, PLATE_H + 2);
  const lastRailY = firstRailY + (rows - 1) * TIER_SPACING;
  const topGap = 3;
  const frameH = PLATE_H + lastRailY + topGap + PLATE_H;
  const lift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + lift;
  const uprightH = rows * TIER_SPACING;

  const cx = totalW / 2;
  const cy = overallH / 2;
  const cz = RACK_DEPTH / 2;

  const railLen = RACK_DEPTH;
  const postH = frameH - PLATE_H * 2;

  // Current step data
  const step = steps[stepIndex] ?? steps[0];

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
  // Caster explosion: drop below
  const casterExpY = -10 * EX;
  // PlyTop explosion: float above
  const plyTopExpY = 12 * EX;

  // ── Assembly rotation — tip unit on its front for plate/caster steps ──
  const LAID_DOWN: [number, number, number] = [-Math.PI / 2, 0, 0];
  const UPRIGHT: [number, number, number] = [0, 0, 0];

  const assemblyRotation = useMemo((): [number, number, number] => {
    if (mode !== "step") return UPRIGHT;
    switch (step.id) {
      case "attach-bottom-plates":
      case "attach-top-plates":
      case "attach-casters":
      case "attach-top":
        return LAID_DOWN;
      default:
        return UPRIGHT;
    }
  }, [mode, step.id]);

  // Step-specific positional offsets for dramatic reveals
  const stepAnim = useMemo(() => {
    if (mode !== "step")
      return { posts: [0, 0, 0], rails: [0, 0, 0], bp: [0, 0, 0], tp: [0, 0, 0] };

    switch (step.id) {
      case "cut-uprights":
        // Lay uprights flat and spread apart slightly
        return {
          posts: [0, -lift - PLATE_H, 0],
          rails: [0, 0, 0],
          bp: [0, 0, 0],
          tp: [0, 0, 0],
        };
      case "cut-plates":
        // Show plates spread out
        return {
          posts: [0, 0, 0],
          rails: [0, 0, 0],
          bp: [0, -6, 0],
          tp: [0, 6, 0],
        };
      case "rip-rails":
        // Rails centered — only visible part
        return {
          posts: [0, 0, 0],
          rails: [0, 0, 0],
          bp: [0, 0, 0],
          tp: [0, 0, 0],
        };
      case "mark-posts":
        // Posts back in vertical position, rails ghosted in place
        return {
          posts: [0, 0, 0],
          rails: [0, 0, 0],
          bp: [0, 0, 0],
          tp: [0, 0, 0],
        };
      case "build-ladders":
        // Everything snaps together
        return {
          posts: [0, 0, 0],
          rails: [0, 0, 0],
          bp: [0, 0, 0],
          tp: [0, 0, 0],
        };
      case "attach-bottom-plates":
        // Bottom plates arrive from below
        return {
          posts: [0, 0, 0],
          rails: [0, 0, 0],
          bp: [0, 0, 0],
          tp: [0, 0, 0],
        };
      case "attach-top-plates":
        // Top plates settle from above
        return {
          posts: [0, 0, 0],
          rails: [0, 0, 0],
          bp: [0, 0, 0],
          tp: [0, 0, 0],
        };
      case "attach-casters":
        return {
          posts: [0, 0, 0],
          rails: [0, 0, 0],
          bp: [0, 0, 0],
          tp: [0, 0, 0],
        };
      case "attach-top":
        return {
          posts: [0, 0, 0],
          rails: [0, 0, 0],
          bp: [0, 0, 0],
          tp: [0, 0, 0],
        };
      default:
        return {
          posts: [0, 0, 0],
          rails: [0, 0, 0],
          bp: [0, 0, 0],
          tp: [0, 0, 0],
        };
    }
  }, [mode, step.id, lift]);

  // ── Screw positions ──────────────────────────────────────────────────
  const railScrewPositions = useMemo(() => {
    if (vis("screws") !== "visible") return [];
    const screws: {
      pos: [number, number, number];
      rot: [number, number, number];
      len: number;
      label: string;
    }[] = [];

    if (step.id === "build-ladders" || mode === "exploded") {
      const screwOffsetY = 0.5; // ±0.5" from rail center — 2 screws per rail end
      for (let i = 0; i <= cols; i++) {
        const px = getPostX(i, bayW);
        for (let r = 0; r < rows; r++) {
          const railY = PLATE_H + firstRailY + r * TIER_SPACING;
          // Right-face rail screws — 2 per end (top & bottom of rail strip)
          if (i < cols) {
            const sx = px + POST_W / 2 + RAIL_THICKNESS + 0.5;
            // Front end — 2 screws
            screws.push({
              pos: [sx, railY + screwOffsetY + lift, 2],
              rot: [0, 0, -Math.PI / 2],
              len: 1.625,
              label: '#9 × 1-5/8" Star Drive — through rail into post',
            });
            screws.push({
              pos: [sx, railY - screwOffsetY + lift, 2],
              rot: [0, 0, -Math.PI / 2],
              len: 1.625,
              label: '#9 × 1-5/8" Star Drive — through rail into post',
            });
            // Back end — 2 screws
            screws.push({
              pos: [sx, railY + screwOffsetY + lift, RACK_DEPTH - 2],
              rot: [0, 0, -Math.PI / 2],
              len: 1.625,
              label: '#9 × 1-5/8" Star Drive — through rail into post',
            });
            screws.push({
              pos: [sx, railY - screwOffsetY + lift, RACK_DEPTH - 2],
              rot: [0, 0, -Math.PI / 2],
              len: 1.625,
              label: '#9 × 1-5/8" Star Drive — through rail into post',
            });
          }
          // Left-face rail screws — 2 per end (top & bottom of rail strip)
          if (i > 0) {
            const sx = px - POST_W / 2 - RAIL_THICKNESS - 0.5;
            // Front end — 2 screws
            screws.push({
              pos: [sx, railY + screwOffsetY + lift, 2],
              rot: [0, 0, Math.PI / 2],
              len: 1.625,
              label: '#9 × 1-5/8" Star Drive — through rail into post',
            });
            screws.push({
              pos: [sx, railY - screwOffsetY + lift, 2],
              rot: [0, 0, Math.PI / 2],
              len: 1.625,
              label: '#9 × 1-5/8" Star Drive — through rail into post',
            });
            // Back end — 2 screws
            screws.push({
              pos: [sx, railY + screwOffsetY + lift, RACK_DEPTH - 2],
              rot: [0, 0, Math.PI / 2],
              len: 1.625,
              label: '#9 × 1-5/8" Star Drive — through rail into post',
            });
            screws.push({
              pos: [sx, railY - screwOffsetY + lift, RACK_DEPTH - 2],
              rot: [0, 0, Math.PI / 2],
              len: 1.625,
              label: '#9 × 1-5/8" Star Drive — through rail into post',
            });
          }
        }
      }
    }

    return screws;
  }, [cols, rows, bayW, firstRailY, lift, mode, step.id]);

  // Plate screws (separate group for step-level control)
  const plateScrewPositions = useMemo(() => {
    if (vis("plateScrews") !== "visible") return [];
    const screws: {
      pos: [number, number, number];
      rot: [number, number, number];
      len: number;
      label: string;
    }[] = [];

    const showBottom = step.id === "attach-bottom-plates" || step.id === "attach-top-plates" || mode === "exploded";
    const showTop = step.id === "attach-top-plates" || mode === "exploded";
    const screwSpreadX = 0.4; // ±0.4" from post center — 2 screws per joint

    // Plate screws drive VERTICALLY through the plate into the post end grain.
    // Bottom plate: screw head below plate, tip drives up into post end grain.
    // Top plate: screw head above plate, tip drives down into post top end grain.
    // Default screw orientation is along Y axis (vertical).

    for (let i = 0; i <= cols; i++) {
      const px = getPostX(i, bayW);

      if (showBottom) {
        // Bottom plate screws — vertical through plate into post end grain above
        for (const z of [POST_D / 2, RACK_DEPTH - POST_D / 2]) {
          screws.push({
            pos: [px - screwSpreadX, lift - 0.5, z],
            rot: [0, 0, 0],
            len: 3.0,
            label: '#9 × 3" Star Drive — through bottom plate into post end grain',
          });
          screws.push({
            pos: [px + screwSpreadX, lift - 0.5, z],
            rot: [0, 0, 0],
            len: 3.0,
            label: '#9 × 3" Star Drive — through bottom plate into post end grain',
          });
        }
      }

      if (showTop) {
        // Top plate screws — vertical through plate into post top end grain below
        for (const z of [POST_D / 2, RACK_DEPTH - POST_D / 2]) {
          screws.push({
            pos: [px - screwSpreadX, frameH + lift + 0.5, z],
            rot: [Math.PI, 0, 0],
            len: 3.0,
            label: '#9 × 3" Star Drive — through top plate into post end grain',
          });
          screws.push({
            pos: [px + screwSpreadX, frameH + lift + 0.5, z],
            rot: [Math.PI, 0, 0],
            len: 3.0,
            label: '#9 × 3" Star Drive — through top plate into post end grain',
          });
        }
      }
    }

    return screws;
  }, [cols, bayW, lift, frameH, mode, step.id]);

  return (
    <group scale={[S, S, S]}>
      <AnimatedRotation targetRot={assemblyRotation}>
      <group position={[-cx, -cy, -cz]}>
        {/* ── WOOD FRAME ── */}
        <group position={[0, lift, 0]}>
          {/* Bottom plates */}
          <FadeGroup vis={vis("bottomPlates")}>
            <AnimatedGroup
              targetPos={[0, bottomPlateExpY + (stepAnim.bp[1] as number), 0]}
            >
              <Lumber
                position={[totalW / 2, PLATE_H / 2, POST_D / 2]}
                size={[totalW, PLATE_H, POST_D]}
                vis={vis("bottomPlates")}
                label={`2×4 Bottom Plate (front) — ${toFraction(totalW)}" long, cut from 2×4×8' stock`}
              />
              <Lumber
                position={[totalW / 2, PLATE_H / 2, RACK_DEPTH - POST_D / 2]}
                size={[totalW, PLATE_H, POST_D]}
                vis={vis("bottomPlates")}
                label={`2×4 Bottom Plate (back) — ${toFraction(totalW)}" long, cut from 2×4×8' stock`}
              />
            </AnimatedGroup>
          </FadeGroup>

          {/* Top plates */}
          <FadeGroup vis={vis("topPlates")}>
            <AnimatedGroup
              targetPos={[0, topPlateExpY + (stepAnim.tp[1] as number), 0]}
            >
              <Lumber
                position={[totalW / 2, frameH - PLATE_H / 2, POST_D / 2]}
                size={[totalW, PLATE_H, POST_D]}
                vis={vis("topPlates")}
                label={`2×4 Top Plate (front) — ${toFraction(totalW)}" long, cut from 2×4×8' stock`}
              />
              <Lumber
                position={[
                  totalW / 2,
                  frameH - PLATE_H / 2,
                  RACK_DEPTH - POST_D / 2,
                ]}
                size={[totalW, PLATE_H, POST_D]}
                vis={vis("topPlates")}
                label={`2×4 Top Plate (back) — ${toFraction(totalW)}" long, cut from 2×4×8' stock`}
              />
            </AnimatedGroup>
          </FadeGroup>

          {/* Plywood top */}
          <FadeGroup vis={vis("plyTop")}>
            <AnimatedGroup targetPos={[0, plyTopExpY, 0]}>
              {vis("plyTop") !== "hidden" && (
                <HoverablePart
                  label={`3/4" Plywood Top — ${toFraction(totalW)}" × 30", flush on top plates`}
                  position={[
                    totalW / 2,
                    frameH + PLY_TOP_H / 2,
                    RACK_DEPTH / 2,
                  ]}
                  visible={vis("plyTop") === "visible"}
                >
                  <mesh castShadow receiveShadow>
                    <boxGeometry
                      args={[totalW, PLY_TOP_H, RACK_DEPTH]}
                    />
                    <meshStandardMaterial
                      color="#D4B896"
                      roughness={0.6}
                      metalness={0.0}
                      transparent={vis("plyTop") === "ghosted"}
                      opacity={vis("plyTop") === "ghosted" ? 0.12 : 1}
                      depthWrite={vis("plyTop") !== "ghosted"}
                    />
                  </mesh>
                </HoverablePart>
              )}
            </AnimatedGroup>
          </FadeGroup>

          {/* Ladder frames: posts + rails */}
          {Array.from({ length: cols + 1 }).map((_, i) => {
            const px = getPostX(i, bayW);
            const isLeft = i === 0;
            const isRight = i === cols;
            const expDir = isLeft ? -1 : isRight ? 1 : 0;

            return (
              <group key={`ladder-${i}`}>
                {/* Posts */}
                <FadeGroup vis={vis("posts")}>
                  <AnimatedGroup
                    targetPos={[
                      postExpX * expDir + (stepAnim.posts[0] as number),
                      stepAnim.posts[1] as number,
                      0,
                    ]}
                  >
                    <Lumber
                      position={[px, PLATE_H + postH / 2, POST_D / 2]}
                      size={[POST_W, postH, POST_D]}
                      vis={vis("posts")}
                      label={`2×4 Upright (front) — ${toFraction(postH)}" tall, cut from 2×4×8' stud`}
                    />
                    <Lumber
                      position={[
                        px,
                        PLATE_H + postH / 2,
                        RACK_DEPTH - POST_D / 2,
                      ]}
                      size={[POST_W, postH, POST_D]}
                      vis={vis("posts")}
                      label={`2×4 Upright (back) — ${toFraction(postH)}" tall, cut from 2×4×8' stud`}
                    />
                  </AnimatedGroup>
                </FadeGroup>

                {/* Right-face rails */}
                {i < cols &&
                  Array.from({ length: rows }).map((_, r) => {
                    const railY = PLATE_H + firstRailY + r * TIER_SPACING;
                    const railX = px + POST_W / 2 + RAIL_THICKNESS / 2;
                    const railFromBottom = firstRailY + r * TIER_SPACING;
                    return (
                      <FadeGroup key={`rr-${i}-${r}`} vis={vis("rails")}>
                        <AnimatedGroup
                          targetPos={[
                            railExpX + (stepAnim.rails[0] as number),
                            stepAnim.rails[1] as number,
                            0,
                          ]}
                        >
                          <PlywoodStrip
                            position={[railX, railY, RACK_DEPTH / 2]}
                            length={railLen}
                            vis={vis("rails")}
                            label={`3/4" Plywood Rail — 1-7/8" × ${railLen}" long, ${toFraction(railFromBottom)}" from bottom`}
                          />
                        </AnimatedGroup>
                      </FadeGroup>
                    );
                  })}

                {/* Left-face rails */}
                {i > 0 &&
                  Array.from({ length: rows }).map((_, r) => {
                    const railY = PLATE_H + firstRailY + r * TIER_SPACING;
                    const railX = px - POST_W / 2 - RAIL_THICKNESS / 2;
                    const railFromBottom = firstRailY + r * TIER_SPACING;
                    return (
                      <FadeGroup key={`rl-${i}-${r}`} vis={vis("rails")}>
                        <AnimatedGroup
                          targetPos={[
                            -railExpX + (stepAnim.rails[0] as number),
                            stepAnim.rails[1] as number,
                            0,
                          ]}
                        >
                          <PlywoodStrip
                            position={[railX, railY, RACK_DEPTH / 2]}
                            length={railLen}
                            vis={vis("rails")}
                            label={`3/4" Plywood Rail — 1-7/8" × ${railLen}" long, ${toFraction(railFromBottom)}" from bottom`}
                          />
                        </AnimatedGroup>
                      </FadeGroup>
                    );
                  })}
              </group>
            );
          })}
        </group>

        {/* ── CASTERS ── */}
        {(() => {
          const casterVis = vis("casters");
          if (casterVis === "hidden") return null;
          const firstPostX = getPostX(0, bayW);
          const lastPostX = getPostX(cols, bayW);
          const opacity = casterVis === "ghosted" ? 0.15 : 1;
          return (
            <FadeGroup vis={casterVis}>
              <AnimatedGroup targetPos={[0, casterExpY, 0]}>
                <group>
                  {opacity < 1 ? (
                    <>
                      {(
                        [
                          [firstPostX, POST_D / 2],
                          [lastPostX, POST_D / 2],
                          [firstPostX, RACK_DEPTH - POST_D / 2],
                          [lastPostX, RACK_DEPTH - POST_D / 2],
                        ] as [number, number][]
                      ).map(([x, z], i) => (
                        <mesh
                          key={`ghost-caster-${i}`}
                          position={[x, CASTER_HEIGHT / 2, z]}
                        >
                          <boxGeometry args={[3, CASTER_HEIGHT, 3]} />
                          <meshStandardMaterial
                            color="#888"
                            transparent
                            opacity={opacity}
                            depthWrite={false}
                          />
                        </mesh>
                      ))}
                    </>
                  ) : (
                    <>
                      <HoverablePart
                        label='5" Heavy-Duty Swivel Caster — 4 lag screws per mount plate'
                        position={[firstPostX, 0, POST_D / 2]}
                      >
                        <IndustrialCaster position={[0, 0, 0]} />
                      </HoverablePart>
                      <HoverablePart
                        label='5" Heavy-Duty Swivel Caster — 4 lag screws per mount plate'
                        position={[lastPostX, 0, POST_D / 2]}
                      >
                        <IndustrialCaster position={[0, 0, 0]} />
                      </HoverablePart>
                      <HoverablePart
                        label='5" Heavy-Duty Swivel Caster — 4 lag screws per mount plate'
                        position={[firstPostX, 0, RACK_DEPTH - POST_D / 2]}
                      >
                        <IndustrialCaster position={[0, 0, 0]} />
                      </HoverablePart>
                      <HoverablePart
                        label='5" Heavy-Duty Swivel Caster — 4 lag screws per mount plate'
                        position={[lastPostX, 0, RACK_DEPTH - POST_D / 2]}
                      >
                        <IndustrialCaster position={[0, 0, 0]} />
                      </HoverablePart>
                    </>
                  )}
                </group>
              </AnimatedGroup>
            </FadeGroup>
          );
        })()}

        {/* ── BACK SUPPORTS — diagonal braces at back face corners ── */}
        {(() => {
          const bsVis = vis("backSupports");
          if (bsVis === "hidden") return null;
          const firstPostX = getPostX(0, bayW);
          const lastPostX = getPostX(cols, bayW);
          const bottomY = lift + PLATE_H;
          const topY = lift + frameH - PLATE_H;
          const braceLen = 20; // ~20" diagonal brace
          const bsMat = bsVis === "ghosted" ? PLYWOOD_GHOST : PLYWOOD_MAT;
          const braceAngle = Math.PI / 4; // 45°
          const backZ = RACK_DEPTH - POST_D / 2;

          // 4 diagonal braces at the corners of the back face
          const braces: { pos: [number, number, number]; rot: number }[] = [
            // Bottom-left: rises from bottom plate toward center
            { pos: [firstPostX, bottomY + braceLen / (2 * Math.SQRT2), backZ], rot: braceAngle },
            // Bottom-right: rises from bottom plate toward center
            { pos: [lastPostX, bottomY + braceLen / (2 * Math.SQRT2), backZ], rot: -braceAngle },
            // Top-left: descends from top plate toward center
            { pos: [firstPostX, topY - braceLen / (2 * Math.SQRT2), backZ], rot: -braceAngle },
            // Top-right: descends from top plate toward center
            { pos: [lastPostX, topY - braceLen / (2 * Math.SQRT2), backZ], rot: braceAngle },
          ];

          return (
            <FadeGroup vis={bsVis}>
              {braces.map((b, i) => (
                <group key={`bs-${i}`} position={b.pos} rotation={[0, 0, b.rot]}>
                  <mesh material={bsMat} castShadow={bsVis === "visible"} receiveShadow={bsVis === "visible"}>
                    <boxGeometry args={[RAIL_THICKNESS, braceLen, RAIL_HEIGHT]} />
                  </mesh>
                </group>
              ))}
            </FadeGroup>
          );
        })()}

        {/* ── RAIL SCREWS ── */}
        {railScrewPositions.map((s, i) => (
          <ConstructionScrew
            key={`rail-screw-${i}`}
            position={s.pos}
            rotation={s.rot}
            length={s.len}
            label={s.label}
            visible={true}
          />
        ))}

        {/* ── PLATE SCREWS ── */}
        {plateScrewPositions.map((s, i) => (
          <ConstructionScrew
            key={`plate-screw-${i}`}
            position={s.pos}
            rotation={s.rot}
            length={s.len}
            label={s.label}
            visible={true}
          />
        ))}
      </group>
      </AnimatedRotation>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMERA RIG — adapts to step camera hints with smooth transitions
// ═══════════════════════════════════════════════════════════════════════════

function GuideCameraRig({
  cols,
  rows,
  toteType,
  cameraHint,
  hasWheels,
}: {
  cols: number;
  rows: number;
  toteType: ToteType;
  cameraHint?: string;
  hasWheels: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const targetPos = useRef(new Vector3());
  const isFirstRender = useRef(true);
  const isAnimating = useRef(false);

  const bayW = getBayWidth(toteType);
  const totalW = cols * bayW + (cols + 1) * POST_W;
  const firstRailY = Math.max(MIN_FIRST_RAIL_Y, PLATE_H + 2);
  const lastRailY = firstRailY + (rows - 1) * TIER_SPACING;
  const frameH = PLATE_H + lastRailY + 3 + PLATE_H;
  const overallH = frameH + (hasWheels ? CASTER_HEIGHT : 0);

  const sw = totalW * S;
  const sh = overallH * S;
  const sd = RACK_DEPTH * S;
  const maxDim = Math.max(sw, sh, sd);
  const dist = maxDim * 2.8;

  useEffect(() => {
    let px: number, py: number, pz: number;
    switch (cameraHint) {
      case "side":
      case "close-side":
        px = dist * 1.4;
        py = dist * 0.5;
        pz = dist * 0.3;
        break;
      case "front":
        px = dist * 0.2;
        py = dist * 0.5;
        pz = dist * 1.4;
        break;
      case "bottom":
        px = dist * 0.8;
        py = -dist * 0.3;
        pz = dist * 1.0;
        break;
      case "top-down":
        px = dist * 0.1;
        py = dist * 1.2;
        pz = dist * 0.3;
        break;
      case "laid-front":
        // Elevated 3/4 view looking down at unit laid on its front
        px = dist * 0.8;
        py = dist * 1.2;
        pz = dist * 0.6;
        break;
      case "laid-bottom":
        // Angled view showing bottom plate area of laid-down unit
        px = dist * 0.6;
        py = dist * 1.0;
        pz = dist * 0.9;
        break;
      default:
        px = dist * 0.9;
        py = dist * 0.65;
        pz = dist * 1.1;
    }

    targetPos.current.set(px, py, pz);

    // Instant position on first render, smooth after
    if (isFirstRender.current) {
      camera.position.set(px, py, pz);
      camera.lookAt(0, 0, 0);
      isFirstRender.current = false;
    } else {
      // Start animating toward new target on step change
      isAnimating.current = true;
    }

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, dist, cameraHint]);

  // Smooth camera transitions between steps — stops once close enough
  // so OrbitControls has full authority for user zoom/pan/rotate
  useFrame(() => {
    if (!isAnimating.current) return;
    camera.position.lerp(targetPos.current, 0.06);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
    // Stop animating once close enough to target
    if (camera.position.distanceTo(targetPos.current) < 0.005) {
      isAnimating.current = false;
    }
  });

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
// STEP CARD v2 — tools, pro tips, materials, fasteners
// ═══════════════════════════════════════════════════════════════════════════

function StepCard({
  step,
  stepIndex,
  totalSteps,
  cols,
  rows,
  config,
  onNext,
  onPrev,
  onReset,
}: {
  step: AssemblyStep;
  stepIndex: number;
  totalSteps: number;
  cols: number;
  rows: number;
  config: BuildConfig;
  onNext: () => void;
  onPrev: () => void;
  onReset: () => void;
}) {
  const materials = computeMaterials(step, cols, rows, config);
  const isLast = stepIndex === totalSteps - 1;

  // Resolve token placeholders in instruction text
  const resolvedInstruction = resolveTokens(step.instruction, cols, rows, config);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Step header */}
      <div className="shrink-0 border-b border-slate-700 px-5 py-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-gray-950">
            {stepIndex + 1}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Step {stepIndex + 1} of {totalSteps}
          </span>
        </div>
        <h3 className="text-lg font-extrabold text-white">{step.title}</h3>
        {/* Progress bar */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-yellow-400 transition-all duration-500"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="scrollbar-dark min-h-0 flex-1 overflow-y-auto">
        {/* Instruction */}
        <div className="border-b border-slate-800 px-5 py-4">
          <div className="flex items-start gap-2">
            <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
            <p className="text-sm leading-relaxed text-stone-300">
              {resolvedInstruction}
            </p>
          </div>
        </div>

        {/* Tools required */}
        {step.tools.length > 0 && (
          <div className="border-b border-slate-800 px-5 py-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Hammer className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                Tools
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {step.tools.map((tool, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] font-medium text-stone-300"
                  title={tool.detail ? resolveTokens(tool.detail, cols, rows, config) : undefined}
                >
                  {tool.name}
                  {tool.detail && (
                    <span className="text-stone-600">({resolveTokens(tool.detail, cols, rows, config)})</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

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
        <div className="px-5 py-4">
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

        {/* Pro tip */}
        {step.proTip && (
          <div className="px-5 pb-4">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
              <div className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Pro Tip
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400">
                    {step.proTip}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation — always visible at bottom */}
      <div className="shrink-0 border-t border-slate-700 px-5 py-4">
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
// MAIN EXPORT — AssemblyGuide v2
//
// Full-screen 3D viewport with floating step card overlay.
// The step card is an absolute-positioned window inside the viewport,
// not a sidebar — works on all screen sizes.
// ═══════════════════════════════════════════════════════════════════════════

interface AssemblyGuideProps {
  cols: number;
  rows: number;
  toteType: ToteType;
  hasWheels?: boolean;
  hasTop?: boolean;
  onClose?: () => void;
}

export default function AssemblyGuide({
  cols,
  rows,
  toteType,
  hasWheels = true,
  hasTop = false,
  onClose,
}: AssemblyGuideProps) {
  const config: BuildConfig = { hasWheels, hasTop, toteType };
  const steps = useMemo(() => getStepsForConfig(config), [hasWheels, hasTop]);

  const [mode, setMode] = useState<"exploded" | "step">("exploded");
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = steps[stepIndex];

  const handleStartBuild = useCallback(() => {
    setMode("step");
    setStepIndex(0);
  }, []);

  const handleNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);

  const handlePrev = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleReset = useCallback(() => {
    setMode("exploded");
    setStepIndex(0);
  }, []);

  return (
    <div className="relative h-full w-full bg-slate-950">
      {/* ── Full-screen 3D Viewport ─────────────────────────────────── */}
      <Canvas
        shadows
        camera={{ fov: 40 }}
        gl={{ antialias: true, alpha: false }}
        style={{ touchAction: "none", position: "absolute", inset: 0 }}
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
          position={[0, -1.5, 0]}
          opacity={0.15}
          scale={12}
          blur={2.5}
          far={6}
          color="#444444"
        />

        <GuideCameraRig
          cols={cols}
          rows={rows}
          toteType={toteType}
          cameraHint={
            mode === "step" ? currentStep?.cameraHint : "overview"
          }
          hasWheels={hasWheels}
        />

        <ExplodedAssembly
          cols={cols}
          rows={rows}
          toteType={toteType}
          mode={mode}
          stepIndex={stepIndex}
          steps={steps}
          hasWheels={hasWheels}
          hasTop={hasTop}
        />
      </Canvas>

      {/* ── HTML Overlay Layer (above Canvas) ──────────────────────── */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* Close button — top right (always visible) */}
        {onClose && (
          <button
            onClick={onClose}
            className="pointer-events-auto absolute right-4 top-4 rounded-full bg-slate-900/80 p-2.5 text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-800"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Exploded mode — top-left label + bottom-center Start button */}
        {mode === "exploded" && (
          <>
            <div className="pointer-events-none absolute left-4 top-4">
              <div className="rounded-xl bg-slate-900/90 px-5 py-3 shadow-xl backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                  Exploded View
                </p>
                <p className="mt-0.5 text-sm font-semibold text-white">
                  {cols}×{rows} {toteType} Storage Unit
                </p>
                <p className="text-xs text-stone-400">
                  Hover any piece for dimensions
                  {hasWheels ? " — with casters" : ""}
                  {hasTop ? " — with top" : ""}
                </p>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-8 flex justify-center">
              <button
                onClick={handleStartBuild}
                className="pointer-events-auto flex items-center gap-2.5 rounded-2xl bg-yellow-400 px-10 py-4 text-lg font-extrabold uppercase tracking-wider text-gray-950 shadow-2xl shadow-yellow-400/30 transition-all hover:-translate-y-1 hover:bg-yellow-300 hover:shadow-yellow-400/50"
              >
                <Play className="h-6 w-6" />
                Start Build Guide
              </button>
            </div>
          </>
        )}

        {/* Step mode — floating step card (bottom-left) + config badge (top-left) */}
        {mode === "step" && currentStep && (
          <>
            {/* Config badge — top left */}
            <div className="pointer-events-none absolute left-4 top-4">
              <div className="rounded-lg bg-slate-900/80 px-3 py-1.5 shadow-lg backdrop-blur">
                <p className="text-[10px] font-bold text-stone-400">
                  {cols}×{rows} {toteType}
                  {hasWheels ? " + Wheels" : ""}
                  {hasTop ? " + Top" : ""}
                </p>
              </div>
            </div>

            {/* Floating Step Card — bottom left on desktop, bottom full-width on mobile */}
            <div className="pointer-events-auto absolute bottom-4 left-4 right-4 flex max-h-[70vh] flex-col sm:right-auto sm:w-[400px]">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl backdrop-blur-sm">
                <StepCard
                  step={currentStep}
                  stepIndex={stepIndex}
                  totalSteps={steps.length}
                  cols={cols}
                  rows={rows}
                  config={config}
                  onNext={handleNext}
                  onPrev={handlePrev}
                  onReset={handleReset}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
