"use client";

import { useMemo, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import IndustrialCaster, { CASTER_HEIGHT } from "./IndustrialCaster";

// ═══════════════════════════════════════════════════════════════════════════
// Rack3D — Interactive 3D Configurator (Visual Only)
//
// "Rim-Glider" construction:
//   - 2×4 vertical posts (pine)
//   - 3/4" plywood rail strips screwed to post faces
//   - Totes slide between rails: yellow rim ON TOP of plywood, body hangs below
//   - Industrial swivel casters bolted to bottom plate
//
// VERTICAL STACK (bottom → top):
//   Floor → Casters (CASTER_HEIGHT) → Bottom Plate → Posts/Rails/Totes → Top Plate
//
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

// ── Real-World Dimensions (inches) ───────────────────────────────────────

const POST_W = 1.5;        // 2×4 actual width
const POST_D = 3.5;        // 2×4 actual depth
const RAIL_THICK = 0.75;   // 3/4" plywood strip thickness
const RAIL_H = 1.75;       // Plywood strip height
const RACK_DEPTH = 30;     // Front-to-back depth
const TIER_H = 16;         // Center-to-center between tier rails
const PLATE_H = 1.5;       // Top & bottom plate thickness (2×4 laid flat)
const PLY_H = 0.75;        // Plywood top thickness

// Tote dimensions
const TOTE_RIM_H = 1.0;    // Yellow rim height
const TOTE_RIM_OVERHANG = 0.5;
const TOTE_BODY_H = 11.0;  // Tote body below rim
const TOTE_TOLERANCE = 0.25;

// ── Vertical Clearance Calculation ───────────────────────────────────────
// The tote hangs below the rail: rim (1") + body (11") = 12" total hang.
// Bottom rail must be high enough that the lowest tote clears the floor
// (or wheels). Safety gap of 2" above CASTER_HEIGHT.
//
// BOTTOM_RAIL_Y = distance from bottom plate to first rail center
// Tote bottom = BOTTOM_RAIL_Y + RAIL_H/2 - TOTE_RIM_H - TOTE_BODY_H
// We need tote bottom > 0 (relative to bottom plate), PLUS 2" safety.
const TOTE_HANG = TOTE_RIM_H + TOTE_BODY_H;  // 12"
const SAFETY_GAP = 2;
const BOTTOM_RAIL_OFFSET = TOTE_HANG + SAFETY_GAP + RAIL_H / 2;
// This is measured from bottom plate top surface (y=PLATE_H inside the rack group)

// Scale: inches → scene units
const S = 0.02;

// ── Materials (procedural, no external textures) ─────────────────────────

function usePineMat() {
  return useMemo(() => {
    // Build a canvas-based grain texture (client-side only)
    const w = 64;
    const h = 256;
    const canvas =
      typeof document !== "undefined"
        ? document.createElement("canvas")
        : null;

    if (canvas) {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      // Base pine color
      ctx.fillStyle = "#D4B483";
      ctx.fillRect(0, 0, w, h);

      // Grain lines — subtle horizontal waves
      for (let i = 0; i < 40; i++) {
        const y = (i / 40) * h + (Math.random() - 0.5) * 6;
        const a = 0.06 + Math.random() * 0.1;
        ctx.strokeStyle = `rgba(140, 95, 50, ${a})`;
        ctx.lineWidth = 0.4 + Math.random() * 1.2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 3) {
          ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 1.5);
        }
        ctx.stroke();
      }

      // A couple of knot marks
      for (let k = 0; k < 2; k++) {
        const kx = 10 + Math.random() * (w - 20);
        const ky = 30 + Math.random() * (h - 60);
        const kr = 2 + Math.random() * 3;
        const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
        grad.addColorStop(0, "rgba(100, 65, 30, 0.2)");
        grad.addColorStop(1, "rgba(100, 65, 30, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(kx, ky, kr, 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;

      return new THREE.MeshStandardMaterial({
        map: tex,
        color: new THREE.Color("#D4B483"),
        roughness: 0.88,
        metalness: 0.0,
      });
    }

    // SSR fallback (no document)
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#D4B483"),
      roughness: 0.88,
      metalness: 0.0,
    });
  }, []);
}

