"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — 3D view
//
// Draws the scene with the same procedural lumber and plywood materials and
// the same lighting as the tote-rack build guide, so a custom design looks
// like the rest of the plans.
//
//   • Click a piece to select it; Shift-click adds to / removes from the
//     selection; click empty space to clear it.
//   • Drag a piece to slide it across the floor plane at its own height.
//     Hold Alt while dragging to raise or lower it instead.
//   • Drag empty space to orbit, right-drag or two fingers to pan, wheel or
//     pinch to zoom.
//
// The scene is in inches; the whole thing is drawn at 1/48 scale (the scale
// the rest of the site's 3D uses) so lights and shadows behave the same.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, Grid, OrbitControls } from "@react-three/drei";
import { MathUtils, Plane, Vector3, type MeshStandardMaterial, type PerspectiveCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  createConstructionLumberMaterial,
  createPlywoodTopMaterial,
  restoreAllTextures,
} from "@/components/visualizer/woodTextures";
import { getStock } from "@/lib/builder/catalog";
import { beginDrag, dragPositions, type DragStart } from "@/lib/builder/drag";
import { boundsOf, type Scene, type ScenePiece, type Vec3 } from "@/lib/builder/scene";

/** Inches → scene units */
const S = 1 / 48;
const FOV = 40;
const SELECT_COLOR = "#facc15";
const EDGE_COLOR = "#8a744a";
/** Pointer travel (px) before a press on a piece becomes a drag */
const DRAG_THRESHOLD_PX = 4;

/** Camera position and orbit target, kept by the workspace across 2D ↔ 3D switches. */
export interface CameraMemory {
  position: [number, number, number];
  target: [number, number, number];
}

interface Props {
  scene: Scene;
  selection: string[];
  gridStep: number;
  onSelect: (ids: string[]) => void;
  onToggleSelect: (id: string) => void;
  onMove: (positions: Record<string, Vec3>) => void;
  /** Change this number to re-frame the camera on the whole build */
  frameRequest: number;
  cameraMemory: MutableRefObject<CameraMemory | null>;
}

// ── Materials (made once, in the browser) ────────────────────────────────

let materials: Record<"lumber" | "plywood", MeshStandardMaterial> | null = null;

function getMaterials() {
  materials ??= {
    lumber: createConstructionLumberMaterial(42),
    plywood: createPlywoodTopMaterial(250),
  };
  return materials;
}

/** Re-uploads the procedural textures when the tab comes back (browsers may drop them). */
function TextureGuard() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        restoreAllTextures();
        invalidate();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [invalidate]);
  return null;
}

// ── Camera ───────────────────────────────────────────────────────────────

/** Looks at the build from the front-right, a little above. */
const VIEW_DIRECTION = new Vector3(0.75, 0.6, 1).normalize();

