"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — interactive 3D build guide
//
// Walks a custom design's plan one step at a time, in the same spirit as
// the tote-rack guide: the pieces a step adds drop into place outlined in
// yellow, everything built before stays solid, everything still to come is
// hidden. Drag to rotate, pinch or scroll to zoom, tap a piece for its part
// letter and size, and "Explode" pulls the build apart to show how it goes
// together.
//
// The step panel sits beside the model on wide screens and under it on a
// phone, sized so the model stays visible while reading.
//
// Also here: PlanSnapshots, which renders every step off-screen for the PDF
// using the same scene, so the printed pictures match the guide.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MathUtils, Vector3, type Group, type PerspectiveCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ChevronLeft, ChevronRight, Expand, Lightbulb, Shrink, Wrench, X } from "lucide-react";
import PieceBody, { PIECE_EDGE_COLOR, TextureGuard } from "@/components/builder/PieceBody";
import { COLORS } from "@/components/builder/viewport";
import type { CustomPlan, PlanStep } from "@/lib/builder/plan";
import { boundsOf, pieceLabel, type Scene, type ScenePiece, type Vec3 } from "@/lib/builder/scene";
import { formatInches } from "@/lib/builder/units";

/** Inches → scene units (same scale as the editor's 3D view) */
const S = 1 / 48;
const FOV = 40;
/** How far a step's pieces drop in from, inches */
const DROP_IN = 9;
/** How far "Explode" pushes pieces out from the middle (1 = not at all) */
const EXPLODE = 1.4;
const VIEW_DIRECTION = new Vector3(0.75, 0.6, 1).normalize();

// ── Scene ────────────────────────────────────────────────────────────────

/** The guide's lighting: identical to the tote-rack guide and the editor. */
function Lights() {
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[12, 18, 12]}
        intensity={1.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-10, 12, -8]} intensity={0.5} />
      <directionalLight position={[0, 6, -12]} intensity={0.3} />
      <hemisphereLight args={["#ffffff", "#f5ead6", 0.5]} />
    </>
  );
}

/** Where the camera sits to see a whole build. */
function framing(scene: Scene, aspect: number, tightness = 1.15): { position: Vector3; target: Vector3 } {
  const b = boundsOf(scene.pieces);
  const min = b ? b.min : ([-24, 0, -24] as Vec3);
  const max = b ? b.max : ([24, 24, 24] as Vec3);
  const target = new Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2).multiplyScalar(S);
  const radius = Math.max(new Vector3(max[0] - min[0], max[1] - min[1], max[2] - min[2]).length() / 2, 12) * S;
  const distance = (radius / Math.sin(MathUtils.degToRad(FOV / 2))) * (tightness / Math.min(1, aspect));
  return { position: target.clone().addScaledVector(VIEW_DIRECTION, distance), target };
}

/** One piece, eased toward where this step wants it (in place, exploded, or dropping in). */
function GuidePiece({
  piece,
  offset,
  current,
  animate,
  onPick,
}: {
  piece: ScenePiece;
  /** Where the piece should be, relative to its place in the build (inches) */
  offset: Vec3;
  current: boolean;
  animate: boolean;
  onPick?: (piece: ScenePiece) => void;
}) {
  const group = useRef<Group>(null);
  const rotation = useMemo(
    () => piece.rotation.map((d) => MathUtils.degToRad(d)) as [number, number, number],
    [piece.rotation],
  );
  // A piece that is new this step starts above its place and settles down.
  const shift = useRef<Vec3>(animate && current ? [offset[0], offset[1] + DROP_IN, offset[2]] : offset);
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    if (!animate) shift.current = offset;
    const g = group.current;
    if (g) g.position.set(piece.position[0] + shift.current[0], piece.position[1] + shift.current[1], piece.position[2] + shift.current[2]);
    invalidate();
  }, [animate, invalidate, offset, piece.position]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g || !animate) return;
    const s = shift.current;
    const gap = Math.abs(s[0] - offset[0]) + Math.abs(s[1] - offset[1]) + Math.abs(s[2] - offset[2]);
    if (gap < 0.01) return;
    const k = 1 - Math.exp(-dt * 7);
    shift.current = [s[0] + (offset[0] - s[0]) * k, s[1] + (offset[1] - s[1]) * k, s[2] + (offset[2] - s[2]) * k];
    g.position.set(piece.position[0] + shift.current[0], piece.position[1] + shift.current[1], piece.position[2] + shift.current[2]);
  });

  return (
    <group
      ref={group}
      rotation={rotation}
      onPointerDown={
        onPick
          ? (e) => {
              e.stopPropagation();
              onPick(piece);
            }
          : undefined
      }
    >
      <PieceBody piece={piece} edgeColor={current ? COLORS.select : PIECE_EDGE_COLOR} edgeWidth={current ? 3 : 1} />
    </group>
  );
}

