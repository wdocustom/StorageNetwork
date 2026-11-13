"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — 2D plan view (looking straight down)
//
// The same scene as the 3D view, drawn as a drafting-style top view in SVG:
// X runs left to right, the front of the build is at the bottom. Each piece
// is its outline from above; higher pieces are drawn over lower ones.
//
//   • Click / tap a piece to select it; Shift-click adds or removes.
//   • Drag a piece to move it (snaps to the grid step).
//   • Drag empty space to pan; wheel or pinch to zoom.
//
// Pan and zoom live in the workspace (PlanCamera) so they survive switching
// to 3D and back.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { getStock } from "@/lib/builder/catalog";
import { beginDrag, dragPositions, type DragStart } from "@/lib/builder/drag";
import { boundsOf, pieceBounds, pieceFootprint, type Scene, type Vec3 } from "@/lib/builder/scene";
import { formatFeetInches } from "@/lib/builder/units";

/** Center of the view (inches) and zoom (pixels per inch). */
export interface PlanCamera {
  cx: number;
  cz: number;
  ppi: number;
}

interface Props {
  scene: Scene;
  selection: string[];
  gridStep: number;
  onSelect: (ids: string[]) => void;
  onToggleSelect: (id: string) => void;
  onMove: (positions: Record<string, Vec3>) => void;
  /** Change this number to re-frame the view on the whole build */
  frameRequest: number;
  cameraMemory: MutableRefObject<PlanCamera | null>;
}

const MIN_PPI = 0.6;
const MAX_PPI = 40;
const DRAG_THRESHOLD_PX = 4;
const FILL = { lumber: "#e9d9b0", plywood: "#dcc394" } as const;
const STROKE = "#7c6a45";
const SELECT = "#facc15";

type Gesture =
  | { kind: "pan"; pointerId: number; x: number; y: number; moved: boolean }
  | { kind: "piece"; pointerId: number; x: number; y: number; moved: boolean; start: DragStart }
  | { kind: "pinch"; distance: number };

const clampPpi = (ppi: number) => Math.min(MAX_PPI, Math.max(MIN_PPI, ppi));

/** Pick grid spacing that stays readable at the current zoom: inches between minor and major lines. */
function gridSpacing(ppi: number): { minor: number; major: number } {
  if (ppi >= 14) return { minor: 1, major: 12 };
  if (ppi >= 2.2) return { minor: 12, major: 48 };
  return { minor: 48, major: 96 };
}

