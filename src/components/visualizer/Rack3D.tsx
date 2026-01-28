"use client";

import { useMemo, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════════════════
// Rack3D — Interactive 3D Configurator (Visual Only)
// "Rim-Glider" construction: 2×4 posts + 3/4" plywood rail strips.
// Totes hang between rails; yellow rim rests on plywood edge.
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

const POST_W = 1.5;       // 2×4 actual width
const POST_D = 3.5;       // 2×4 actual depth
const RAIL_THICK = 0.75;  // 3/4" plywood strip thickness
const RAIL_H = 1.75;      // Plywood strip height
const RACK_DEPTH = 30;    // Front-to-back
const TIER_H = 16;        // Center-to-center between tiers
const PLATE_H = 1.5;      // Top & bottom plate thickness
const PLY_H = 0.75;       // Plywood top thickness
const TOTE_RIM_H = 1.0;   // Yellow rim height
const TOTE_RIM_OVERHANG = 0.5; // How much rim overhangs body
const TOTE_BODY_H = 11.0; // Tote body below rim
const TOTE_TOLERANCE = 0.25;

// ── Industrial Caster Constants ──────────────────────────────────────────
const CASTER_HEIGHT = 4;        // Total caster assembly height (inches)
const CASTER_WHEEL_R = 1.5;     // Wheel radius (inches)
const CASTER_WHEEL_W = 1.0;     // Wheel thickness (inches)
const CASTER_PLATE = 4;         // Mount plate side length (inches)
const CASTER_PLATE_H = 0.25;    // Mount plate thickness
const CASTER_FORK_W = 0.5;      // Fork arm width
const CASTER_HUB_R = 0.5;       // Hub cap radius

// Bottom rail must be high enough that hanging tote clears wheels
// Tote hangs: TOTE_BODY_H + TOTE_RIM_H below rail center
// Safety gap: 2 inches above caster top
const BOTTOM_RAIL_Y_MIN = TOTE_BODY_H + TOTE_RIM_H + 2;
const TOP_GAP = Math.max(2.5, BOTTOM_RAIL_Y_MIN - PLATE_H);

// Scale: inches → scene units
const S = 0.02;

// ── Materials ────────────────────────────────────────────────────────────

function useWoodMat() {
  return useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#D4B483"),
      roughness: 0.92,
      metalness: 0.0,
    });
    // Procedural grain via bump: create a small canvas texture
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#D4B483";
      ctx.fillRect(0, 0, 128, 512);
      // Draw grain lines
      for (let i = 0; i < 60; i++) {
        const y = Math.random() * 512;
        const alpha = 0.08 + Math.random() * 0.12;
        ctx.strokeStyle = `rgba(120, 80, 40, ${alpha})`;
        ctx.lineWidth = 0.5 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        // Slight wave
        for (let x = 0; x < 128; x += 4) {
          ctx.lineTo(x, y + Math.sin(x * 0.05) * 2);
        }
        ctx.stroke();
      }
      // Knot spots
      for (let k = 0; k < 3; k++) {
        const kx = 20 + Math.random() * 88;
        const ky = 40 + Math.random() * 432;
        const kr = 3 + Math.random() * 5;
        ctx.beginPath();
        ctx.arc(kx, ky, kr, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100, 65, 30, 0.15)";
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    mat.map = tex;
    mat.needsUpdate = true;
    return mat;
  }, []);
}