/** The build as it stands at one step. */
function StepScene({
  scene,
  plan,
  stepIndex,
  exploded,
  animate,
  onPick,
}: {
  scene: Scene;
  plan: CustomPlan;
  stepIndex: number;
  exploded: boolean;
  animate: boolean;
  onPick?: (piece: ScenePiece) => void;
}) {
  const step = plan.steps[stepIndex];
  // Which step each piece arrives in
  const arrives = useMemo(() => {
    const map = new Map<string, number>();
    plan.steps.forEach((s, i) => s.pieceIds.forEach((id) => map.set(id, i)));
    return map;
  }, [plan.steps]);
  const center = useMemo(() => {
    const b = boundsOf(scene.pieces);
    return b ? ([(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2] as Vec3) : ([0, 0, 0] as Vec3);
  }, [scene.pieces]);
  // A step that adds nothing (cutting) shows the finished build.
  const overview = !step || step.pieceIds.length === 0;
  const zero = useMemo<Vec3>(() => [0, 0, 0], []);

  return (
    <group scale={S}>
      {scene.pieces.map((piece) => {
        const at = arrives.get(piece.id) ?? 0;
        if (!overview && at > stepIndex) return null;
        const offset: Vec3 = exploded
          ? [
              (piece.position[0] - center[0]) * (EXPLODE - 1),
              (piece.position[1] - center[1]) * (EXPLODE - 1),
              (piece.position[2] - center[2]) * (EXPLODE - 1),
            ]
          : zero;
        return (
          <GuidePiece
            // Remount when it becomes the step's new piece, so it drops in again
            key={`${piece.id}:${!overview && at === stepIndex ? stepIndex : "built"}`}
            piece={piece}
            offset={offset}
            current={!overview && at === stepIndex}
            animate={animate}
            onPick={onPick}
          />
        );
      })}
    </group>
  );
}

function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.001, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <shadowMaterial transparent opacity={0.14} />
    </mesh>
  );
}

function GuideCamera({ scene }: { scene: Scene }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useRef<OrbitControlsImpl | null>(null);
  useLayoutEffect(() => {
    const { position, target } = framing(scene, camera.aspect);
    camera.position.copy(position);
    controls.current?.target.copy(target);
    controls.current?.update();
    // Frame once: the camera stays put while stepping, so the build doesn't jump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan
      panSpeed={0.5}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI / 2 - 0.03}
      minDistance={0.3}
      maxDistance={60}
      enableDamping
      dampingFactor={0.1}
    />
  );
}

// ── Step panel ───────────────────────────────────────────────────────────

function StepPanel({ step, total }: { step: PlanStep; total: number }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
          Step {step.number} of {total}
        </p>
        <h2 className="text-lg font-black leading-tight text-white">{step.title}</h2>
      </div>
      <p className="text-sm leading-relaxed text-stone-300">{step.instruction}</p>

      {(step.parts.length > 0 || step.fasteners.length > 0) && (
        <ul className="space-y-1 rounded-xl bg-slate-800/60 p-3">
          {step.parts.map((p) => (
            <li key={`${p.letter}${p.label}${p.size}`} className="flex gap-2 text-xs text-stone-300">
              <span className="w-7 shrink-0 font-mono font-bold text-yellow-400">{p.qty}×</span>
              <span className="min-w-0 flex-1">
                {p.label}
                {p.size && <span className="text-stone-500"> · {p.size}</span>}
              </span>
            </li>
          ))}
          {step.fasteners.map((f) => (
            <li key={f.name} className="flex gap-2 text-xs text-orange-200">
              <span className="w-7 shrink-0 font-mono font-bold text-orange-300">{f.qty}×</span>
              <span className="min-w-0 flex-1">{f.name}</span>
            </li>
          ))}
        </ul>
      )}

      {step.tools.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-stone-500" />
          {step.tools.map((t) => (
            <span key={t} className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] text-stone-300">
              {t}
            </span>
          ))}
        </div>
      )}

      {step.tip && (
        <div className="flex gap-2 rounded-xl bg-yellow-400/10 p-3">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-400" />
          <p className="text-xs italic text-yellow-100/90">{step.tip}</p>
        </div>
      )}
    </div>
  );
}

// ── Guide ────────────────────────────────────────────────────────────────

