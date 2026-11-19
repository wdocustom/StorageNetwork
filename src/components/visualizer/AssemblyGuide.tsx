"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Html } from "@react-three/drei";
import { CanvasTexture, Group, Mesh, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import IndustrialCaster, { CASTER_HEIGHT } from "./IndustrialCaster";
import { createDougFirMaterial, createPlywoodMaterial } from "./woodTextures";
import ConstructionScrew from "./ConstructionScrew";
import {
  RAILS_2X4,
  braceLayout2x4,
  rails2x4Geometry,
  getStepsForConfig,
  computeMaterials,
  resolveTokens,
  upright2x4,
  type AssemblyStep,
  type PartGroup,
  type PartVisibility,
  type BuildConfig,
  type RailStyle,
} from "./assemblySteps";
import { toFraction } from "@/lib/utils";
import { railCenterFromBottom, railTopFromBottom } from "@/lib/rails2x4";
import { useMeasure } from "@/lib/measure-units";
import { MINI, miniDepth, miniOpening, miniPlateLength, miniRailTops, miniUpright } from "@/lib/mini-rack";
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
  Ruler,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — mirrors Rack3D.tsx exactly
// ═══════════════════════════════════════════════════════════════════════════

/** "MINI" = Mini Tote Rack (HDX 6.5 qt, 2×3 frame, 1-1/4" plywood rails — @/lib/mini-rack) */
type ToteType = "HDX" | "GM" | "MINI";

const POST_W = 1.5;
const POST_D = 3.5;
const RAIL_THICKNESS = 0.75;
const RAIL_HEIGHT = 1.875;
const BIN_LIP_WIDTH = 1.0;
const BIN_GAP = 0.25;
const PLATE_H = 1.5;
const RACK_DEPTH = 30;
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


/** Frame dimensions for either rail style (inches). */
interface FrameGeometry {
  bayW: number;
  totalW: number;
  /** Structural plate length */
  plateLen: number;
  /** Rail CENTER heights above the bottom of the upright */
  railCenters: number[];
  postH: number;
  /** Bottom plate + upright + top plate */
  frameH: number;
  /** Rail thickness off the upright face × rail height */
  railW: number;
  railH: number;
  /** Front to back = rail length */
  depth: number;
  /** Upright and plate depth front to back: 3-1/2" (2×4), 2-1/2" (mini 2×3) */
  postD: number;
}

export function frameGeometry(cols: number, rows: number, toteType: ToteType, rails: RailStyle, sideways = false): FrameGeometry {
  if (toteType === "MINI") {
    // Mini Tote Rack: 2×3 frame, plywood strips ripped to 1-1/4", rails by top edge
    const bayW = miniOpening(sideways);
    const postH = miniUpright(rows);
    return {
      bayW,
      totalW: miniPlateLength(cols, sideways),
      plateLen: miniPlateLength(cols, sideways),
      railCenters: miniRailTops(rows).map((t) => t - MINI.railH / 2),
      postH,
      frameH: PLATE_H + postH + PLATE_H,
      railW: MINI.railT,
      railH: MINI.railH,
      depth: miniDepth(sideways),
      postD: MINI.postD,
    };
  }
  if (rails === "2x4") {
    // Ripped 2×4 rails, universal 21" bays (30-1/4" × 20" deep sideways) — mirrors buildEngine / Rack3D
    const geo = rails2x4Geometry(sideways);
    const bayW = geo.opening;
    const totalW = cols * bayW + (cols + 1) * POST_W;
    const postH = upright2x4(rows);
    return {
      bayW,
      totalW,
      plateLen: totalW,
      railCenters: RAILS_2X4.positions.slice(0, Math.min(rows, RAILS_2X4.maxRows)),
      postH,
      frameH: PLATE_H + postH + PLATE_H,
      railW: RAILS_2X4.railW,
      railH: RAILS_2X4.railH,
      depth: geo.depth,
      postD: POST_D,
    };
  }
  const bayW = getBayWidth(toteType);
  // Correct structural plate length (uses actual tote opening, not visual bay width)
  const opening = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  // Plywood rails sit at the same TOP-edge heights as 2×4 rails (13", then
  // every 16" from the bottom of the upright); the center is only for drawing.
  const lastRailTop = railTopFromBottom(rows - 1);
  // Upright = top rail's top edge + 3" (unchanged: rows × 16", as buildEngine cuts them)
  const frameH = PLATE_H + lastRailTop + 3 + PLATE_H;
  return {
    bayW,
    totalW: cols * bayW + (cols + 1) * POST_W,
    plateLen: cols * opening + (cols + 1) * POST_W,
    railCenters: Array.from({ length: rows }, (_, r) => railCenterFromBottom(r, RAIL_HEIGHT)),
    postH: frameH - PLATE_H * 2,
    frameH,
    railW: RAIL_THICKNESS,
    railH: RAIL_HEIGHT,
    depth: RACK_DEPTH,
    postD: POST_D,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MATERIALS
// ═══════════════════════════════════════════════════════════════════════════

const PINE_MAT = createDougFirMaterial(42);
const PLYWOOD_MAT = createPlywoodMaterial(137);

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
// SNAP MODE — when true, animations jump straight to their targets so a
// still frame can be captured right away (PDF step renders).
// ═══════════════════════════════════════════════════════════════════════════

const SnapContext = createContext(false);

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
  const snap = useContext(SnapContext);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.lerp(target, snap ? 1 : speed);
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
  const k = useContext(SnapContext) ? 1 : speed;

  useEffect(() => {
    target.current.set(...targetRot);
  }, [targetRot[0], targetRot[1], targetRot[2]]);

  useFrame(() => {
    if (!ref.current) return;
    const r = ref.current.rotation;
    r.x += (target.current.x - r.x) * k;
    r.y += (target.current.y - r.y) * k;
    r.z += (target.current.z - r.z) * k;
  });

  return <group ref={ref}>{children}</group>;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOVERABLE PART WRAPPER — shows a piece's dimensions/material
//
// Mouse: on hover. Touch (and click): tap a piece to show its label, tap it
// again (or tap empty space) to hide it, so the label isn't only visible
// while a finger is held on it, under the thumb. One label at a time; the
// guide clears it when the build steps open. A tap that turned into a drag
// (rotating the view) doesn't count.
// ═══════════════════════════════════════════════════════════════════════════

const PartLabelContext = createContext<{ selected: string | null; setSelected: (id: string | null) => void } | null>(null);

/** Pixels a press can move and still count as a tap, not a rotate. */
const TAP_SLOP_PX = 8;

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
  const id = useId();
  const shared = useContext(PartLabelContext);
  const [localSelected, setLocalSelected] = useState(false);
  const selected = shared ? shared.selected === id : localSelected;
  const measure = useMeasure();

  if (!visible) return <>{children}</>;

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        // Touch "hovers" only while the finger is down: taps handle touch.
        if (e.nativeEvent.pointerType !== "mouse") return;
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        if (e.nativeEvent.pointerType !== "mouse") return;
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > TAP_SLOP_PX) return; // dragged to rotate the view
        if (shared) shared.setSelected(selected ? null : id);
        else setLocalSelected((v) => !v);
      }}
    >
      {children}
      {(hovered || selected) && (
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
            {measure(label)}
          </div>
        </Html>
      )}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SQUARE CHECK — two tape measures across the back face's diagonals
