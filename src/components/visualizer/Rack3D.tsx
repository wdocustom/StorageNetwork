"use client";

import { useMemo, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import IndustrialCaster, { CASTER_HEIGHT } from "./IndustrialCaster";

// ═══════════════════════════════════════════════════════════════════════════
// Rack3D — Precise CAD Blueprint (Rim-Glider System)
//
// All geometry is computed in INCHES then scaled uniformly.
// The 2D blueprint is correct — this 3D must match it exactly.
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

// ── Constants (inches) ───────────────────────────────────────────────────

const POST_W = 1.5;            // 2×4 narrow face
const POST_D = 3.5;            // 2×4 wide face
const RAIL_THICKNESS = 0.75;   // 3/4" plywood strip
const RAIL_HEIGHT = 1.75;      // plywood strip visible height
const BIN_LIP_WIDTH = 1.0;     // rim overhang per side
const BIN_GAP = 0.25;          // tolerance

const PLATE_H = 1.5;           // bottom/top plate (2×4 flat)
const RACK_DEPTH = 30;         // front-to-back
const TIER_SPACING = 16;       // center-to-center between rails
const PLY_TOP_H = 0.75;        // plywood top sheet

// Tote
const TOTE_FULL_W_HDX = 19.75;
const TOTE_FULL_W_GM = 20.75;
const TOTE_RIM_H = 1.0;
const TOTE_BODY_H = 11.0;
const TOTE_BODY_TAPER = 0.85;
const TOTE_DEPTH = 15.5;       // Real tote depth (front-to-back)

// Inches → scene units. 1 inch = S scene units.
const S = 1 / 48; // ~0.0208 — so 48" = 1 scene unit

// ── Derived ──────────────────────────────────────────────────────────────

function getBayWidth(toteType: ToteType): number {
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  return toteW - 2 * BIN_LIP_WIDTH + 2 * BIN_GAP;
}

function getPostX(i: number, bayW: number): number {
  return i * (bayW + POST_W) + POST_W / 2;
}

// First rail must be high enough that the tote hanging from it
// doesn't touch the bottom plate (with 2" safety gap)
const MIN_FIRST_RAIL_Y = TOTE_BODY_H + TOTE_RIM_H - RAIL_HEIGHT / 2 + 2;

// ── Materials ────────────────────────────────────────────────────────────

function usePineMat() {
  return useMemo(() => {
    if (typeof document === "undefined") {
      return new THREE.MeshStandardMaterial({
        color: "#C8A96E", roughness: 0.85, metalness: 0.0,
      });
    }
    const cw = 64, ch = 256;
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#C8A96E";
    ctx.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 50; i++) {
      const y0 = (i / 50) * ch + (Math.random() - 0.5) * 8;
      ctx.strokeStyle = `rgba(130,85,40,${0.05 + Math.random() * 0.12})`;
      ctx.lineWidth = 0.3 + Math.random() * 1.4;
      ctx.beginPath(); ctx.moveTo(0, y0);
      for (let x = 0; x <= cw; x += 3) ctx.lineTo(x, y0 + Math.sin(x * 0.06 + i * 0.7) * 1.8);
      ctx.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const kx = 8 + Math.random() * (cw - 16);
      const ky = 30 + Math.random() * (ch - 60);
      const kr = 2 + Math.random() * 4;
      const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
      g.addColorStop(0, "rgba(90,55,25,0.25)"); g.addColorStop(1, "rgba(90,55,25,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, Math.PI * 2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: tex, color: "#C8A96E", roughness: 0.85, metalness: 0.0 });
  }, []);
}

function usePlywoodMat() {
  return useMemo(() => new THREE.MeshStandardMaterial({
    color: "#A8884E", roughness: 0.6, metalness: 0.0,
  }), []);
}

// ── Primitives ───────────────────────────────────────────────────────────

function Lumber({ position, size }: {
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

function PlywoodStrip({ position, length }: {
  position: [number, number, number];
  length: number;
}) {
  const mat = usePlywoodMat();
  return (
    <mesh position={position} material={mat} castShadow receiveShadow>
      <boxGeometry args={[RAIL_THICKNESS, RAIL_HEIGHT, length]} />
    </mesh>
  );
}

// ── Tote ─────────────────────────────────────────────────────────────────
// Group origin = bottom of body. Body goes y=0..TOTE_BODY_H, rim above.

function Tote({ position, bayW, toteType }: {
  position: [number, number, number];
  bayW: number;
  toteType: ToteType;
}) {
  const toteW = toteType === "HDX" ? TOTE_FULL_W_HDX : TOTE_FULL_W_GM;
  const color = toteType === "HDX" ? "#fbbf24" : "#ef4444";

  // Rim = full tote width (overhangs rails by BIN_LIP_WIDTH each side)
  const rimW = toteW;
  // Body top width = bay width (fits between the rails)
  const bodyTopW = bayW - BIN_GAP * 2;
  const bodyBotW = bodyTopW * TOTE_BODY_TAPER;
  const bodyTopD = TOTE_DEPTH * 0.95;
  const bodyBotD = TOTE_DEPTH * 0.82;
  const rimD = TOTE_DEPTH;

  const bodyGeo = useMemo(() => {
    const hw_t = bodyTopW / 2, hw_b = bodyBotW / 2;
    const hd_t = bodyTopD / 2, hd_b = bodyBotD / 2;
    const h = TOTE_BODY_H;
    const v = new Float32Array([
      -hw_b, 0, -hd_b, hw_b, 0, -hd_b, hw_b, 0, hd_b, -hw_b, 0, hd_b,
      -hw_t, h, -hd_t, hw_t, h, -hd_t, hw_t, h, hd_t, -hw_t, h, hd_t,
    ]);
    const idx = [
      0,2,1, 0,3,2, 4,5,6, 4,6,7,
      0,1,5, 0,5,4, 2,3,7, 2,7,6,
      0,4,7, 0,7,3, 1,2,6, 1,6,5,
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }, [bodyTopW, bodyBotW, bodyTopD, bodyBotD]);

  return (
    <group position={position}>
      {/* Black tapered body */}
      <mesh geometry={bodyGeo} castShadow>
        <meshStandardMaterial color="#1a1a1a" roughness={0.55} metalness={0.02} side={THREE.DoubleSide} />
      </mesh>
      {/* Colored rim — full tote width, overhangs rails */}
      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H / 2, 0]} castShadow>
        <boxGeometry args={[rimW, TOTE_RIM_H, rimD]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.05} />
      </mesh>
      {/* Lid snap ridge */}
      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H + 0.12, 0]}>
        <boxGeometry args={[rimW - 0.5, 0.25, rimD - 0.5]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.08} />
      </mesh>
    </group>
  );
}

// ── Rack Assembly ────────────────────────────────────────────────────────

function RackAssembly({
  cols, rows, toteType, hasTotes, hasWheels, hasTop,
}: Rack3DProps) {
  const bayW = getBayWidth(toteType);
  const totalW = cols * bayW + (cols + 1) * POST_W;

  const firstRailY = Math.max(MIN_FIRST_RAIL_Y, PLATE_H + 2);
  const lastRailY = firstRailY + (rows - 1) * TIER_SPACING;
  const topGap = 3;
  const frameH = PLATE_H + lastRailY + topGap + PLATE_H;

  const lift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + lift;

  // Center the model at scene origin
  const cx = totalW / 2;
  const cy = overallH / 2;
  const cz = RACK_DEPTH / 2;

  const railLen = RACK_DEPTH - POST_D * 2;
  const postH = frameH - PLATE_H * 2;

  // The whole model is built at inch scale, then uniformly scaled.
  // The centering offset is ALSO in inches, applied before scaling.
  return (
    <group scale={[S, S, S]}>
      <group position={[-cx, -cy, -cz]}>

        {/* ── WOOD FRAME — lifted by caster height ── */}
        <group position={[0, lift, 0]}>

          {/* Bottom plates */}
          <Lumber position={[totalW / 2, PLATE_H / 2, POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />
          <Lumber position={[totalW / 2, PLATE_H / 2, RACK_DEPTH - POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />

          {/* Top plates */}
          <Lumber position={[totalW / 2, frameH - PLATE_H / 2, POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />
          <Lumber position={[totalW / 2, frameH - PLATE_H / 2, RACK_DEPTH - POST_D / 2]} size={[totalW, PLATE_H, POST_D]} />

          {/* Ladder frames: posts + rails */}
          {Array.from({ length: cols + 1 }).map((_, i) => {
            const px = getPostX(i, bayW);
            return (
              <group key={`ladder-${i}`}>
                {/* Front + Back posts */}
                <Lumber position={[px, PLATE_H + postH / 2, POST_D / 2]} size={[POST_W, postH, POST_D]} />
                <Lumber position={[px, PLATE_H + postH / 2, RACK_DEPTH - POST_D / 2]} size={[POST_W, postH, POST_D]} />

                {/* Right-face rails (serve bay i) */}
                {i < cols && Array.from({ length: rows }).map((_, r) => {
                  const railY = PLATE_H + firstRailY + r * TIER_SPACING;
                  const railX = px + POST_W / 2 + RAIL_THICKNESS / 2;
                  return <PlywoodStrip key={`rr-${i}-${r}`} position={[railX, railY, RACK_DEPTH / 2]} length={railLen} />;
                })}

                {/* Left-face rails (serve bay i-1) */}
                {i > 0 && Array.from({ length: rows }).map((_, r) => {
                  const railY = PLATE_H + firstRailY + r * TIER_SPACING;
                  const railX = px - POST_W / 2 - RAIL_THICKNESS / 2;
                  return <PlywoodStrip key={`rl-${i}-${r}`} position={[railX, railY, RACK_DEPTH / 2]} length={railLen} />;
                })}
              </group>
            );
          })}

          {/* Totes */}
          {hasTotes && Array.from({ length: cols }).map((_, c) => {
            const leftPostX = getPostX(c, bayW);
            const rightPostX = getPostX(c + 1, bayW);
            const bayCenterX = (leftPostX + rightPostX) / 2;

            return Array.from({ length: rows }).map((_, r) => {
              const railCenterY = PLATE_H + firstRailY + r * TIER_SPACING;
              const railTop = railCenterY + RAIL_HEIGHT / 2;
              const toteGroupY = railTop - TOTE_RIM_H - TOTE_BODY_H;

              return (
                <Tote
                  key={`tote-${c}-${r}`}
                  position={[bayCenterX, toteGroupY, RACK_DEPTH / 2]}
                  bayW={bayW}
                  toteType={toteType}
                />
              );
            });
          })}

          {/* Plywood top */}
          {hasTop && (
            <mesh position={[totalW / 2, frameH + PLY_TOP_H / 2, RACK_DEPTH / 2]} castShadow receiveShadow>
              <boxGeometry args={[totalW + 2, PLY_TOP_H, RACK_DEPTH + 2]} />
              <meshStandardMaterial color="#D4B896" roughness={0.6} metalness={0.0} />
            </mesh>
          )}
        </group>

        {/* Casters — under every post pair */}
        {hasWheels && Array.from({ length: cols + 1 }).map((_, i) => {
          const px = getPostX(i, bayW);
          return (
            <group key={`casters-${i}`}>
              <IndustrialCaster position={[px, 0, POST_D / 2]} />
              <IndustrialCaster position={[px, 0, RACK_DEPTH - POST_D / 2]} />
            </group>
          );
        })}
      </group>
    </group>
  );
}

// ── Camera rig ───────────────────────────────────────────────────────────

function CameraRig({ cols, rows, toteType, hasWheels }: Pick<Rack3DProps, "cols" | "rows" | "toteType" | "hasWheels">) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const bayW = getBayWidth(toteType);
  const totalW = cols * bayW + (cols + 1) * POST_W;
  const firstRailY = Math.max(MIN_FIRST_RAIL_Y, PLATE_H + 2);
  const lastRailY = firstRailY + (rows - 1) * TIER_SPACING;
  const frameH = PLATE_H + lastRailY + 3 + PLATE_H;
  const lift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + lift;

  // Scene-space dimensions
  const sw = totalW * S;
  const sh = overallH * S;
  const sd = RACK_DEPTH * S;
  const maxDim = Math.max(sw, sh, sd);
  const dist = maxDim * 2.0;

  useEffect(() => {
    camera.position.set(dist * 0.9, dist * 0.65, dist * 1.1);
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
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 1.5}
      minDistance={0.2}
      maxDistance={dist * 5}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
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

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[12, 18, 12]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
          shadow-bias={-0.0002}
        />
        <directionalLight position={[-10, 12, -8]} intensity={0.3} />
        <hemisphereLight args={["#ffffff", "#e8dcc8", 0.4]} />

        {/* Contact shadows — subtle dark patch at base */}
        <ContactShadows
          position={[0, -0.001, 0]}
          opacity={0.35}
          scale={10}
          blur={2.5}
          far={4}
          color="#000000"
        />

        <CameraRig
          cols={props.cols}
          rows={props.rows}
          toteType={props.toteType}
          hasWheels={props.hasWheels}
        />

        <RackAssembly {...props} />
      </Canvas>
    </div>
  );
}