function usePlywoodMat() {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#B89E6A"),
        roughness: 0.62,
        metalness: 0.0,
      }),
    []
  );
}

// ── Lumber — 2×4 box ────────────────────────────────────────────────────

function Lumber({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  const mat = usePineMat();
  return (
    <mesh position={position} material={mat} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

// ── Plywood Rail Strip ──────────────────────────────────────────────────

function PlywoodRail({
  position,
  length,
}: {
  position: [number, number, number];
  length: number;
}) {
  const mat = usePlywoodMat();
  return (
    <mesh position={position} material={mat} castShadow receiveShadow>
      <boxGeometry args={[RAIL_THICK, RAIL_H, length]} />
    </mesh>
  );
}

// ── Tote — Tapered Trapezoid ────────────────────────────────────────────
// The rim (yellow/red) sits ON TOP of the plywood rail edge.
// The body (black) hangs BELOW — visibly lower than the rail.

function Tote({
  position,
  topWidth,
  toteType,
}: {
  position: [number, number, number];
  topWidth: number;
  toteType: ToteType;
}) {
  const lidColor = toteType === "HDX" ? "#fbbf24" : "#ef4444";
  const bodyDepth = RACK_DEPTH - POST_D * 2 - TOTE_TOLERANCE * 4;
  const bottomWidth = topWidth * 0.85;
  const bodyTopDepth = bodyDepth * 0.92;
  const bodyBottomDepth = bodyDepth * 0.82;

  const bodyGeo = useMemo(() => {
    const hw_t = topWidth / 2;
    const hw_b = bottomWidth / 2;
    const hd_t = bodyTopDepth / 2;
    const hd_b = bodyBottomDepth / 2;
    const h = TOTE_BODY_H;

    const verts = new Float32Array([
      // Bottom (y=0)
      -hw_b, 0, -hd_b, hw_b, 0, -hd_b, hw_b, 0, hd_b, -hw_b, 0, hd_b,
      // Top (y=h)
      -hw_t, h, -hd_t, hw_t, h, -hd_t, hw_t, h, hd_t, -hw_t, h, hd_t,
    ]);

    const idx = [
      0, 2, 1, 0, 3, 2, // bottom
      4, 5, 6, 4, 6, 7, // top
      0, 1, 5, 0, 5, 4, // front
      2, 3, 7, 2, 7, 6, // back
      0, 4, 7, 0, 7, 3, // left
      1, 2, 6, 1, 6, 5, // right
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }, [topWidth, bottomWidth, bodyTopDepth, bodyBottomDepth]);

  // position = bottom of tote body (y=0 of this group)
  return (
    <group position={position}>
      {/* Black body — tapered */}
      <mesh geometry={bodyGeo} castShadow>
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.6}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Yellow/Red rim — sits ON TOP of body */}
      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H / 2, 0]} castShadow>
        <boxGeometry
          args={[
            topWidth + TOTE_RIM_OVERHANG * 2,
            TOTE_RIM_H,
            bodyTopDepth + TOTE_RIM_OVERHANG * 2,
          ]}
        />
        <meshStandardMaterial color={lidColor} roughness={0.3} metalness={0.05} />
      </mesh>

      {/* Lid snap line */}
      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H + 0.15, 0]}>
        <boxGeometry
          args={[
            topWidth + TOTE_RIM_OVERHANG,
            0.3,
            bodyTopDepth + TOTE_RIM_OVERHANG,
          ]}
        />
        <meshStandardMaterial color={lidColor} roughness={0.25} metalness={0.08} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Rack Assembly
// ═══════════════════════════════════════════════════════════════════════════
//
// Coordinate system (inside the scaled group, in inches):
//   y = 0  →  floor
//   y = CASTER_HEIGHT  →  top of caster / bottom of wood
//   y = CASTER_HEIGHT + PLATE_H  →  top of bottom plate
//   y = CASTER_HEIGHT + PLATE_H + BOTTOM_RAIL_OFFSET  →  center of first rail
//   ...subsequent rails at +TIER_H each
//
// The tote for rail r:
//   rimTopY   = railCenterY + RAIL_H / 2   (rim sits on plywood top edge)
//   bodyBaseY = rimTopY - TOTE_RIM_H - TOTE_BODY_H
//   → bodyBaseY must be > CASTER_HEIGHT for the lowest tier
//     This is guaranteed by BOTTOM_RAIL_OFFSET calculation above.