//
// For the steps where the frame lies on its front and gets checked for
// square (step.squareCheck). Real-world scale: a 3" case and a 1" blade, so
// it reads as a tool next to a 6-foot rack. The hook stays on one corner and
// the case pulls out to the opposite corner; then the second tape does the
// other diagonal. Each shows its length when it lands, then a callout says
// they should match within 1/8". Snapshots (PDF) draw both laid out, with
// the callout painted into the image (no HTML in a captured frame).
// ═══════════════════════════════════════════════════════════════════════════

/** Seconds: wait for the step card to collapse, pull each tape, pause between. */
const TAPE_DELAY = 0.45;
const TAPE_PULL = 1.1;
const TAPE_GAP = 0.3;

const TAPE_BLADE_W = 1; // inches
const TAPE_CASE = { len: 3, w: 3, h: 1.6 };

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** A 12" stretch of tape blade: red with white 1/8", 1/2" and inch ticks (reads on white and on pine, and in print). Repeats along the blade. */
function makeBladeTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#dc2626";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#ffffff";
  const perIn = c.width / 12;
  for (let i = 0; i < 96; i++) {
    const x = (i / 8) * perIn;
    const h = i % 8 === 0 ? 30 : i % 4 === 0 ? 20 : 11;
    g.fillRect(x, 0, i % 8 === 0 ? 3 : 2, h);
  }
  g.font = "bold 22px sans-serif";
  for (let i = 1; i < 12; i++) g.fillText(String(i), i * perIn + 5, 56);
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A label painted into the scene (for snapshots, where HTML isn't captured). */
function makeLabelTexture(lines: string[]): { texture: CanvasTexture; aspect: number } | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  if (!g) return null;
  const font = (bold: boolean) => `${bold ? 800 : 600} 44px sans-serif`;
  g.font = font(true);
  const w = Math.ceil(Math.max(...lines.map((l, i) => ((g.font = font(i === 0)), g.measureText(l).width)))) + 64;
  const lineH = 58;
  c.width = w;
  c.height = lines.length * lineH + 36;
  g.fillStyle = "rgba(15, 23, 42, 0.94)";
  g.beginPath();
  g.roundRect(0, 0, c.width, c.height, 22);
  g.fill();
  lines.forEach((l, i) => {
    g.font = font(i === 0);
    g.fillStyle = i === 0 ? "#fbbf24" : "#e5e7eb";
    g.fillText(l, 32, 18 + lineH * (i + 1) - 14);
  });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return { texture: t, aspect: c.width / c.height };
}

const tapeLabelStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  color: "#fbbf24",
  padding: "3px 8px",
  borderRadius: "8px",
  fontSize: "11px",
  fontWeight: 800,
  whiteSpace: "nowrap",
  border: "1px solid rgba(251, 191, 36, 0.35)",
  boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
};

