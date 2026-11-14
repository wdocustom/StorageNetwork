"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — 3D view
//
// Draws the scene with the same procedural lumber and plywood materials and
// the same lighting as the tote-rack build guide, so a custom design looks
// like the rest of the plans.
//
//   • Click a piece to select it (with its group); Shift-click adds to /
//     removes from the selection; Ctrl/⌘-click reaches one piece inside a
//     group; click empty space to clear.
//   • Drag a piece to slide it across the floor plane at its own height.
//     Hold Alt while dragging to raise or lower it instead. Drags snap to
//     other pieces' edges and middles (pink guide lines), then to the grid.
//   • Drag empty space to orbit, right-drag or two fingers to pan, wheel or
//     pinch to zoom.
//
// Overlapping pieces are outlined in red. With dimensions on, the selection
// (or the whole build) gets width / depth / height lines.
//
// The scene is in inches; the whole thing is drawn at 1/48 scale (the scale
// the rest of the site's 3D uses) so lights and shadows behave the same.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, Line, OrbitControls } from "@react-three/drei";
import { MathUtils, Plane, Vector3, type PerspectiveCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import PieceBody, { PIECE_EDGE_COLOR, TextureGuard } from "@/components/builder/PieceBody";
import {
  COLORS,
  DRAG_THRESHOLD_PX,
  SNAP_REACH_PX,
  dimensionBox,
  newGesture,
  pressPiece,
  type ViewportProps,
} from "@/components/builder/viewport";
import { beginDrag, dragPositions, snapTargets, type DragStart, type SnapGuide } from "@/lib/builder/drag";
import { boundsOf, type Bounds, type ScenePiece, type Vec3 } from "@/lib/builder/scene";
import { formatInches } from "@/lib/builder/units";

/** Inches → scene units */
const S = 1 / 48;
const FOV = 40;
/** Dimension lines stand this far off the box, inches */
const DIMENSION_OFFSET = 4;

/** Camera position and orbit target, kept by the workspace across 2D ↔ 3D switches. */
export interface CameraMemory {
  position: [number, number, number];
  target: [number, number, number];
}

interface Props extends ViewportProps {
  cameraMemory: MutableRefObject<CameraMemory | null>;
}

// ── Camera ───────────────────────────────────────────────────────────────

/** Looks at the build from the front-right, a little above. */
const VIEW_DIRECTION = new Vector3(0.75, 0.6, 1).normalize();

function CameraRig({
  scene,
  frameRequest,
  cameraMemory,
  focus,
}: Pick<Props, "scene" | "frameRequest" | "cameraMemory" | "focus">) {
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

  // First mount: go back to where the camera was (moved over to wherever the
  // plan view was last looking), or frame the build.
  useLayoutEffect(() => {
    const controls = controlsRef.current;
    const memory = cameraMemory.current;
    if (controls && memory) {
      camera.position.set(...memory.position);
      controls.target.set(...memory.target);
      const looking = focus.current;
      if (looking) {
        const shift = new Vector3(looking.x * S - controls.target.x, 0, looking.z * S - controls.target.z);
        camera.position.add(shift);
        controls.target.add(shift);
      }
      controls.update();
    } else {
      frame();
    }
    return () => {
      const c = controlsRef.current;
      if (!c) return;
      cameraMemory.current = { position: camera.position.toArray(), target: c.target.toArray() };
      focus.current = { x: c.target.x / S, z: c.target.z / S };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstRequest = useRef(frameRequest);
  useEffect(() => {
    if (frameRequest !== firstRequest.current) {
      firstRequest.current = frameRequest;
      frame();
    }
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

// ── Overlays ─────────────────────────────────────────────────────────────

interface DimensionLine {
  from: Vec3;
  to: Vec3;
  value: number;
}

/** Width, depth and height lines around a box, in inches. */
function dimensionLines(box: Bounds): DimensionLine[] {
  const { min, max } = box;
  const o = DIMENSION_OFFSET;
  return [
    // Width: along the front, at the bottom
    { from: [min[0], min[1], max[2] + o], to: [max[0], min[1], max[2] + o], value: max[0] - min[0] },
    // Depth: along the right side, at the bottom
    { from: [max[0] + o, min[1], min[2]], to: [max[0] + o, min[1], max[2]], value: max[2] - min[2] },
    // Height: up the front-right corner
    { from: [max[0] + o, min[1], max[2] + o], to: [max[0] + o, max[1], max[2] + o], value: max[1] - min[1] },
  ];
}

/**
 * Dimension lines in the scene, with their sizes written into plain HTML
 * labels that sit over the canvas (`labels`). Each frame the labels are
 * moved to where the middle of their line is on screen. (Plain elements
 * rather than drei's <Html>, which unmounts a React root mid-render.)
 */
function Dimensions({ box, labels }: { box: Bounds | null; labels: MutableRefObject<(HTMLSpanElement | null)[]> }) {
  const lines = useMemo(() => (box ? dimensionLines(box) : []), [box]);
  const point = useMemo(() => new Vector3(), []);

  useFrame(({ camera, size }) => {
    labels.current.forEach((label, i) => {
      if (!label) return;
      const line = lines[i];
      if (!line || line.value <= 0.01) {
        label.style.display = "none";
        return;
      }
      point
        .set((line.from[0] + line.to[0]) / 2, (line.from[1] + line.to[1]) / 2, (line.from[2] + line.to[2]) / 2)
        .multiplyScalar(S)
        .project(camera);
      // Behind the camera or off to the side: nothing to label
      if (point.z > 1 || Math.abs(point.x) > 1.1 || Math.abs(point.y) > 1.1) {
        label.style.display = "none";
        return;
      }
      const text = formatInches(line.value);
      if (label.textContent !== text) label.textContent = text;
      label.style.display = "block";
      label.style.transform = `translate(-50%, -50%) translate(${((point.x + 1) / 2) * size.width}px, ${((1 - point.y) / 2) * size.height}px)`;
    });
  });

  // Leave nothing showing when the view goes away
  useEffect(() => {
    const all = labels.current;
    return () => all.forEach((label) => label && (label.style.display = "none"));
  }, [labels]);

  return (
    <>
      {lines
        .filter((l) => l.value > 0.01)
        .map((l, i) => (
          <Line key={i} points={[l.from, l.to]} color={COLORS.dimension} lineWidth={1.5} depthTest={false} renderOrder={5} />
        ))}
    </>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

interface ActiveDrag {
  pointerId: number;
  gesture: string;
  start: DragStart;
  targets: Bounds[];
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
  overlapping,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  piece: ScenePiece;
  selected: boolean;
  overlapping: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>, piece: ScenePiece) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const rotation = useMemo(
    () => piece.rotation.map((d) => MathUtils.degToRad(d)) as [number, number, number],
    [piece.rotation],
  );
  return (
    <group
      position={piece.position}
      rotation={rotation}
      onPointerDown={(e) => onPointerDown(e, piece)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <PieceBody
        piece={piece}
        edgeColor={selected ? COLORS.select : overlapping ? COLORS.overlap : PIECE_EDGE_COLOR}
        edgeWidth={selected ? 2.5 : overlapping ? 2 : 1}
      />
    </group>
  );
}

function Pieces({
  scene,
  selection,
  gridStep,
  snapToPieces,
  showDimensions,
  multiSelect,
  overlapping,
  onSelect,
  onMove,
  labels,
}: Omit<Props, "frameRequest" | "cameraMemory" | "focus"> & { labels: MutableRefObject<(HTMLSpanElement | null)[]> }) {
  const camera = useThree((s) => s.camera);
  const viewportHeight = useThree((s) => s.size.height);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const drag = useRef<ActiveDrag | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const selected = useMemo(() => new Set(selection), [selection]);
  const hit = useMemo(() => new Vector3(), []);

  const handleDown = useCallback(
    (e: ThreeEvent<PointerEvent>, piece: ScenePiece) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const press = pressPiece(scene, selection, piece.id, {
        additive: e.shiftKey || multiSelect,
        deep: e.ctrlKey || e.metaKey,
      });
      onSelect(press.selection);
      if (press.drag.length === 0) return;

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
        gesture: newGesture(),
        start: beginDrag(press.drag, piece.id),
        targets: snapToPieces ? snapTargets(scene.pieces, press.drag.map((p) => p.id)) : [],
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
    [camera, controls, multiSelect, onSelect, scene, selection, snapToPieces],
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
      // Snap reach is a fixed size on screen: inches per pixel at the piece's distance
      const inchesPerPx =
        (2 * camera.position.distanceTo(hit) * Math.tan(MathUtils.degToRad(FOV / 2))) / viewportHeight / S;
      const result = dragPositions(d.start, delta, {
        gridStep,
        targets: d.targets,
        tolerance: SNAP_REACH_PX * inchesPerPx,
      });
      setGuides(result.guides);
      onMove(result.positions, d.gesture);
    },
    [camera, gridStep, hit, onMove, viewportHeight],
  );

  const handleUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      e.stopPropagation();
      drag.current = null;
      setGuides([]);
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

  const box = useMemo(
    () => (showDimensions ? dimensionBox(scene, selection) : null),
    [scene, selection, showDimensions],
  );

  return (
    <group scale={S}>
      {scene.pieces.map((piece) => (
        <PieceMesh
          key={piece.id}
          piece={piece}
          selected={selected.has(piece.id)}
          overlapping={overlapping.has(piece.id)}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
        />
      ))}
      {guides.map((g, i) => (
        <Line key={i} points={[g.from, g.to]} color={COLORS.guide} lineWidth={2} depthTest={false} renderOrder={6} />
      ))}
      <Dimensions box={box} labels={labels} />
    </group>
  );
}

// ── View ─────────────────────────────────────────────────────────────────

export default function BuilderViewport3D(props: Props) {
  const { scene, onSelect, frameRequest, cameraMemory, focus, multiSelect } = props;
  // The three dimension labels (width, depth, height); <Dimensions> places them.
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  return (
    <>
      <Canvas
        shadows
        camera={{ fov: FOV, near: 0.05, far: 400 }}
        gl={{ antialias: true, alpha: false }}
        style={{ touchAction: "none", position: "absolute", inset: 0 }}
        onPointerMissed={(e) => {
          if (e.button === 0 && !e.shiftKey && !multiSelect) onSelect([]);
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
        <CameraRig scene={scene} frameRequest={frameRequest} cameraMemory={cameraMemory} focus={focus} />
        <Pieces {...props} labels={labels} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            ref={(el) => {
              labels.current[i] = el;
            }}
            style={{ display: "none" }}
            className="absolute left-0 top-0 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white shadow"
          />
        ))}
      </div>
    </>
  );
}