function usePlywoodMat() {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#B89E6A"),
        roughness: 0.65,
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
  const mat = useWoodMat();
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
// Body is narrower at bottom, wider at top. Yellow rim sits on plywood edge.

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

  // Tapered body: bottom is ~85% of top width
  const bottomWidth = topWidth * 0.85;
  const bodyTopDepth = bodyDepth * 0.92;
  const bodyBottomDepth = bodyDepth * 0.82;

  // Custom trapezoid geometry for the body
  const bodyVerts = useMemo(() => {
    const hw_t = topWidth / 2;
    const hw_b = bottomWidth / 2;
    const hd_t = bodyTopDepth / 2;
    const hd_b = bodyBottomDepth / 2;
    const h = TOTE_BODY_H;

    const vertices = new Float32Array([
      -hw_b, 0, -hd_b,   hw_b, 0, -hd_b,   hw_b, 0, hd_b,   -hw_b, 0, hd_b,
      -hw_t, h, -hd_t,   hw_t, h, -hd_t,   hw_t, h, hd_t,   -hw_t, h, hd_t,
    ]);

    const indices = [
      0, 2, 1, 0, 3, 2,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      2, 3, 7, 2, 7, 6,
      0, 4, 7, 0, 7, 3,
      1, 2, 6, 1, 6, 5,
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [topWidth, bottomWidth, bodyTopDepth, bodyBottomDepth]);

  return (
    <group position={position}>
      <mesh geometry={bodyVerts} castShadow>
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.6}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H / 2, 0]} castShadow>
        <boxGeometry
          args={[
            topWidth + TOTE_RIM_OVERHANG * 2,
            TOTE_RIM_H,
            bodyTopDepth + TOTE_RIM_OVERHANG * 2,
          ]}
        />
        <meshStandardMaterial
          color={lidColor}
          roughness={0.3}
          metalness={0.05}
        />
      </mesh>

      <mesh position={[0, TOTE_BODY_H + TOTE_RIM_H + 0.15, 0]}>
        <boxGeometry
          args={[topWidth + TOTE_RIM_OVERHANG, 0.3, bodyTopDepth + TOTE_RIM_OVERHANG]}
        />
        <meshStandardMaterial
          color={lidColor}
          roughness={0.25}
          metalness={0.08}
        />
      </mesh>
    </group>
  );
}

// ── Industrial Caster Assembly ──────────────────────────────────────────
// Procedural heavy-duty caster: mount plate → fork (U-bracket) → wheel + hub.
// Total height = CASTER_HEIGHT. Wheel sits centered in the fork.

function IndustrialCaster({ position }: { position: [number, number, number] }) {
  const forkH = CASTER_HEIGHT - CASTER_PLATE_H - 0.25; // fork extends from plate down to near wheel center
  const wheelCenterY = CASTER_WHEEL_R; // wheel rests on ground

  return (
    <group position={position}>
      {/* ── Mount Plate (top of caster) ── */}
      <mesh position={[0, CASTER_HEIGHT - CASTER_PLATE_H / 2, 0]} castShadow>
        <boxGeometry args={[CASTER_PLATE, CASTER_PLATE_H, CASTER_PLATE]} />
        <meshStandardMaterial color="#A8A8A8" roughness={0.35} metalness={0.8} />
      </mesh>

      {/* ── Pivot stem ── */}
      <mesh position={[0, CASTER_HEIGHT - CASTER_PLATE_H - 0.4, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.8, 12]} />
        <meshStandardMaterial color="#888" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* ── Fork left arm ── */}
      <mesh
        position={[-(CASTER_WHEEL_W / 2 + CASTER_FORK_W / 2 + 0.1), wheelCenterY + (forkH - CASTER_WHEEL_R) / 2, 0]}
        castShadow
      >
        <boxGeometry args={[CASTER_FORK_W, forkH, 1.2]} />
        <meshStandardMaterial color="#777" roughness={0.35} metalness={0.75} />
      </mesh>

      {/* ── Fork right arm ── */}
      <mesh
        position={[(CASTER_WHEEL_W / 2 + CASTER_FORK_W / 2 + 0.1), wheelCenterY + (forkH - CASTER_WHEEL_R) / 2, 0]}
        castShadow
      >
        <boxGeometry args={[CASTER_FORK_W, forkH, 1.2]} />
        <meshStandardMaterial color="#777" roughness={0.35} metalness={0.75} />
      </mesh>

      {/* ── Fork cross-bar (top of U) ── */}
      <mesh position={[0, CASTER_HEIGHT - CASTER_PLATE_H - 1.0, 0]}>
        <boxGeometry args={[CASTER_WHEEL_W + CASTER_FORK_W * 2 + 0.6, 0.4, 1.2]} />
        <meshStandardMaterial color="#777" roughness={0.35} metalness={0.75} />
      </mesh>

      {/* ── Wheel (rubber tread) ── */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, wheelCenterY, 0]} castShadow>
        <cylinderGeometry args={[CASTER_WHEEL_R, CASTER_WHEEL_R, CASTER_WHEEL_W, 32]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* ── Hub cap (left) ── */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[-(CASTER_WHEEL_W / 2 + 0.01), wheelCenterY, 0]}>
        <cylinderGeometry args={[CASTER_HUB_R, CASTER_HUB_R, 0.15, 16]} />
        <meshStandardMaterial color="#C0C0C0" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* ── Hub cap (right) ── */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[(CASTER_WHEEL_W / 2 + 0.01), wheelCenterY, 0]}>
        <cylinderGeometry args={[CASTER_HUB_R, CASTER_HUB_R, 0.15, 16]} />
        <meshStandardMaterial color="#C0C0C0" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* ── Axle ── */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, wheelCenterY, 0]}>
        <cylinderGeometry args={[0.2, 0.2, CASTER_WHEEL_W + 1.2, 8]} />
        <meshStandardMaterial color="#999" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Rack Assembly