function CameraRig({
  scene,
  frameRequest,
  cameraMemory,
}: Pick<Props, "scene" | "frameRequest" | "cameraMemory">) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const frame = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const b = boundsOf(sceneRef.current.pieces);
    // Nothing built yet: look at an 8 ft patch of floor.
    const min = b ? b.min : ([-48, 0, -24] as Vec3);
    const max = b ? b.max : ([48, 36, 24] as Vec3);
    const center = new Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2).multiplyScalar(S);
    const radius = Math.max(new Vector3(max[0] - min[0], max[1] - min[1], max[2] - min[2]).length() / 2, 18) * S;
    const narrow = Math.min(1, camera.aspect);
    const distance = (radius / Math.sin(MathUtils.degToRad(FOV / 2))) * (1.15 / narrow);
    camera.position.copy(center).addScaledVector(VIEW_DIRECTION, distance);
    controls.target.copy(center);
    controls.update();
  }, [camera]);

  // First mount: go back to where the camera was, or frame the build.
  useLayoutEffect(() => {
    const controls = controlsRef.current;
    const memory = cameraMemory.current;
    if (controls && memory) {
      camera.position.set(...memory.position);
      controls.target.set(...memory.target);
      controls.update();
    } else {
      frame();
    }
    return () => {
      const c = controlsRef.current;
      if (c) cameraMemory.current = { position: camera.position.toArray(), target: c.target.toArray() };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstRequest = useRef(frameRequest);
  useEffect(() => {
    if (frameRequest !== firstRequest.current) frame();
  }, [frameRequest, frame]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan
      panSpeed={0.6}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      // Stay above the floor
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI / 2 - 0.03}
      minDistance={0.3}
      maxDistance={60}
      enableDamping
      dampingFactor={0.1}
    />
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

interface ActiveDrag {
  pointerId: number;
  start: DragStart;
  /** Where the pointer first hit, scene units */
  origin: Vector3;
  plane: Plane;
  vertical: boolean;
  downX: number;
  downY: number;
  moving: boolean;
}

function PieceMesh({
  piece,
  selected,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  piece: ScenePiece;
  selected: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>, piece: ScenePiece) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const look = getStock(piece.stock)?.look ?? "lumber";
  const rotation = useMemo(
    () => piece.rotation.map((d) => MathUtils.degToRad(d)) as [number, number, number],
    [piece.rotation],
  );
  return (
    <mesh
      position={piece.position}
      rotation={rotation}
      material={getMaterials()[look]}
      castShadow
      receiveShadow
      onPointerDown={(e) => onPointerDown(e, piece)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <boxGeometry args={[piece.length, piece.thickness, piece.width]} />
      <Edges threshold={15} color={selected ? SELECT_COLOR : EDGE_COLOR} lineWidth={selected ? 2.5 : 1} />
    </mesh>
  );
}

function Pieces({ scene, selection, gridStep, onSelect, onToggleSelect, onMove }: Omit<Props, "frameRequest" | "cameraMemory">) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const drag = useRef<ActiveDrag | null>(null);
  const selected = useMemo(() => new Set(selection), [selection]);
  const hit = useMemo(() => new Vector3(), []);

  const handleDown = useCallback(
    (e: ThreeEvent<PointerEvent>, piece: ScenePiece) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      if (e.shiftKey) {
        onToggleSelect(piece.id);
        return;
      }
      const already = selected.has(piece.id);
      if (!already) onSelect([piece.id]);
      const dragged = already ? scene.pieces.filter((p) => selected.has(p.id)) : [piece];

      // Alt: raise / lower on an upright plane facing the camera.
      // Otherwise: slide on a level plane through the point that was hit.
      const vertical = e.altKey;
      const normal = new Vector3(0, 1, 0);
      if (vertical) {
        camera.getWorldDirection(normal);
        normal.y = 0;
        if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1);
        normal.normalize();
      }
      drag.current = {
        pointerId: e.pointerId,
        start: beginDrag(dragged, piece.id),
        origin: e.point.clone(),
        plane: new Plane().setFromNormalAndCoplanarPoint(normal, e.point),
        vertical,
        downX: e.nativeEvent.clientX,
        downY: e.nativeEvent.clientY,
        moving: false,
      };
      (e.target as Element).setPointerCapture(e.pointerId);
      if (controls) controls.enabled = false;
    },
    [camera, controls, onSelect, onToggleSelect, scene.pieces, selected],
  );

  const handleMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      e.stopPropagation();
      if (!d.moving) {
        const travel = Math.hypot(e.nativeEvent.clientX - d.downX, e.nativeEvent.clientY - d.downY);
        if (travel < DRAG_THRESHOLD_PX) return;
        d.moving = true;
      }
      if (!e.ray.intersectPlane(d.plane, hit)) return;
      const delta: Vec3 = d.vertical
        ? [0, (hit.y - d.origin.y) / S, 0]
        : [(hit.x - d.origin.x) / S, 0, (hit.z - d.origin.z) / S];
      onMove(dragPositions(d.start, delta, gridStep));
    },
    [gridStep, hit, onMove],
  );

  const handleUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      e.stopPropagation();
      drag.current = null;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      if (controls) controls.enabled = true;
    },
    [controls],
  );

  // Never leave orbiting switched off if the view goes away mid-drag.
  useEffect(
    () => () => {
      if (controls) controls.enabled = true;
    },
    [controls],
  );

  return (
    <group scale={S}>
      {scene.pieces.map((piece) => (
        <PieceMesh
          key={piece.id}
          piece={piece}
          selected={selected.has(piece.id)}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
        />
      ))}
    </group>
  );
}

// ── View ─────────────────────────────────────────────────────────────────

export default function BuilderViewport3D(props: Props) {
  const { scene, onSelect, frameRequest, cameraMemory } = props;
  return (
    <Canvas
      shadows
      camera={{ fov: FOV, near: 0.05, far: 400 }}
      gl={{ antialias: true, alpha: false }}
      style={{ touchAction: "none", position: "absolute", inset: 0 }}
      onPointerMissed={(e) => {
        if (e.button === 0 && !e.shiftKey) onSelect([]);
      }}
    >
      <color attach="background" args={["#f8fafc"]} />

      {/* Same lighting as the build guide */}
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

      {/* Floor: 1 ft squares, heavier lines every 4 ft */}
      <Grid
        position={[0, -0.002, 0]}
        infiniteGrid
        cellSize={12 * S}
        sectionSize={48 * S}
        cellThickness={0.6}
        sectionThickness={1.1}
        cellColor="#cbd5e1"
        sectionColor="#94a3b8"
        fadeDistance={30}
        fadeStrength={2.5}
      />
      {/* Floor that only shows the shadows cast on it. (ContactShadows would
          photograph the grid from below and tint the whole floor.) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial transparent opacity={0.16} />
      </mesh>

      <TextureGuard />
      <CameraRig scene={scene} frameRequest={frameRequest} cameraMemory={cameraMemory} />
      <Pieces {...props} />
    </Canvas>
  );
}
