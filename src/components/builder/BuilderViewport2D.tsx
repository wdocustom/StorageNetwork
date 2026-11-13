"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — 2D plan view (looking straight down)
//
// The same scene as the 3D view, drawn as a drafting-style top view in SVG:
// X runs left to right, the front of the build is at the bottom. Each piece
// is its outline from above; higher pieces are drawn over lower ones, and
// panels are see-through so the frame under a top stays readable.
//
//   • Click / tap a piece to select it (with its group); Shift-click adds
//     or removes; Ctrl/⌘-click reaches one piece inside a group.
//   • Drag a piece to move it. It snaps to other pieces' edges and middles
//     (pink guide lines), then to the grid.
//   • Drag empty space to pan; Shift-drag empty space to box-select; wheel
//     or pinch to zoom.
//
// With dimensions on, the selection (or the whole build) gets width and
// depth lines and each piece big enough on screen shows its length.
// Overlapping pieces are outlined in red.
//
// Pan and zoom live in the workspace (PlanCamera) so they survive switching
// to 3D and back.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import {
  COLORS,
  DRAG_THRESHOLD_PX,
  SNAP_REACH_PX,
  dimensionBox,
  newGesture,
  pressPiece,
  type ViewportProps,
} from "@/components/builder/viewport";
import { getStock } from "@/lib/builder/catalog";
import { beginDrag, dragPositions, snapTargets, type DragStart, type SnapGuide } from "@/lib/builder/drag";
import { boundsOf, expandToGroups, pieceBounds, pieceFootprint, type Bounds } from "@/lib/builder/scene";
import { formatFeetInches, formatFraction, formatInches } from "@/lib/builder/units";

/** Center of the view (inches) and zoom (pixels per inch). */
export interface PlanCamera {
  cx: number;
  cz: number;
  ppi: number;
}

interface Props extends ViewportProps {
  cameraMemory: MutableRefObject<PlanCamera | null>;
}

const MIN_PPI = 0.6;
const MAX_PPI = 40;
const FILL = { lumber: "#e9d9b0", plywood: "#dcc394" } as const;
const STROKE = "#7c6a45";
/** A piece shows its length once it is this long on screen, px */
const LABEL_MIN_PX = 64;
/** Dimension lines stand this far off the box, px */
const DIMENSION_OFFSET_PX = 22;

interface Point {
  x: number;
  y: number;
}