// ═══════════════════════════════════════════════════════════════════════════

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
  const frameH = rows * TIER_H + PLATE_H * 2 + TOP_GAP;
  // Bottom of wood sits exactly on top of caster plate
  const casterLift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + casterLift;

  const centerX = totalW / 2;
  const centerY = overallH / 2;
  const centerZ = RACK_DEPTH / 2;

  return (
    <group
      scale={[S, S, S]}
      position={[-centerX * S, -centerY * S, -centerZ * S]}
    >
      {/* ── Wooden Rack (lifted by CASTER_HEIGHT when wheels present) ── */}
      <group position={[0, casterLift, 0]}>
        {/* ── Bottom Plate ──────────────────────────────────── */}
        <Lumber
          position={[totalW / 2, PLATE_H / 2, POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />
        <Lumber
          position={[totalW / 2, PLATE_H / 2, RACK_DEPTH - POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />

        {/* ── Top Plate ─────────────────────────────────────── */}
        <Lumber
          position={[totalW / 2, frameH - PLATE_H / 2, POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />
        <Lumber
          position={[totalW / 2, frameH - PLATE_H / 2, RACK_DEPTH - POST_D / 2]}
          size={[totalW, PLATE_H, POST_D]}
        />

        {/* ── Ladder Frames with Plywood Rails ──────────────── */}
        {Array.from({ length: cols + 1 }).map((_, i) => {
          const x = i * (opening + POST_W) + POST_W / 2;
          const postH = frameH - PLATE_H * 2;

          const showRight = i < cols;
          const showLeft = i > 0;

          return (
            <group key={`frame-${i}`}>
              <Lumber
                position={[x, PLATE_H + postH / 2, POST_D / 2]}
                size={[POST_W, postH, POST_D]}
              />
              <Lumber
                position={[x, PLATE_H + postH / 2, RACK_DEPTH - POST_D / 2]}
                size={[POST_W, postH, POST_D]}
              />

              {showRight &&
                Array.from({ length: rows }).map((_, r) => {
                  const railY = PLATE_H + TOP_GAP + r * TIER_H;
                  const railX = x + POST_W / 2 + RAIL_THICK / 2;
                  const railLen = RACK_DEPTH - POST_D * 2;
                  return (
                    <PlywoodRail
                      key={`rr-${i}-${r}`}
                      position={[railX, railY, RACK_DEPTH / 2]}
                      length={railLen}
                    />
                  );
                })}

              {showLeft &&
                Array.from({ length: rows }).map((_, r) => {
                  const railY = PLATE_H + TOP_GAP + r * TIER_H;
                  const railX = x - POST_W / 2 - RAIL_THICK / 2;
                  const railLen = RACK_DEPTH - POST_D * 2;
                  return (
                    <PlywoodRail
                      key={`rl-${i}-${r}`}
                      position={[railX, railY, RACK_DEPTH / 2]}
                      length={railLen}
                    />
                  );
                })}
            </group>
          );
        })}

        {/* ── Totes (hanging between plywood rails) ─────────── */}
        {hasTotes &&
          Array.from({ length: cols }).map((_, c) => {
            const bayLeft = POST_W + c * (opening + POST_W);
            const bayCenter = bayLeft + opening / 2;
            const toteTopW = opening - RAIL_THICK * 2 - TOTE_TOLERANCE * 2;

            return Array.from({ length: rows }).map((_, r) => {
              const railY = PLATE_H + TOP_GAP + r * TIER_H;
              const rimTop = railY + RAIL_H / 2;
              const toteBaseY = rimTop - TOTE_RIM_H - TOTE_BODY_H;

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

        {/* ── Plywood Top ───────────────────────────────────── */}
        {hasTop && (
          <mesh
            position={[totalW / 2, frameH + PLY_H / 2, RACK_DEPTH / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[totalW + 2, PLY_H, RACK_DEPTH + 2]} />
            <meshStandardMaterial
              color="#D4B896"
              roughness={0.7}
              metalness={0.0}
            />
          </mesh>
        )}
      </group>

      {/* ── Industrial Casters — at bottom corners of posts ────── */}
      {hasWheels && (
        <>
          <IndustrialCaster position={[POST_W / 2, 0, POST_D / 2]} />
          <IndustrialCaster position={[totalW - POST_W / 2, 0, POST_D / 2]} />
          <IndustrialCaster position={[POST_W / 2, 0, RACK_DEPTH - POST_D / 2]} />
          <IndustrialCaster position={[totalW - POST_W / 2, 0, RACK_DEPTH - POST_D / 2]} />
        </>
      )}
    </group>
  );
}

// ── Ground Plane ─────────────────────────────────────────────────────────

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#f5f5f5" roughness={0.95} metalness={0.0} />
    </mesh>
  );
}

// ── Dynamic Camera Setup ─────────────────────────────────────────────────

function CameraSetup({ cols, rows, toteType, hasWheels }: Pick<Rack3DProps, "cols" | "rows" | "toteType" | "hasWheels">) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const opening = toteType === "HDX" ? 19.75 : 20.75;
  const totalW = cols * opening + (cols + 1) * POST_W;
  const frameH = rows * TIER_H + PLATE_H * 2 + TOP_GAP;
  const casterLift = hasWheels ? CASTER_HEIGHT : 0;
  const overallH = frameH + casterLift;

  const sceneW = totalW * S;
  const sceneH = overallH * S;
  const sceneD = RACK_DEPTH * S;

  const maxDim = Math.max(sceneW, sceneH, sceneD);
  const camDist = maxDim * 1.5;

  useEffect(() => {
    camera.position.set(camDist * 0.8, camDist * 0.6, camDist);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, camDist]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      autoRotate={false}
      enablePan={true}
      panSpeed={0.5}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 1.6}
      minDistance={0.5}
      maxDistance={camDist * 3}
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
        <color attach="background" args={["#ffffff"]} />

        {/* Studio lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
          shadow-bias={-0.0003}
        />
        <directionalLight position={[-8, 10, -6]} intensity={0.3} />
        <pointLight position={[0, 6, 3]} intensity={0.2} color="#ffeedd" />
        <hemisphereLight args={["#ffffff", "#e0d8c8", 0.35]} />

        {/* Contact shadows on the ground plane */}
        <ContactShadows
          position={[0, -0.004, 0]}
          opacity={0.4}
          scale={12}
          blur={2.5}
          far={4}
          color="#000000"
        />

        {/* Dynamic camera + controls */}
        <CameraSetup
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