/** One tape: hook at `from`, the case pulled out to `to` (inches, on a face whose normal is +Z). */
function TapeMeasure({
  from,
  to,
  z,
  progress,
}: {
  from: [number, number];
  to: [number, number];
  z: number;
  /** 0…1 how far the case has been pulled (read every frame) */
  progress: React.MutableRefObject<number>;
}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const blade = useRef<Mesh>(null);
  const caseRef = useRef<Group>(null);
  const texture = useMemo(() => makeBladeTexture(), []);
  useEffect(() => () => texture?.dispose(), [texture]);

  useFrame(() => {
    const l = Math.max(0.001, len * progress.current);
    if (blade.current) {
      blade.current.scale.x = l;
      blade.current.position.x = l / 2;
      blade.current.visible = progress.current > 0.002;
    }
    if (texture) texture.repeat.x = l / 12;
    if (caseRef.current) caseRef.current.position.x = l;
  });

  return (
    <group position={[from[0], from[1], z]} rotation={[0, 0, angle]}>
      {/* Hook, over the corner */}
      <mesh position={[-0.12, 0, 0.12]}>
        <boxGeometry args={[0.24, TAPE_BLADE_W + 0.2, 0.36]} />
        <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Blade */}
      <mesh ref={blade} position={[0, 0, 0.03]} scale={[0.001, 1, 1]}>
        <planeGeometry args={[1, TAPE_BLADE_W]} />
        <meshStandardMaterial map={texture ?? undefined} color={texture ? "#ffffff" : "#dc2626"} roughness={0.6} />
      </mesh>
      {/* Case: red body, dark face, lying flat */}
      <group ref={caseRef}>
        <mesh position={[TAPE_CASE.len / 2, 0, TAPE_CASE.h / 2]} castShadow>
          <boxGeometry args={[TAPE_CASE.len, TAPE_CASE.w, TAPE_CASE.h]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.45} />
        </mesh>
        <mesh position={[TAPE_CASE.len / 2 + 0.2, 0, TAPE_CASE.h + 0.01]}>
          <boxGeometry args={[TAPE_CASE.len - 0.9, TAPE_CASE.w - 0.9, 0.04]} />
          <meshStandardMaterial color="#111827" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

function SquareCheckTapes({
  width,
  height,
  z,
  y0,
  realWidth,
  runKey,
  onLanded,
}: {
  /** Back face as drawn (inches): x 0…width, y y0…y0+height, at depth z */
  width: number;
  height: number;
  z: number;
  y0: number;
  /** Real plate length, for the reading (plywood plates run a little longer than drawn) */
  realWidth: number;
  /** Changes each time the tapes are switched on: replays the pull */
  runKey: number;
  /** How many tapes have landed (0, 1, 2) — the guide shows the callout at 2 */
  onLanded?: (n: number) => void;
}) {
  const snap = useContext(SnapContext);
  const measure = useMeasure();
  const p1 = useRef(snap ? 1 : 0);
  const p2 = useRef(snap ? 1 : 0);
  const started = useRef<number | null>(null);
  const [landed, setLanded] = useState(snap ? 2 : 0);

  useEffect(() => {
    started.current = null;
    p1.current = snap ? 1 : 0;
    p2.current = snap ? 1 : 0;
    setLanded(snap ? 2 : 0);
  }, [runKey, snap]);

  useFrame(({ clock }) => {
    if (snap) return;
    if (started.current == null) started.current = clock.elapsedTime;
    const t = clock.elapsedTime - started.current - TAPE_DELAY;
    p1.current = easeInOut(Math.min(1, Math.max(0, t / TAPE_PULL)));
    p2.current = easeInOut(Math.min(1, Math.max(0, (t - TAPE_PULL - TAPE_GAP) / TAPE_PULL)));
    const n = (p1.current >= 1 ? 1 : 0) + (p2.current >= 1 ? 1 : 0);
    if (n !== landed) {
      setLanded(n);
      onLanded?.(n);
    }
  });

  // Inset a hair so the hooks catch the corners, not the air beside them.
  const i = 0.4;
  const a: [number, number] = [i, y0 + i];
  const b: [number, number] = [width - i, y0 + height - i];
  const c: [number, number] = [width - i, y0 + i];
  const d: [number, number] = [i, y0 + height - i];
  const diagonal = `${toFraction(Math.hypot(realWidth, height))}"`;
  const reading = measure(diagonal);
  const callout = measure('Match within ±1/8" = square');

  const snapLabel = useMemo(
    () => (snap ? makeLabelTexture([measure(`Both diagonals ${diagonal}`), callout]) : null),
    [snap, measure, diagonal, callout],
  );
  useEffect(() => () => snapLabel?.texture.dispose(), [snapLabel]);

  const lift = 2.2; // labels float just above the tapes
  const mid = (p: [number, number], q: [number, number], f: number): [number, number, number] => [
    p[0] + (q[0] - p[0]) * f,
    p[1] + (q[1] - p[1]) * f,
    z + lift,
  ];

  return (
    <group>
      <TapeMeasure from={a} to={b} z={z} progress={p1} />
      <TapeMeasure from={c} to={d} z={z + 0.05} progress={p2} />
      {!snap && landed >= 1 && (
        <Html position={mid(a, b, 0.22)} center style={{ pointerEvents: "none" }}>
          <div style={tapeLabelStyle}>{reading}</div>
        </Html>
      )}
      {!snap && landed >= 2 && (
        <>
          <Html position={mid(c, d, 0.22)} center style={{ pointerEvents: "none" }}>
            <div style={tapeLabelStyle}>{reading}</div>
          </Html>
        </>
      )}
      {/* Faces the camera, upright, so it reads straight in the printed step */}
      {snapLabel && (
        <sprite position={[width / 2, y0 + height / 2, z + 6]} scale={[width * 0.62, (width * 0.62) / snapLabel.aspect, 1]}>
          <spriteMaterial map={snapLabel.texture} transparent toneMapped={false} depthTest={false} />
        </sprite>
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
  height = RAIL_HEIGHT,
}: {
  position: [number, number, number];
  length: number;
  vis: PartVisibility;
  label?: string;
  /** Strip height: 1-7/8" (installer plywood rails), 1-1/4" (mini) */
  height?: number;
}) {
  if (vis === "hidden") return null;
  const mat = vis === "ghosted" ? PLYWOOD_GHOST : PLYWOOD_MAT;
  const mesh = (
    <mesh position={position} material={mat} castShadow={vis === "visible"} receiveShadow={vis === "visible"}>
      <boxGeometry args={[RAIL_THICKNESS, height, length]} />
    </mesh>
  );

  if (label && vis === "visible") {
    return (
      <HoverablePart label={label} position={position}>
        <mesh material={mat} castShadow receiveShadow>
          <boxGeometry args={[RAIL_THICKNESS, height, length]} />
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
  rails: RailStyle;
  sideways?: boolean;
  /** Square-check tape measures: shown while on; a new runKey replays the pull */
  squareTapes?: { on: boolean; runKey: number; onLanded?: (n: number) => void };
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
  rails,
  sideways = false,
  squareTapes,
}: ExplodedAssemblyProps) {
  const isMini = toteType === "MINI";
  const is2x4 = rails === "2x4" && !isMini;
  /** Frame lumber in labels */
  const stud = isMini ? "2×3" : "2×4";
  const { bayW, totalW, plateLen, railCenters, postH, frameH, railW, railH, depth, postD } = useMemo(
    () => frameGeometry(cols, rows, toteType, rails, sideways),
    [cols, rows, toteType, rails, sideways],
  );
  // Rack depth for this frame (20" sideways) — shadows the 30" default below
  const RACK_DEPTH = depth;
  const lift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + lift;

  const cx = totalW / 2;
  const cy = overallH / 2;
  const cz = RACK_DEPTH / 2;

  const railLen = RACK_DEPTH;
  const railScrewLen = isMini ? MINI.railScrewLength : is2x4 ? 3.0 : 1.625;
  const railScrewLabel = isMini
    ? '#8 × 1-1/4" Star Drive — through plywood rail into 2×3 upright'
    : is2x4
    ? '#9 × 3" Star Drive — through 2×4 rail into upright'
    : '#9 × 1-5/8" Star Drive — through rail into post';

  // Current step data
  const step = steps[stepIndex] ?? steps[0];

  function vis(group: PartGroup): PartVisibility {
    if (mode === "exploded") {
      // Exploded view shows every part this build has — and only those
      if (group === "casters" || group === "casterScrews") return hasWheels ? "visible" : "hidden";
      if (group === "plyTop") return hasTop ? "visible" : "hidden";
      return "visible";
    }
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
      case "install-back-supports":
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
        for (let r = 0; r < railCenters.length; r++) {
          const railY = PLATE_H + railCenters[r];
          // Right-face rail screws — 2 per end (top & bottom of rail strip)
          if (i < cols) {
            const sx = px + POST_W / 2 + railW + 0.5;
            // Front end — 2 screws
            screws.push({
              pos: [sx, railY + screwOffsetY + lift, 2],
              rot: [0, 0, -Math.PI / 2],
              len: railScrewLen,
              label: railScrewLabel,
            });
            screws.push({
              pos: [sx, railY - screwOffsetY + lift, 2],
              rot: [0, 0, -Math.PI / 2],
              len: railScrewLen,
              label: railScrewLabel,
            });
            // Back end — 2 screws
            screws.push({
              pos: [sx, railY + screwOffsetY + lift, RACK_DEPTH - 2],
              rot: [0, 0, -Math.PI / 2],
              len: railScrewLen,
              label: railScrewLabel,
            });
            screws.push({
              pos: [sx, railY - screwOffsetY + lift, RACK_DEPTH - 2],
              rot: [0, 0, -Math.PI / 2],
              len: railScrewLen,
              label: railScrewLabel,
            });
          }
          // Left-face rail screws — 2 per end (top & bottom of rail strip)
          if (i > 0) {
            const sx = px - POST_W / 2 - railW - 0.5;
            // Front end — 2 screws
            screws.push({
              pos: [sx, railY + screwOffsetY + lift, 2],
              rot: [0, 0, Math.PI / 2],
              len: railScrewLen,
              label: railScrewLabel,
            });
            screws.push({
              pos: [sx, railY - screwOffsetY + lift, 2],
              rot: [0, 0, Math.PI / 2],
              len: railScrewLen,
              label: railScrewLabel,
            });
            // Back end — 2 screws
            screws.push({
              pos: [sx, railY + screwOffsetY + lift, RACK_DEPTH - 2],
              rot: [0, 0, Math.PI / 2],
              len: railScrewLen,
              label: railScrewLabel,
            });
            screws.push({
              pos: [sx, railY - screwOffsetY + lift, RACK_DEPTH - 2],
              rot: [0, 0, Math.PI / 2],
              len: railScrewLen,
              label: railScrewLabel,
            });
          }
        }
      }
    }

    return screws;
  }, [cols, bayW, railCenters, railW, railScrewLen, railScrewLabel, lift, mode, step.id]);

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
    // Spread screws along Z axis (parallel with the 3.5" face of the post)
    const screwSpreadZ = 0.6;

    // Plate screws drive VERTICALLY through the plate into the post end grain.
    // ConstructionScrew default: head at origin, tip extends in -Y direction.
    // Bottom plate: tip drives UP into post above → rotate [Math.PI, 0, 0] to flip tip to +Y
    // Top plate: tip drives DOWN into post below → default [0, 0, 0] (tip already -Y)

    for (let i = 0; i <= cols; i++) {
      const px = getPostX(i, bayW);

      if (showBottom) {
        // Bottom plate screws — 2 screws per post, spread along Z (parallel with post)
        for (const zCenter of [postD / 2, RACK_DEPTH - postD / 2]) {
          screws.push({
            pos: [px, lift, zCenter - screwSpreadZ],
            rot: [Math.PI, 0, 0],
            len: 3.0,
            label: '#9 × 3" Star Drive — through bottom plate into post end grain',
          });
          screws.push({
            pos: [px, lift, zCenter + screwSpreadZ],
            rot: [Math.PI, 0, 0],
            len: 3.0,
            label: '#9 × 3" Star Drive — through bottom plate into post end grain',
          });
        }
      }

      if (showTop) {
        // Top plate screws — 2 screws per post, spread along Z (parallel with post)
        for (const zCenter of [postD / 2, RACK_DEPTH - postD / 2]) {
          screws.push({
            pos: [px, frameH + lift, zCenter - screwSpreadZ],
            rot: [0, 0, 0],
            len: 3.0,
            label: '#9 × 3" Star Drive — through top plate into post end grain',
          });
          screws.push({
            pos: [px, frameH + lift, zCenter + screwSpreadZ],
            rot: [0, 0, 0],
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
                position={[totalW / 2, PLATE_H / 2, postD / 2]}
                size={[totalW, PLATE_H, postD]}
                vis={vis("bottomPlates")}
                label={`${stud} Bottom Plate (front) — ${toFraction(plateLen)}" long, cut from ${stud}×8' stock`}
              />
              <Lumber
                position={[totalW / 2, PLATE_H / 2, RACK_DEPTH - postD / 2]}
                size={[totalW, PLATE_H, postD]}
                vis={vis("bottomPlates")}
                label={`${stud} Bottom Plate (back) — ${toFraction(plateLen)}" long, cut from ${stud}×8' stock`}
              />
            </AnimatedGroup>
          </FadeGroup>

          {/* Top plates */}
          <FadeGroup vis={vis("topPlates")}>
            <AnimatedGroup
              targetPos={[0, topPlateExpY + (stepAnim.tp[1] as number), 0]}
            >
              <Lumber
                position={[totalW / 2, frameH - PLATE_H / 2, postD / 2]}
                size={[totalW, PLATE_H, postD]}
                vis={vis("topPlates")}
                label={`${stud} Top Plate (front) — ${toFraction(plateLen)}" long, cut from ${stud}×8' stock`}
              />
              <Lumber
                position={[
                  totalW / 2,
                  frameH - PLATE_H / 2,
                  RACK_DEPTH - postD / 2,
                ]}
                size={[totalW, PLATE_H, postD]}
                vis={vis("topPlates")}
                label={`${stud} Top Plate (back) — ${toFraction(plateLen)}" long, cut from ${stud}×8' stock`}
              />
            </AnimatedGroup>
          </FadeGroup>

          {/* Plywood top */}
          <FadeGroup vis={vis("plyTop")}>
            <AnimatedGroup targetPos={[0, plyTopExpY, 0]}>
              {vis("plyTop") !== "hidden" && (
                <HoverablePart
                  label={`3/4" Plywood Top — ${toFraction(plateLen)}" × 30", flush on top plates`}
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
                      position={[px, PLATE_H + postH / 2, postD / 2]}
                      size={[POST_W, postH, postD]}
                      vis={vis("posts")}
                      label={`${stud} Upright (front) — ${toFraction(postH)}" tall, ${postH >= 96 ? `full ${stud}×8', no cut` : `cut from ${stud}×8'`}`}
                    />
                    <Lumber
                      position={[
                        px,
                        PLATE_H + postH / 2,
                        RACK_DEPTH - postD / 2,
                      ]}
                      size={[POST_W, postH, postD]}
                      vis={vis("posts")}
                      label={`${stud} Upright (back) — ${toFraction(postH)}" tall, ${postH >= 96 ? `full ${stud}×8', no cut` : `cut from ${stud}×8'`}`}
                    />
                  </AnimatedGroup>
                </FadeGroup>

                {/* Right-face rails */}
                {i < cols &&
                  railCenters.map((railFromBottom, r) => {
                    const railY = PLATE_H + railFromBottom;
                    const railX = px + POST_W / 2 + railW / 2;
                    return (
                      <FadeGroup key={`rr-${i}-${r}`} vis={vis("rails")}>
                        <AnimatedGroup
                          targetPos={[
                            railExpX + (stepAnim.rails[0] as number),
                            stepAnim.rails[1] as number,
                            0,
                          ]}
                        >
                          {is2x4 ? (
                            <Lumber
                              position={[railX, railY, RACK_DEPTH / 2]}
                              size={[railW, railH, railLen]}
                              vis={vis("rails")}
                              label={`2×4 Rail (ripped) — 1-1/2" × 1-9/16" × ${railLen}" long, top edge ${toFraction(railFromBottom + railH / 2)}" from bottom of upright`}
                            />
                          ) : (
                            <PlywoodStrip
                              position={[railX, railY, RACK_DEPTH / 2]}
                              length={railLen}
                              height={railH}
                              vis={vis("rails")}
                              label={`3/4" Plywood Rail — ${isMini ? "1-1/4" : "1-7/8"}" × ${toFraction(railLen)}" long, top edge ${toFraction(railFromBottom + railH / 2)}" from bottom of upright`}
                            />
                          )}
                        </AnimatedGroup>
                      </FadeGroup>
                    );
                  })}

                {/* Left-face rails */}
                {i > 0 &&
                  railCenters.map((railFromBottom, r) => {
                    const railY = PLATE_H + railFromBottom;
                    const railX = px - POST_W / 2 - railW / 2;
                    return (
                      <FadeGroup key={`rl-${i}-${r}`} vis={vis("rails")}>
                        <AnimatedGroup
                          targetPos={[
                            -railExpX + (stepAnim.rails[0] as number),
                            stepAnim.rails[1] as number,
                            0,
                          ]}
                        >
                          {is2x4 ? (
                            <Lumber
                              position={[railX, railY, RACK_DEPTH / 2]}
                              size={[railW, railH, railLen]}
                              vis={vis("rails")}
                              label={`2×4 Rail (ripped) — 1-1/2" × 1-9/16" × ${railLen}" long, top edge ${toFraction(railFromBottom + railH / 2)}" from bottom of upright`}
                            />
                          ) : (
                            <PlywoodStrip
                              position={[railX, railY, RACK_DEPTH / 2]}
                              length={railLen}
                              height={railH}
                              vis={vis("rails")}
                              label={`3/4" Plywood Rail — ${isMini ? "1-1/4" : "1-7/8"}" × ${toFraction(railLen)}" long, top edge ${toFraction(railFromBottom + railH / 2)}" from bottom of upright`}
                            />
                          )}
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
                          [firstPostX, postD / 2],
                          [lastPostX, postD / 2],
                          [firstPostX, RACK_DEPTH - postD / 2],
                          [lastPostX, RACK_DEPTH - postD / 2],
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
                        position={[firstPostX, 0, postD / 2]}
                      >
                        <IndustrialCaster position={[0, 0, 0]} />
                      </HoverablePart>
                      <HoverablePart
                        label='5" Heavy-Duty Swivel Caster — 4 lag screws per mount plate'
                        position={[lastPostX, 0, postD / 2]}
                      >
                        <IndustrialCaster position={[0, 0, 0]} />
                      </HoverablePart>
                      <HoverablePart
                        label='5" Heavy-Duty Swivel Caster — 4 lag screws per mount plate'
                        position={[firstPostX, 0, RACK_DEPTH - postD / 2]}
                      >
                        <IndustrialCaster position={[0, 0, 0]} />
                      </HoverablePart>
                      <HoverablePart
                        label='5" Heavy-Duty Swivel Caster — 4 lag screws per mount plate'
                        position={[lastPostX, 0, RACK_DEPTH - postD / 2]}
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

        {/* ── BACK SUPPORTS — 30" strips laid flat diagonally on back face
             (plywood strips, or ripped 2×4 braces on 2×4-rail frames) ── */}
        {(() => {
          const bsVis = vis("backSupports");
          if (bsVis === "hidden") return null;
          const firstPostX = getPostX(0, bayW);
          const lastPostX = getPostX(cols, bayW);
          const bottomY = lift + PLATE_H;
          const topY = lift + frameH - PLATE_H;
          const braceLen = RACK_DEPTH; // 30" — same strips as tote rails
          const bsMat = is2x4
            ? bsVis === "ghosted" ? PINE_GHOST : PINE_MAT
            : bsVis === "ghosted" ? PLYWOOD_GHOST : PLYWOOD_MAT;
          // Plywood: 1-7/8" face × 3/4" thick. 2×4: 1-9/16" face × 1-1/2" thick.
          const braceFace = isMini ? MINI.railH : is2x4 ? RAILS_2X4.railH : RAIL_HEIGHT;
          const braceThick = is2x4 ? RAILS_2X4.railW : RAIL_THICKNESS;
          const braceScrewLen = isMini ? MINI.railScrewLength : is2x4 ? 3.0 : 1.625;
          const braceScrewLabel = isMini
            ? '#8 × 1-1/4" — through plywood brace into 2×3 plate/upright'
            : is2x4
            ? '#9 × 3" — through 2×4 brace into plate/upright'
            : '#9 × 1-5/8" — through brace into plate/post';
          const braceAngle = Math.PI / 4; // 45°
          // Sits ON the back face: 1-7/8" wide face flat against unit, 3/4" thick sticking out
          const backZ = RACK_DEPTH + braceThick / 2;
          // Half-span of a 30" brace at 45°
          const halfSpan = braceLen / (2 * Math.SQRT2);

          // 4 diagonal braces at the corners of the back face
          const braces: { pos: [number, number, number]; rot: number }[] = [
            // Bottom-left: from bottom plate corner, angled up-right
            { pos: [firstPostX + halfSpan, bottomY + halfSpan, backZ], rot: braceAngle },
            // Bottom-right: from bottom plate corner, angled up-left
            { pos: [lastPostX - halfSpan, bottomY + halfSpan, backZ], rot: -braceAngle },
            // Top-left: from top plate corner, angled down-right
            { pos: [firstPostX + halfSpan, topY - halfSpan, backZ], rot: -braceAngle },
            // Top-right: from top plate corner, angled down-left
            { pos: [lastPostX - halfSpan, topY - halfSpan, backZ], rot: braceAngle },
          ];
          // 2×4 frames: braces sized to the frame (short frames can't fit
          // 30" corner braces) — same layout the step text and counts use
          // Minis: the same sized layout, from 1-1/4" plywood strips
          const layout2x4 = is2x4 || isMini ? braceLayout2x4(cols, rows, sideways, isMini) : null;
          if (layout2x4) {
            const ox = firstPostX;
            const oy = lift + PLATE_H / 2; // bottom plate centerline
            braces.length = 0;
            for (const seg of layout2x4.segments) {
              const dx = seg.x2 - seg.x1;
              const dy = seg.y2 - seg.y1;
              braces.push({
                pos: [ox + (seg.x1 + seg.x2) / 2, oy + (seg.y1 + seg.y2) / 2, backZ],
                // Box runs along Y; rotate Y onto the segment direction
                rot: Math.atan2(-dx, dy),
              });
            }
          }
          const braceLength = layout2x4?.length ?? braceLen;

          return (
            <FadeGroup vis={bsVis}>
              {braces.map((b, i) => (
                <group key={`bs-${i}`} position={b.pos} rotation={[0, 0, b.rot]}>
                  {/* Plywood strip: 1-7/8" wide (X) × 30" long (Y) × 3/4" thick (Z) */}
                  <mesh material={bsMat} castShadow={bsVis === "visible"} receiveShadow={bsVis === "visible"}>
                    <boxGeometry args={[braceFace, braceLength, braceThick]} />
                  </mesh>
                  {/* Screws at each end — 2 per end, through brace face into plate/post beneath */}
                  {bsVis === "visible" && (
                    <>
                      <ConstructionScrew
                        position={[0, braceLength / 2 - 1.5, 0]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        length={braceScrewLen}
                        label={braceScrewLabel}
                        visible
                      />
                      <ConstructionScrew
                        position={[0, braceLength / 2 - 3.5, 0]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        length={braceScrewLen}
                        label={braceScrewLabel}
                        visible
                      />
                      <ConstructionScrew
                        position={[0, -braceLength / 2 + 1.5, 0]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        length={braceScrewLen}
                        label={braceScrewLabel}
                        visible
                      />
                      <ConstructionScrew
                        position={[0, -braceLength / 2 + 3.5, 0]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        length={braceScrewLen}
                        label={braceScrewLabel}
                        visible
                      />
                    </>
                  )}
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
        {/* Square check: tapes across the back face (it faces up, laid on its front) */}
        {mode === "step" && step.squareCheck && squareTapes?.on && (
          <SquareCheckTapes
            key={squareTapes.runKey}
            width={totalW}
            height={frameH}
            y0={lift}
            // Over the corner braces once they're on (step 8), else on the bare face
            z={RACK_DEPTH + (vis("backSupports") !== "hidden" ? (is2x4 ? RAILS_2X4.railW : RAIL_THICKNESS) : 0)}
            realWidth={plateLen}
            runKey={squareTapes.runKey}
            onLanded={squareTapes.onLanded}
          />
        )}
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
  distanceScale = 1,
  rails,
  sideways = false,
}: {
  cols: number;
  rows: number;
  toteType: ToteType;
  cameraHint?: string;
  hasWheels: boolean;
  /** < 1 frames the unit tighter (print renders have no zoom control) */
  distanceScale?: number;
  rails: RailStyle;
  sideways?: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const targetPos = useRef(new Vector3());
  const isFirstRender = useRef(true);
  const isAnimating = useRef(false);

  const { totalW, frameH } = frameGeometry(cols, rows, toteType, rails, sideways);
  const overallH = frameH + (hasWheels ? CASTER_HEIGHT : 0);

  const sw = totalW * S;
  const sh = overallH * S;
  const sd = RACK_DEPTH * S;
  const maxDim = Math.max(sw, sh, sd);
  const dist = maxDim * 2.8 * distanceScale;

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
  expanded,
  onToggleExpanded,
  squareTapesOn = false,
  onToggleSquareTapes,
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
  /** Collapsed = compact bar (title, 2-line instruction, nav) so the 3D view stays usable */
  expanded: boolean;
  onToggleExpanded: () => void;
  /** Square-check steps: the tape measures are showing in the 3D */
  squareTapesOn?: boolean;
  onToggleSquareTapes?: () => void;
}) {
  const materials = computeMaterials(step, cols, rows, config);
  const isLast = stepIndex === totalSteps - 1;

  // Resolve token placeholders in instruction text
  const measure = useMeasure();
  const resolvedInstruction = measure(resolveTokens(step.instruction, cols, rows, config));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Step header */}
      <div className={`shrink-0 border-b border-slate-700 ${expanded ? "px-5 py-4" : "px-4 py-3"}`}>
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-gray-950">
            {stepIndex + 1}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            className="ml-auto flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-bold text-stone-300 transition hover:border-yellow-400/50 hover:text-yellow-300"
          >
            {expanded ? "Hide details" : "Details"}
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : "-rotate-90"}`} />
          </button>
        </div>
        <h3 className={`${expanded ? "text-lg" : "text-base"} font-extrabold text-white`}>{measure(step.title)}</h3>
        {!expanded && (
          <button type="button" onClick={onToggleExpanded} className="mt-1 block text-left">
            <span className="line-clamp-2 text-xs leading-snug text-stone-400">{resolvedInstruction}</span>
          </button>
        )}
        {/* Collapsed bar on a square-check step: the same switch as the Pro Tip */}
        {!expanded && step.squareCheck && onToggleSquareTapes && (
          <button
            type="button"
            onClick={onToggleSquareTapes}
            aria-pressed={squareTapesOn}
            className="mt-2 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            {squareTapesOn ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                Tape measures on · hide
              </>
            ) : (
              <>
                <span className="relative flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <Ruler className="h-3 w-3" aria-hidden />
                Pro tip: check for square in 3D
              </>
            )}
          </button>
        )}
        {/* Progress bar */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-yellow-400 transition-all duration-500"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Scrollable content area */}
      <div className={`scrollbar-dark min-h-0 flex-1 overflow-y-auto ${expanded ? "" : "hidden"}`}>
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
                  title={tool.detail ? measure(resolveTokens(tool.detail, cols, rows, config)) : undefined}
                >
                  {measure(tool.name)}
                  {tool.detail && (
                    <span className="text-stone-600">({measure(resolveTokens(tool.detail, cols, rows, config))})</span>
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
                {measure(step.screwType.label, { keep: true })}
              </p>
              <p className="text-[11px] text-stone-400">
                {measure(step.screwType.description)}
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
                  <p className="text-sm font-medium text-white">{measure(m.name, { keep: true })}</p>
                  <p className="text-[10px] text-stone-500">{measure(m.detail)}</p>
                </div>
                <span className="font-mono text-sm font-bold text-yellow-400">
                  ×{m.qty}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pro tip — on square-check steps it also shows the tape measures in 3D */}
        {step.proTip && (
          <div className="px-5 pb-4">
            {step.squareCheck && onToggleSquareTapes ? (
              <button
                type="button"
                onClick={onToggleSquareTapes}
                aria-pressed={squareTapesOn}
                className={`group w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  squareTapesOn
                    ? "border-emerald-400/50 bg-emerald-500/10"
                    : "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-400/40 hover:bg-emerald-500/10"
                }`}
              >
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Pro Tip</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400">{measure(step.proTip)}</p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                      {squareTapesOn ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                          Showing in 3D · tap to hide
                        </>
                      ) : (
                        <>
                          <span className="relative flex h-1.5 w-1.5" aria-hidden>
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          </span>
                          <Ruler className="h-3 w-3" aria-hidden />
                          Tap to see it in 3D
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </button>
            ) : (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Pro Tip</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400">{measure(step.proTip)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation — always visible at bottom */}
      <div className={`shrink-0 border-t border-slate-700 ${expanded ? "px-5 py-4" : "px-4 py-2.5"}`}>
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
  /** Replaces the "{cols}×{rows} {tote} Storage Unit" title (e.g. "Module A") */
  label?: string;
  /** Extra panel stacked under the top-left badge (e.g. a module map) */
  hud?: React.ReactNode;
  /** Rail construction — installers default to plywood; DIY plans use 2×4 */
  rails?: RailStyle;
  /** 2×4 rails only: totes turned 90° (30-1/4" bays, 20" deep) */
  sideways?: boolean;
  /** Called with the step shown (1-based) and the step count, in step mode */
  onStep?: (step: number, total: number) => void;
}

export default function AssemblyGuide({
  cols,
  rows,
  toteType,
  hasWheels: hasWheelsProp = true,
  hasTop = false,
  onClose,
  label,
  hud,
  rails = "plywood",
  sideways = false,
  onStep,
}: AssemblyGuideProps) {
  // Mini racks never roll (a 2×3 plate is narrower than a caster plate)
  const hasWheels = toteType === "MINI" ? false : hasWheelsProp;
  const config: BuildConfig = { hasWheels, hasTop, toteType, rails, sideways };
  const steps = useMemo(() => getStepsForConfig(config), [hasWheels, hasTop, toteType, rails, sideways]); // eslint-disable-line react-hooks/exhaustive-deps

  const [mode, setMode] = useState<"exploded" | "step">("exploded");
  // Phones start with the compact step bar so the 3D view stays usable;
  // wider screens have room beside the model for the full card.
  const [detailsOpen, setDetailsOpen] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 640px)").matches,
  );
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (mode === "step" && steps.length) onStep?.(stepIndex + 1, steps.length);
  }, [mode, stepIndex, steps.length, onStep]);

  // The piece whose label is showing (tap to show, tap again to hide).
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const partLabels = useMemo(() => ({ selected: selectedPart, setSelected: setSelectedPart }), [selectedPart]);

  const handleStartBuild = useCallback(() => {
    setSelectedPart(null);
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
    setSelectedPart(null);
    setMode("exploded");
    setStepIndex(0);
  }, []);

  // A label from one step shouldn't linger into the next.
  useEffect(() => setSelectedPart(null), [stepIndex]);

  // Square-check tape measures (Pro Tip on steps that check for square).
  // Turning them on folds the step card away first, so the 3D is in view
  // when the tapes start pulling. They stay until the Pro Tip is tapped
  // again, or the step changes.
  const [squareTapes, setSquareTapes] = useState({ on: false, runKey: 0 });
  const [tapesLanded, setTapesLanded] = useState(0);
  const tapeProps = useMemo(() => ({ ...squareTapes, onLanded: setTapesLanded }), [squareTapes]);
  const guideMeasure = useMeasure();
  useEffect(() => setSquareTapes((t) => (t.on ? { ...t, on: false } : t)), [stepIndex, mode]);
  const toggleSquareTapes = useCallback(() => {
    if (squareTapes.on) {
      setSquareTapes({ ...squareTapes, on: false });
      return;
    }
    setDetailsOpen(false);
    setSelectedPart(null);
    setTapesLanded(0);
    setSquareTapes({ on: true, runKey: squareTapes.runKey + 1 });
  }, [squareTapes]);

  return (
    <div className="relative h-full w-full bg-slate-950">
      {/* ── Full-screen 3D Viewport ─────────────────────────────────── */}
      <PartLabelContext.Provider value={partLabels}>
      <Canvas
        shadows
        camera={{ fov: 40 }}
        gl={{ antialias: true, alpha: false }}
        style={{ touchAction: "none", position: "absolute", inset: 0 }}
        onPointerMissed={() => setSelectedPart(null)}
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
          rails={rails}
          sideways={sideways}
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
          rails={rails}
          sideways={sideways}
          squareTapes={tapeProps}
        />
      </Canvas>
      </PartLabelContext.Provider>

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
            <div className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-5.5rem)]">
              <div className="rounded-xl bg-slate-900/90 px-5 py-3 shadow-xl backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                  Exploded View
                </p>
                <p className="mt-0.5 text-sm font-semibold text-white">
                  {label ?? (toteType === "MINI" ? `${cols}×${rows} Mini Tote Rack` : `${cols}×${rows} ${toteType} Storage Unit`)}
                </p>
                <p className="text-xs text-stone-400">
                  Tap any piece for dimensions
                  {hasWheels ? " — with casters" : ""}
                  {hasTop ? " — with top" : ""}
                </p>
              </div>
              {hud && <div className="pointer-events-auto mt-2">{hud}</div>}
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
            {/* Square check: once both tapes land, what "square" means */}
            {currentStep.squareCheck && squareTapes.on && tapesLanded >= 2 && (
              <div className="pointer-events-none absolute inset-x-4 top-16 flex justify-center sm:top-4">
                <p className="rounded-xl border border-yellow-400/35 bg-slate-900/90 px-3 py-1.5 text-center text-xs font-bold text-stone-100 shadow-lg backdrop-blur">
                  <span className="text-emerald-400">✓</span> {guideMeasure('Diagonals match within ±1/8" = square')}
                </p>
              </div>
            )}
            {/* Config badge — top left */}
            <div className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-5.5rem)]">
              <div className="rounded-lg bg-slate-900/80 px-3 py-1.5 shadow-lg backdrop-blur">
                <p className="text-[10px] font-bold text-stone-400">
                  {label ? `${label} · ` : ""}
                  {cols}×{rows} {toteType === "MINI" ? "Mini" : toteType}
                  {hasWheels ? " + Wheels" : ""}
                  {hasTop ? " + Top" : ""}
                </p>
              </div>
              {hud && <div className="pointer-events-auto mt-2">{hud}</div>}
            </div>

            {/* Floating Step Card — bottom left on desktop, bottom full-width on mobile */}
            <div
              className={`pointer-events-auto absolute bottom-4 left-4 right-4 flex flex-col sm:right-auto sm:w-[400px] ${
                // Leave the top-left badge + hud panel uncovered on short screens
                hud ? "max-h-[min(70vh,calc(100dvh-15rem))]" : "max-h-[70vh]"
              }`}
            >
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
                  expanded={detailsOpen}
                  onToggleExpanded={() => setDetailsOpen((v) => !v)}
                  squareTapesOn={squareTapes.on}
                  onToggleSquareTapes={toggleSquareTapes}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP SNAPSHOTS — renders every guide step offscreen, one still per step
//
// Feeds the printable PDF the same scenes, camera angles and ghosting as
// the interactive guide. Each step gets a fresh Canvas so the camera rig
// places itself instantly, and SnapContext makes the parts land on their
// targets on the first frame.
// ═══════════════════════════════════════════════════════════════════════════

export interface AssemblyStepSnapshot {
  stepId: string;
  imageDataUrl: string;
}

const SNAPSHOT_SETTLE_FRAMES = 12;

function FrameCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const { gl, scene, camera } = useThree();
  const frames = useRef(0);
  const done = useRef(false);

  useFrame(() => {
    if (done.current) return;
    frames.current += 1;
    if (frames.current < SNAPSHOT_SETTLE_FRAMES) return;
    done.current = true;
    gl.render(scene, camera);
    onCapture(gl.domElement.toDataURL("image/jpeg", 0.9));
  });

  return null;
}

export function AssemblyStepSnapshots({
  cols,
  rows,
  toteType,
  hasWheels: hasWheelsProp = true,
  hasTop = false,
  width = 1400,
  height = 1050,
  rails = "plywood",
  sideways = false,
  onProgress,
  onComplete,
}: {
  cols: number;
  rows: number;
  toteType: ToteType;
  hasWheels?: boolean;
  hasTop?: boolean;
  width?: number;
  height?: number;
  rails?: RailStyle;
  sideways?: boolean;
  onProgress?: (done: number, total: number) => void;
  onComplete: (snapshots: AssemblyStepSnapshot[]) => void;
}) {
  const hasWheels = toteType === "MINI" ? false : hasWheelsProp;
  const steps = useMemo(
    () => getStepsForConfig({ hasWheels, hasTop, toteType, rails }),
    [hasWheels, hasTop, toteType, rails],
  );
  const [index, setIndex] = useState(0);
  const results = useRef<AssemblyStepSnapshot[]>([]);

  const handleCapture = useCallback(
    (dataUrl: string) => {
      const step = steps[index];
      results.current.push({ stepId: step.id, imageDataUrl: dataUrl });
      onProgress?.(results.current.length, steps.length);
      if (index + 1 < steps.length) {
        setIndex(index + 1);
      } else {
        onComplete(results.current);
      }
    },
    [index, steps, onProgress, onComplete],
  );

  const step = steps[index];
  if (!step || results.current.length >= steps.length) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: -10000,
        top: 0,
        width,
        height,
        pointerEvents: "none",
      }}
    >
      <SnapContext.Provider value>
        <Canvas
          key={step.id}
          shadows
          dpr={1}
          camera={{ fov: 40 }}
          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
          style={{ width, height }}
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
          {/* No ContactShadows: its plane captures as a solid gray wedge. */}
          <GuideCameraRig
            cols={cols}
            rows={rows}
            toteType={toteType}
            cameraHint={step.cameraHint}
            hasWheels={hasWheels}
            distanceScale={0.62}
            rails={rails}
            sideways={sideways}
          />
          <ExplodedAssembly
            cols={cols}
            rows={rows}
            toteType={toteType}
            mode="step"
            stepIndex={index}
            steps={steps}
            hasWheels={hasWheels}
            hasTop={hasTop}
            rails={rails}
            sideways={sideways}
            // Square-check steps print with the tapes laid across the diagonals
            squareTapes={{ on: true, runKey: 0 }}
          />
          <FrameCapture onCapture={handleCapture} />
        </Canvas>
      </SnapContext.Provider>
    </div>
  );
}