export default function BuilderGuide({ scene, plan, onClose }: { scene: Scene; plan: CustomPlan; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [exploded, setExploded] = useState(false);
  const [picked, setPicked] = useState<ScenePiece | null>(null);
  const total = plan.steps.length;
  const step = plan.steps[Math.min(index, total - 1)];
  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(total - 1, i))), [total]);

  // Arrow keys step through; Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "Escape") onClose();
      else return;
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [go, index, onClose]);

  // A picked piece's label goes away when the step changes
  useEffect(() => setPicked(null), [index]);

  if (!step) return null;
  const letter = picked ? plan.letterOf[picked.id] : "";

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 lg:flex-row">
      {/* Model */}
      <div className="relative min-h-0 flex-1">
        <Canvas
          shadows
          camera={{ fov: FOV, near: 0.05, far: 400 }}
          gl={{ antialias: true, alpha: false }}
          style={{ touchAction: "none", position: "absolute", inset: 0 }}
          onPointerMissed={() => setPicked(null)}
        >
          <color attach="background" args={["#ffffff"]} />
          <Lights />
          <Floor />
          <TextureGuard />
          <GuideCamera scene={scene} />
          <StepScene scene={scene} plan={plan} stepIndex={index} exploded={exploded} animate onPick={setPicked} />
        </Canvas>

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="pointer-events-auto max-w-[60%] rounded-xl bg-slate-900/95 px-3 py-2 shadow-lg backdrop-blur">
            <p className="truncate text-xs font-black text-white">{plan.name}</p>
            <p className="text-[10px] text-stone-400">Drag to rotate · pinch to zoom · tap a part</p>
          </div>
          <div className="pointer-events-auto flex gap-1.5">
            <button
              type="button"
              onClick={() => setExploded((v) => !v)}
              aria-pressed={exploded}
              className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold shadow-lg transition ${
                exploded ? "bg-yellow-400 text-gray-950" : "bg-slate-900/95 text-stone-200 hover:text-yellow-300"
              }`}
            >
              {exploded ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
              {exploded ? "Assemble" : "Explode"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close guide"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/95 text-white shadow-lg transition hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {picked && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl bg-slate-900/95 px-3 py-2 shadow-lg">
            <p className="text-xs font-bold text-white">
              {letter && <span className="mr-1.5 rounded bg-yellow-400 px-1.5 py-0.5 font-mono text-gray-950">{letter}</span>}
              {pieceLabel(picked)}
            </p>
            <p className="font-mono text-[11px] text-stone-400">
              {formatInches(picked.length)} × {formatInches(picked.width)} × {formatInches(picked.thickness)}
            </p>
          </div>
        )}
      </div>

      {/* Step */}
      <div className="flex max-h-[46dvh] shrink-0 flex-col border-t border-slate-800 bg-slate-900 lg:max-h-none lg:w-[380px] lg:border-l lg:border-t-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <StepPanel step={step} total={total} />
        </div>
        <div className="shrink-0 border-t border-slate-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-700 text-sm font-bold text-stone-200 transition hover:border-yellow-400/50 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => (index === total - 1 ? onClose() : go(index + 1))}
              className="flex h-12 flex-[2] items-center justify-center gap-1 rounded-xl bg-yellow-400 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300"
            >
              {index === total - 1 ? "Done" : "Next step"} {index < total - 1 && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PlanSnapshots — every step as a picture, for the PDF
//
// One off-screen canvas per shot (the finished build first, then each
// step), captured once the frame has settled. Keys are "overview" and the
// step ids.
// ═══════════════════════════════════════════════════════════════════════════

export const OVERVIEW_SNAPSHOT = "overview";
const SETTLE_FRAMES = 8;

function SnapshotCamera({ scene }: { scene: Scene }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    const { position, target } = framing(scene, camera.aspect, 0.82);
    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, scene]);
  return null;
}

function FrameCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const { gl, scene, camera } = useThree();
  const frames = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    frames.current += 1;
    if (frames.current < SETTLE_FRAMES) return;
    done.current = true;
    gl.render(scene, camera);
    onCapture(gl.domElement.toDataURL("image/jpeg", 0.9));
  });
  return null;
}

export function PlanSnapshots({
  scene,
  plan,
  width = 1200,
  height = 820,
  onProgress,
  onComplete,
}: {
  scene: Scene;
  plan: CustomPlan;
  width?: number;
  height?: number;
  onProgress?: (done: number, total: number) => void;
  onComplete: (snapshots: Record<string, string>) => void;
}) {
  // The finished build, then each step that adds pieces
  const shots = useMemo(
    () => [
      { key: OVERVIEW_SNAPSHOT, stepIndex: -1 },
      ...plan.steps.map((s, i) => ({ key: s.id, stepIndex: i })).filter((s) => plan.steps[s.stepIndex].pieceIds.length > 0),
    ],
    [plan.steps],
  );
  const [index, setIndex] = useState(0);
  const results = useRef<Record<string, string>>({});

  const handleCapture = useCallback(
    (dataUrl: string) => {
      results.current[shots[index].key] = dataUrl;
      onProgress?.(index + 1, shots.length);
      if (index + 1 < shots.length) setIndex(index + 1);
      else onComplete(results.current);
    },
    [index, shots, onProgress, onComplete],
  );

  const shot = shots[index];
  if (!shot) return null;
  return (
    <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, width, height, pointerEvents: "none" }}>
      <Canvas
        key={shot.key}
        shadows
        dpr={1}
        camera={{ fov: FOV, near: 0.05, far: 400 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        style={{ width, height }}
      >
        <color attach="background" args={["#ffffff"]} />
        <Lights />
        <Floor />
        <SnapshotCamera scene={scene} />
        <StepScene scene={scene} plan={plan} stepIndex={shot.stepIndex} exploded={false} animate={false} />
        <FrameCapture onCapture={handleCapture} />
      </Canvas>
    </div>
  );
}

/** How many pictures PlanSnapshots will take (for a progress bar). */
export function snapshotCount(plan: CustomPlan): number {
  return 1 + plan.steps.filter((s) => s.pieceIds.length > 0).length;
}