type Gesture =
  | { kind: "pan"; pointerId: number; x: number; y: number; moved: boolean }
  | { kind: "marquee"; pointerId: number; x: number; y: number; moved: boolean }
  | { kind: "piece"; pointerId: number; x: number; y: number; moved: boolean; gesture: string; start: DragStart; targets: Bounds[] }
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
  snapToPieces,
  showDimensions,
  multiSelect,
  overlapping,
  onSelect,
  onMove,
  frameRequest,
  cameraMemory,
  focus,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // Pick up where this view left off, looking at wherever the 3D view was.
  const [camera, setCameraState] = useState<PlanCamera | null>(() => {
    const memory = cameraMemory.current;
    if (!memory) return null;
    return focus.current ? { ...memory, cx: focus.current.x, cz: focus.current.z } : memory;
  });
  const cameraRef = useRef(camera);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [marquee, setMarquee] = useState<{ from: Point; to: Point } | null>(null);
  const selected = useMemo(() => new Set(selection), [selection]);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const setCamera = useCallback(
    (next: PlanCamera) => {
      cameraRef.current = next;
      cameraMemory.current = next;
      focus.current = { x: next.cx, z: next.cz };
      setCameraState(next);
    },
    [cameraMemory, focus],
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
      const margin = 1.35;
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
  const local = (e: { clientX: number; clientY: number }): Point => {
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
      setGuides([]);
      setMarquee(null);
      return;
    }
    if (pointers.current.size > 2) return;

    const pieceId = (e.target as Element).closest<SVGElement>("[data-piece]")?.dataset.piece;
    if (!pieceId) {
      // Shift-drag on empty space draws a selection box; a plain drag pans.
      gesture.current = { kind: e.shiftKey ? "marquee" : "pan", pointerId: e.pointerId, x: p.x, y: p.y, moved: false };
      return;
    }
    const press = pressPiece(scene, selection, pieceId, {
      additive: e.shiftKey || multiSelect,
      deep: e.ctrlKey || e.metaKey,
    });
    onSelect(press.selection);
    if (press.drag.length === 0) return;
    gesture.current = {
      kind: "piece",
      pointerId: e.pointerId,
      x: p.x,
      y: p.y,
      moved: false,
      gesture: newGesture(),
      start: beginDrag(press.drag, pieceId),
      targets: snapToPieces ? snapTargets(scene.pieces, press.drag.map((d) => d.id)) : [],
    };
  };

  const handleMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    const previous = pointers.current.get(e.pointerId) as Point;
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
    } else if (g.kind === "marquee") {
      setMarquee({ from: { x: g.x, y: g.y }, to: p });
    } else {
      const result = dragPositions(g.start, [(p.x - g.x) / cam.ppi, 0, (p.y - g.y) / cam.ppi], {
        gridStep,
        targets: g.targets,
        tolerance: SNAP_REACH_PX / cam.ppi,
      });
      setGuides(result.guides);
      onMove(result.positions, g.gesture);
    }
  };

  const handleUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    const cam = cameraRef.current;
    if (g?.kind === "pinch") {
      // One finger left: wait for a fresh touch rather than jumping into a pan.
      gesture.current = null;
      return;
    }
    if (!g || e.pointerId !== g.pointerId) return;
    gesture.current = null;
    setGuides([]);
    setMarquee(null);
    const cancelled = e.type === "pointercancel";

    if (g.kind === "marquee" && g.moved && !cancelled && cam && size) {
      // Everything the box touches joins the selection (whole groups).
      const p = local(e);
      const toWorld = (pt: Point) => ({ x: cam.cx + (pt.x - size.w / 2) / cam.ppi, z: cam.cz + (pt.y - size.h / 2) / cam.ppi });
      const a = toWorld({ x: g.x, y: g.y });
      const b = toWorld(p);
      const lo = { x: Math.min(a.x, b.x), z: Math.min(a.z, b.z) };
      const hi = { x: Math.max(a.x, b.x), z: Math.max(a.z, b.z) };
      const touched = scene.pieces
        .filter((piece) => {
          const pb = pieceBounds(piece);
          return pb.max[0] >= lo.x && pb.min[0] <= hi.x && pb.max[2] >= lo.z && pb.min[2] <= hi.z;
        })
        .map((piece) => piece.id);
      onSelect([...new Set([...selection, ...expandToGroups(scene, touched)])]);
    } else if (g.kind !== "piece" && !g.moved && !cancelled && !e.shiftKey && !multiSelect) {
      // A press on empty space that never moved is "click nothing".
      onSelect([]);
    }
  };

  const drawn = useMemo(
    () =>
      scene.pieces
        .map((piece) => ({ piece, bounds: pieceBounds(piece), outline: pieceFootprint(piece) }))
        .sort((a, b) => a.bounds.max[1] - b.bounds.max[1]),
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
  const box = ready && showDimensions ? dimensionBox(scene, selection) : null;
  /** Screen px → inches, for sizes that must not change with zoom */
  const px = ready ? 1 / camera.ppi : 1;
  const labelStyle = {
    fontSize: 11 * px,
    fontWeight: 700,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    paintOrder: "stroke" as const,
    stroke: "#f8fafc",
    strokeWidth: 3 * px,
    strokeLinejoin: "round" as const,
  };

  /** Width and depth lines around a box, with their sizes. */
  const dimensionLines = (b: Bounds) => {
    const off = DIMENSION_OFFSET_PX * px;
    const tick = 5 * px;
    const front = b.max[2] + off;
    const right = b.max[0] + off;
    const midX = (b.min[0] + b.max[0]) / 2;
    const midZ = (b.min[2] + b.max[2]) / 2;
    return (
      <g pointerEvents="none" fill={COLORS.dimension}>
        <path
          d={
            `M ${b.min[0]} ${front} L ${b.max[0]} ${front} M ${b.min[0]} ${front - tick} L ${b.min[0]} ${front + tick} M ${b.max[0]} ${front - tick} L ${b.max[0]} ${front + tick} ` +
            `M ${right} ${b.min[2]} L ${right} ${b.max[2]} M ${right - tick} ${b.min[2]} L ${right + tick} ${b.min[2]} M ${right - tick} ${b.max[2]} L ${right + tick} ${b.max[2]}`
          }
          stroke={COLORS.dimension}
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
          fill="none"
        />
        <text x={midX} y={front + 12 * px} textAnchor="middle" dominantBaseline="central" style={labelStyle}>
          {formatInches(b.max[0] - b.min[0])}
        </text>
        <text
          x={right + 12 * px}
          y={midZ}
          textAnchor="middle"
          dominantBaseline="central"
          transform={`rotate(-90 ${right + 12 * px} ${midZ})`}
          style={labelStyle}
        >
          {formatInches(b.max[2] - b.min[2])}
        </text>
      </g>
    );
  };

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
              <path d={`M ${spacing.minor} 0 L 0 0 0 ${spacing.minor}`} fill="none" stroke="#e2e8f0" strokeWidth={px} />
            </pattern>
            <pattern id="builder-grid-major" width={spacing.major} height={spacing.major} patternUnits="userSpaceOnUse">
              <rect width={spacing.major} height={spacing.major} fill="url(#builder-grid-minor)" />
              <path d={`M ${spacing.major} 0 L 0 0 0 ${spacing.major}`} fill="none" stroke="#cbd5e1" strokeWidth={1.5 * px} />
            </pattern>
          </defs>

          <g transform={transform}>
            <rect x={view.x} y={view.z} width={view.w} height={view.h} fill="url(#builder-grid-major)" />
            {/* Origin cross */}
            <path
              d={`M ${-8 * px} 0 L ${8 * px} 0 M 0 ${-8 * px} L 0 ${8 * px}`}
              stroke="#64748b"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />

            {drawn.map(({ piece, outline }) => {
              const isSelected = selected.has(piece.id);
              const isOverlapping = overlapping.has(piece.id);
              const look = getStock(piece.stock)?.look ?? "lumber";
              return (
                <polygon
                  key={piece.id}
                  data-piece={piece.id}
                  points={outline.map(([x, z]) => `${x},${z}`).join(" ")}
                  fill={FILL[look]}
                  // Panels are see-through so the frame under a top stays readable
                  fillOpacity={look === "plywood" ? 0.55 : 0.95}
                  stroke={isSelected ? COLORS.select : isOverlapping ? COLORS.overlap : STROKE}
                  strokeWidth={isSelected ? 3 : isOverlapping ? 2 : 1.25}
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
                  stroke={COLORS.select}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              ))}

            {/* Each piece's length, where there is room to read it */}
            {showDimensions &&
              drawn.map(({ piece, bounds }) => {
                const spanX = bounds.max[0] - bounds.min[0];
                const spanZ = bounds.max[2] - bounds.min[2];
                if (Math.max(spanX, spanZ) * camera.ppi < LABEL_MIN_PX) return null;
                const cx = (bounds.min[0] + bounds.max[0]) / 2;
                const cz = (bounds.min[2] + bounds.max[2]) / 2;
                return (
                  <text
                    key={`len-${piece.id}`}
                    x={cx}
                    y={cz}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={spanZ > spanX ? `rotate(-90 ${cx} ${cz})` : undefined}
                    fill="#57534e"
                    pointerEvents="none"
                    style={{ ...labelStyle, fontSize: 10 * px, fontWeight: 600 }}
                  >
                    {formatFraction(piece.length)}
                  </text>
                );
              })}

            {/* Width and depth of the selection, or of the whole build */}
            {box && dimensionLines(box)}

            {/* What a drag just lined up with */}
            {guides
              .filter((g) => g.axis !== 1)
              .map((g, i) => (
                <line
                  key={i}
                  x1={g.from[0]}
                  y1={g.from[2]}
                  x2={g.to[0]}
                  y2={g.to[2]}
                  stroke={COLORS.guide}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              ))}
          </g>

          {marquee && (
            <rect
              x={Math.min(marquee.from.x, marquee.to.x)}
              y={Math.min(marquee.from.y, marquee.to.y)}
              width={Math.abs(marquee.to.x - marquee.from.x)}
              height={Math.abs(marquee.to.y - marquee.from.y)}
              fill="rgba(250, 204, 21, 0.12)"
              stroke={COLORS.select}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              pointerEvents="none"
            />
          )}
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