export default function BuilderViewport2D({
  scene,
  selection,
  gridStep,
  onSelect,
  onToggleSelect,
  onMove,
  frameRequest,
  cameraMemory,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [camera, setCameraState] = useState<PlanCamera | null>(cameraMemory.current);
  const cameraRef = useRef(camera);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const selected = useMemo(() => new Set(selection), [selection]);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const setCamera = useCallback(
    (next: PlanCamera) => {
      cameraRef.current = next;
      cameraMemory.current = next;
      setCameraState(next);
    },
    [cameraMemory],
  );

  // Track the viewport's size
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const frame = useCallback(
    (viewport: { w: number; h: number }) => {
      const b = boundsOf(sceneRef.current.pieces);
      // Nothing built yet: show an 8 ft × 4 ft patch of floor.
      const min = b ? b.min : [-48, 0, -24];
      const max = b ? b.max : [48, 0, 24];
      const spanX = Math.max(max[0] - min[0], 24);
      const spanZ = Math.max(max[2] - min[2], 24);
      const margin = 1.25;
      setCamera({
        cx: (min[0] + max[0]) / 2,
        cz: (min[2] + max[2]) / 2,
        ppi: clampPpi(Math.min(viewport.w / (spanX * margin), viewport.h / (spanZ * margin))),
      });
    },
    [setCamera],
  );

  // Frame once the size is known (unless the workspace remembers a view), and on request.
  const framedFor = useRef<number | null>(cameraMemory.current ? frameRequest : null);
  useEffect(() => {
    if (!size || size.w === 0 || size.h === 0) return;
    if (framedFor.current !== frameRequest) {
      framedFor.current = frameRequest;
      frame(size);
    }
  }, [size, frameRequest, frame]);

  /** Pointer position relative to the viewport, px */
  const local = (e: { clientX: number; clientY: number }) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };

  /** Zoom by `factor`, keeping the point under (x, y) px where it is. */
  const zoomAt = useCallback(
    (x: number, y: number, factor: number) => {
      const cam = cameraRef.current;
      if (!cam || !size) return;
      const ppi = clampPpi(cam.ppi * factor);
      const worldX = cam.cx + (x - size.w / 2) / cam.ppi;
      const worldZ = cam.cz + (y - size.h / 2) / cam.ppi;
      setCamera({ ppi, cx: worldX - (x - size.w / 2) / ppi, cz: worldZ - (y - size.h / 2) / ppi });
    },
    [setCamera, size],
  );

  // Wheel zoom. Registered by hand because React's wheel listener is passive
  // and can't stop the page from scrolling.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const pinchDistance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const handleDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    e.currentTarget.setPointerCapture(e.pointerId);

    // Second finger down: whatever was happening becomes a pinch.
    if (pointers.current.size === 2) {
      gesture.current = { kind: "pinch", distance: pinchDistance() };
      return;
    }
    if (pointers.current.size > 2) return;

    const pieceId = (e.target as Element).closest<SVGElement>("[data-piece]")?.dataset.piece;
    if (!pieceId) {
      gesture.current = { kind: "pan", pointerId: e.pointerId, x: p.x, y: p.y, moved: false };
      return;
    }
    if (e.shiftKey) {
      onToggleSelect(pieceId);
      return;
    }
    const already = selected.has(pieceId);
    if (!already) onSelect([pieceId]);
    const dragged = scene.pieces.filter((piece) => (already ? selected.has(piece.id) : piece.id === pieceId));
    gesture.current = {
      kind: "piece",
      pointerId: e.pointerId,
      x: p.x,
      y: p.y,
      moved: false,
      start: beginDrag(dragged, pieceId),
    };
  };

  const handleMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    const previous = pointers.current.get(e.pointerId) as { x: number; y: number };
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    const cam = cameraRef.current;
    if (!g || !cam) return;

    if (g.kind === "pinch") {
      if (pointers.current.size < 2) return;
      const distance = pinchDistance();
      const [a, b] = [...pointers.current.values()];
      if (g.distance > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, distance / g.distance);
      g.distance = distance;
      return;
    }
    if (e.pointerId !== g.pointerId) return;
    if (!g.moved) {
      if (Math.hypot(p.x - g.x, p.y - g.y) < DRAG_THRESHOLD_PX) return;
      g.moved = true;
    }
    if (g.kind === "pan") {
      setCamera({ ...cam, cx: cam.cx - (p.x - previous.x) / cam.ppi, cz: cam.cz - (p.y - previous.y) / cam.ppi });
    } else {
      onMove(dragPositions(g.start, [(p.x - g.x) / cam.ppi, 0, (p.y - g.y) / cam.ppi], gridStep));
    }
  };

  const handleUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (g?.kind === "pinch") {
      // One finger left: wait for a fresh touch rather than jumping into a pan.
      gesture.current = null;
      return;
    }
    if (g && e.pointerId === g.pointerId) {
      // A press on empty space that never moved is "click nothing".
      if (g.kind === "pan" && !g.moved && e.type !== "pointercancel" && !e.shiftKey) onSelect([]);
      gesture.current = null;
    }
  };

  const drawn = useMemo(
    () =>
      scene.pieces
        .map((piece) => ({ piece, top: pieceBounds(piece).max[1], outline: pieceFootprint(piece) }))
        .sort((a, b) => a.top - b.top),
    [scene.pieces],
  );

  const ready = camera && size && size.w > 0 && size.h > 0;
  const spacing = ready ? gridSpacing(camera.ppi) : null;
  // Scene inches → screen px
  const transform = ready
    ? `translate(${size.w / 2 - camera.cx * camera.ppi} ${size.h / 2 - camera.cz * camera.ppi}) scale(${camera.ppi})`
    : undefined;
  // Visible area in inches, for the grid rectangle
  const view = ready
    ? {
        x: camera.cx - size.w / 2 / camera.ppi,
        z: camera.cz - size.h / 2 / camera.ppi,
        w: size.w / camera.ppi,
        h: size.h / camera.ppi,
      }
    : null;
  // Scale bar: a round length about 90 px long
  const barInches = ready ? ([1, 3, 6, 12, 24, 48, 96, 192].find((l) => l * camera.ppi >= 70) ?? 192) : 0;

  return (
    <div ref={wrapRef} className="absolute inset-0 touch-none select-none overflow-hidden bg-slate-50">
      {ready && spacing && view && (
        <svg
          width={size.w}
          height={size.h}
          className="block cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={`Plan view of ${scene.name}: ${scene.pieces.length} piece${scene.pieces.length === 1 ? "" : "s"}`}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        >
          {/* Grid line widths are in inches (1 px ÷ zoom): non-scaling strokes are unreliable inside patterns. */}
          <defs>
            <pattern id="builder-grid-minor" width={spacing.minor} height={spacing.minor} patternUnits="userSpaceOnUse">
              <path
                d={`M ${spacing.minor} 0 L 0 0 0 ${spacing.minor}`}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={1 / camera.ppi}
              />
            </pattern>
            <pattern id="builder-grid-major" width={spacing.major} height={spacing.major} patternUnits="userSpaceOnUse">
              <rect width={spacing.major} height={spacing.major} fill="url(#builder-grid-minor)" />
              <path
                d={`M ${spacing.major} 0 L 0 0 0 ${spacing.major}`}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5 / camera.ppi}
              />
            </pattern>
          </defs>

          <g transform={transform}>
            <rect x={view.x} y={view.z} width={view.w} height={view.h} fill="url(#builder-grid-major)" />
            {/* Origin cross */}
            <path
              d={`M ${-8 / camera.ppi} 0 L ${8 / camera.ppi} 0 M 0 ${-8 / camera.ppi} L 0 ${8 / camera.ppi}`}
              stroke="#64748b"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />

            {drawn.map(({ piece, outline }) => {
              const isSelected = selected.has(piece.id);
              const look = getStock(piece.stock)?.look ?? "lumber";
              return (
                <polygon
                  key={piece.id}
                  data-piece={piece.id}
                  points={outline.map(([x, z]) => `${x},${z}`).join(" ")}
                  fill={FILL[look]}
                  // Panels are see-through so the frame under a top stays readable
                  fillOpacity={look === "plywood" ? 0.55 : 0.95}
                  stroke={isSelected ? SELECT : STROKE}
                  strokeWidth={isSelected ? 3 : 1.25}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className="cursor-move"
                />
              );
            })}
            {/* Selected outlines again on top, so a selected piece under a panel still shows */}
            {drawn
              .filter(({ piece }) => selected.has(piece.id))
              .map(({ piece, outline }) => (
                <polygon
                  key={`sel-${piece.id}`}
                  points={outline.map(([x, z]) => `${x},${z}`).join(" ")}
                  fill="none"
                  stroke={SELECT}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              ))}
          </g>
        </svg>
      )}

      {ready && (
        <>
          <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/85 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
            Top view · front at bottom
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col items-start gap-1">
            <span className="rounded bg-white/85 px-1.5 text-[10px] font-semibold text-slate-600">
              {formatFeetInches(barInches)}
            </span>
            <span className="block h-1.5 border-x-2 border-b-2 border-slate-500" style={{ width: barInches * camera.ppi }} />
          </div>
        </>
      )}
    </div>
  );
}