function RackAssembly({
  cols,
  rows,
  toteType,
  hasTotes,
  hasWheels,
  hasTop,
}: Rack3DProps) {
  const opening = toteType === "HDX" ? 19.75 : 20.75;
  const totalW = cols * opening + (cols + 1) * POST_W;

  // Frame height = bottom plate + post region + top plate
  // Post region = BOTTOM_RAIL_OFFSET + (rows-1)*TIER_H + some top gap
  const topGapAboveLastRail = 3; // inches above last rail to top plate
  const postRegion = BOTTOM_RAIL_OFFSET + (rows - 1) * TIER_H + topGapAboveLastRail;
  const frameH = PLATE_H * 2 + postRegion; // bottom plate + posts + top plate

  const lift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + lift;

  // Center the whole thing
  const cx = totalW / 2;
  const cy = overallH / 2;
  const cz = RACK_DEPTH / 2;

  return (
    <group scale={[S, S, S]} position={[-cx * S, -cy * S, -cz * S]}>
      {/* ── Wooden Rack — lifted by caster height ─────────── */}
      <group position={[0, lift, 0]}>
        {/* Bottom Plate (front + back 2×4s laid flat) */}
        <Lumber
          position={[totalW / 2, PLATE_H / 2, POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />
        <Lumber
          position={[totalW / 2, PLATE_H / 2, RACK_DEPTH - POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />

        {/* Top Plate */}
        <Lumber
          position={[totalW / 2, frameH - PLATE_H / 2, POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />
        <Lumber
          position={[totalW / 2, frameH - PLATE_H / 2, RACK_DEPTH - POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />

        {/* ── Posts + Plywood Rails per column divider ──────── */}
        {Array.from({ length: cols + 1 }).map((_, i) => {
          const x = i * (opening + POST_W) + POST_W / 2;
          const postH = frameH - PLATE_H * 2;
          const showRight = i < cols; // rails serving bay to the right
          const showLeft = i > 0;     // rails serving bay to the left

          return (
            <group key={`frame-${i}`}>
              {/* Front post */}
              <Lumber
                position={[x, PLATE_H + postH / 2, POST_D / 2]}
                size={[POST_W, postH, POST_D]}
              />
              {/* Back post */}
              <Lumber
                position={[x, PLATE_H + postH / 2, RACK_DEPTH - POST_D / 2]}
                size={[POST_W, postH, POST_D]}
              />

              {/* Right-face rails */}
              {showRight &&
                Array.from({ length: rows }).map((_, r) => {
                  const railY =
                    PLATE_H + BOTTOM_RAIL_OFFSET + r * TIER_H;
                  const railX = x + POST_W / 2 + RAIL_THICK / 2;
                  return (
                    <PlywoodRail
                      key={`rr-${i}-${r}`}
                      position={[railX, railY, RACK_DEPTH / 2]}
                      length={RACK_DEPTH - POST_D * 2}
                    />
                  );
                })}

              {/* Left-face rails */}
              {showLeft &&
                Array.from({ length: rows }).map((_, r) => {
                  const railY =
                    PLATE_H + BOTTOM_RAIL_OFFSET + r * TIER_H;
                  const railX = x - POST_W / 2 - RAIL_THICK / 2;
                  return (
                    <PlywoodRail
                      key={`rl-${i}-${r}`}
                      position={[railX, railY, RACK_DEPTH / 2]}
                      length={RACK_DEPTH - POST_D * 2}
                    />
                  );
                })}
            </group>
          );
        })}

        {/* ── Totes ────────────────────────────────────────── */}
        {hasTotes &&
          Array.from({ length: cols }).map((_, c) => {
            const bayLeft = POST_W + c * (opening + POST_W);
            const bayCenter = bayLeft + opening / 2;
            const toteTopW =
              opening - RAIL_THICK * 2 - TOTE_TOLERANCE * 2;

            return Array.from({ length: rows }).map((_, r) => {
              const railCenterY =
                PLATE_H + BOTTOM_RAIL_OFFSET + r * TIER_H;
              // Rim sits ON TOP of plywood rail edge
              const rimTopY = railCenterY + RAIL_H / 2;
              // Body hangs below rim
              const toteBaseY = rimTopY - TOTE_RIM_H - TOTE_BODY_H;

              return (
                <Tote
                  key={`tote-${c}-${r}`}
                  position={[bayCenter, toteBaseY, RACK_DEPTH / 2]}
                  topWidth={toteTopW}
                  toteType={toteType}
                />
              );
            });
          })}

        {/* ── Plywood Top (optional) ──────────────────────── */}
        {hasTop && (
          <mesh
            position={[totalW / 2, frameH + PLY_H / 2, RACK_DEPTH / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[totalW + 2, PLY_H, RACK_DEPTH + 2]} />
            <meshStandardMaterial
              color="#D4B896"
              roughness={0.65}
              metalness={0.0}
            />
          </mesh>
        )}
      </group>

      {/* ── Industrial Casters — 4 corners under posts ──── */}
      {hasWheels && (
        <>
          <IndustrialCaster position={[POST_W / 2, 0, POST_D / 2]} />
          <IndustrialCaster
            position={[totalW - POST_W / 2, 0, POST_D / 2]}
          />
          <IndustrialCaster
            position={[POST_W / 2, 0, RACK_DEPTH - POST_D / 2]}
          />
          <IndustrialCaster
            position={[totalW - POST_W / 2, 0, RACK_DEPTH - POST_D / 2]}
          />
        </>
      )}
    </group>
  );
}

// ── Ground Plane ─────────────────────────────────────────────────────────

function Ground() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.003, 0]}
      receiveShadow
    >
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color="#f5f5f5" roughness={0.95} metalness={0.0} />
    </mesh>
  );
}

// ── Dynamic Camera ───────────────────────────────────────────────────────

function CameraRig({
  cols,
  rows,
  toteType,
  hasWheels,
}: Pick<Rack3DProps, "cols" | "rows" | "toteType" | "hasWheels">) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const opening = toteType === "HDX" ? 19.75 : 20.75;
  const totalW = cols * opening + (cols + 1) * POST_W;
  const topGap = 3;
  const postRegion = BOTTOM_RAIL_OFFSET + (rows - 1) * TIER_H + topGap;
  const frameH = PLATE_H * 2 + postRegion;
  const lift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + lift;

  const sceneW = totalW * S;
  const sceneH = overallH * S;
  const sceneD = RACK_DEPTH * S;
  const maxDim = Math.max(sceneW, sceneH, sceneD);
  const dist = maxDim * 1.6;

  useEffect(() => {
    camera.position.set(dist * 0.85, dist * 0.55, dist);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, dist]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      autoRotate={false}
      enablePan
      panSpeed={0.5}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 1.6}
      minDistance={0.4}
      maxDistance={dist * 3}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Export
// ═══════════════════════════════════════════════════════════════════════════

export default function Rack3D(props: Rack3DProps) {
  return (
    <div className="absolute inset-0" style={{ touchAction: "none" }}>
      <Canvas
        shadows
        camera={{ fov: 40 }}
        gl={{ antialias: true, alpha: false }}
      >
        {/* Pure white background */}
        <color attach="background" args={["#ffffff"]} />

        {/* Studio lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-bias={-0.0002}
        />
        <directionalLight position={[-8, 10, -6]} intensity={0.3} />
        <pointLight position={[0, 6, 3]} intensity={0.2} color="#ffeedd" />
        <hemisphereLight args={["#ffffff", "#e0d8c8", 0.35]} />

        {/* Soft contact shadows where wheels meet floor */}
        <ContactShadows
          position={[0, -0.002, 0]}
          opacity={0.45}
          scale={14}
          blur={2.5}
          far={5}
          color="#000000"
        />

        {/* Camera — locked, no auto-rotate */}
        <CameraRig
          cols={props.cols}
          rows={props.rows}
          toteType={props.toteType}
          hasWheels={props.hasWheels}
        />

        <Ground />
        <RackAssembly {...props} />
      </Canvas>
    </div>
  );
}
