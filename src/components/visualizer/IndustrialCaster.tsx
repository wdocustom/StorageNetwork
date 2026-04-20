"use client";

import { MeshStandardMaterial, Color } from "three";
import { useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// IndustrialCaster — Heavy-Duty Swivel Caster (matches reference photo)
//
// Reference dimensions (from photo):
//   Total height:  15cm / ~5.9"  (floor to plate top)
//   Wheel diameter: 13cm / ~5.11" → radius ≈ 2.56"
//   Plate:          6.2cm / ~2.44" square
//   Wheel width:    ~1.5"
//
// Assembly (top → bottom):
//   Silver Mount Plate → Pivot Stem → Steel Yoke → Red Polyurethane Wheel
//   with Grey Hub + Brake Lever bracket
//
// CASTER_HEIGHT = floor (y=0) to top of mounting plate
// ═══════════════════════════════════════════════════════════════════════════

export const CASTER_HEIGHT = 5.9; // inches — floor to plate top

// ── Dimensions (inches) ───────────────────────────────────────────────────
const PLATE_SIZE = 2.44;       // Square plate footprint
const PLATE_THICK = 0.18;      // Plate thickness
const PIVOT_R = 0.3;           // Pivot stem radius
const PIVOT_H = 0.5;           // Pivot stem height
const WHEEL_R = 2.56;          // Wheel radius (~5.11" diameter)
const WHEEL_W = 1.5;           // Wheel tread width
const HUB_R = 0.8;             // Hub disc radius
const HUB_THICK = 0.15;        // Hub disc thickness
const FORK_ARM_W = 0.35;       // Fork arm width (x)
const FORK_ARM_D = 1.2;        // Fork arm depth (z)
const AXLE_R = 0.18;           // Axle radius
const BRAKE_W = 0.25;          // Brake lever width
const BRAKE_D = 1.8;           // Brake lever depth (z)
const BRAKE_H = 0.2;           // Brake lever thickness

// ── Derived positions ─────────────────────────────────────────────────────
const WHEEL_CENTER_Y = WHEEL_R;                          // Wheel sits on floor
const PLATE_TOP_Y = CASTER_HEIGHT;                        // Top surface
const PLATE_CENTER_Y = PLATE_TOP_Y - PLATE_THICK / 2;
const PIVOT_CENTER_Y = PLATE_TOP_Y - PLATE_THICK - PIVOT_H / 2;
const FORK_TOP_Y = PIVOT_CENTER_Y - PIVOT_H / 2;
const FORK_ARM_H = FORK_TOP_Y - (WHEEL_CENTER_Y - WHEEL_R * 0.35);
const FORK_ARM_CENTER_Y = FORK_TOP_Y - FORK_ARM_H / 2;
const FORK_ARM_OFFSET_X = WHEEL_W / 2 + FORK_ARM_W / 2 + 0.1;

// ── Materials ─────────────────────────────────────────────────────────────

function useSteelMat() {
  return useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#B0B0B0"),
        roughness: 0.25,
        metalness: 0.88,
      }),
    []
  );
}

function useRedWheelMat() {
  return useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#C0392B"),
        roughness: 0.7,
        metalness: 0.05,
      }),
    []
  );
}

function useGreyHubMat() {
  return useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#888888"),
        roughness: 0.35,
        metalness: 0.6,
      }),
    []
  );
}

function useDarkSteelMat() {
  return useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#555555"),
        roughness: 0.4,
        metalness: 0.7,
      }),
    []
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function IndustrialCaster({
  position,
}: {
  position: [number, number, number];
}) {
  const steel = useSteelMat();
  const redWheel = useRedWheelMat();
  const greyHub = useGreyHubMat();
  const darkSteel = useDarkSteelMat();

  return (
    <group position={position}>
      {/* ── Silver Mounting Plate ── */}
      <mesh position={[0, PLATE_CENTER_Y, 0]} material={steel} castShadow>
        <boxGeometry args={[PLATE_SIZE, PLATE_THICK, PLATE_SIZE]} />
      </mesh>

      {/* ── Bolt holes (4 dark dots) ── */}
      {[
        [PLATE_SIZE * 0.34, PLATE_TOP_Y + 0.01, PLATE_SIZE * 0.34],
        [-PLATE_SIZE * 0.34, PLATE_TOP_Y + 0.01, PLATE_SIZE * 0.34],
        [PLATE_SIZE * 0.34, PLATE_TOP_Y + 0.01, -PLATE_SIZE * 0.34],
        [-PLATE_SIZE * 0.34, PLATE_TOP_Y + 0.01, -PLATE_SIZE * 0.34],
      ].map((pos, i) => (
        <mesh
          key={`bolt-${i}`}
          position={pos as [number, number, number]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.12, 0.12, 0.02, 8]} />
          <meshStandardMaterial color="#444" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}

      {/* ── Pivot Stem ── */}
      <mesh position={[0, PIVOT_CENTER_Y, 0]} material={steel}>
        <cylinderGeometry args={[PIVOT_R, PIVOT_R, PIVOT_H, 16]} />
      </mesh>

      {/* ── Yoke Cross-bar ── */}
      <mesh position={[0, FORK_TOP_Y - 0.15, 0]} material={steel} castShadow>
        <boxGeometry
          args={[FORK_ARM_OFFSET_X * 2 + FORK_ARM_W, 0.3, FORK_ARM_D]}
        />
      </mesh>

      {/* ── Yoke Left Arm ── */}
      <mesh
        position={[-FORK_ARM_OFFSET_X, FORK_ARM_CENTER_Y, 0]}
        material={steel}
        castShadow
      >
        <boxGeometry args={[FORK_ARM_W, FORK_ARM_H, FORK_ARM_D]} />
      </mesh>

      {/* ── Yoke Right Arm ── */}
      <mesh
        position={[FORK_ARM_OFFSET_X, FORK_ARM_CENTER_Y, 0]}
        material={steel}
        castShadow
      >
        <boxGeometry args={[FORK_ARM_W, FORK_ARM_H, FORK_ARM_D]} />
      </mesh>

      {/* ── Red Polyurethane Wheel ── */}
      <mesh
        rotation={[0, 0, Math.PI / 2]}
        position={[0, WHEEL_CENTER_Y, 0]}
        material={redWheel}
        castShadow
      >
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, WHEEL_W, 32]} />
      </mesh>

      {/* ── Grey Hub Left ── */}
      <mesh
        rotation={[0, 0, Math.PI / 2]}
        position={[-(WHEEL_W / 2 - 0.02), WHEEL_CENTER_Y, 0]}
        material={greyHub}
      >
        <cylinderGeometry args={[HUB_R, HUB_R, HUB_THICK, 16]} />
      </mesh>

      {/* ── Grey Hub Right ── */}
      <mesh
        rotation={[0, 0, Math.PI / 2]}
        position={[WHEEL_W / 2 - 0.02, WHEEL_CENTER_Y, 0]}
        material={greyHub}
      >
        <cylinderGeometry args={[HUB_R, HUB_R, HUB_THICK, 16]} />
      </mesh>

      {/* ── Axle ── */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, WHEEL_CENTER_Y, 0]}>
        <cylinderGeometry args={[AXLE_R, AXLE_R, WHEEL_W + FORK_ARM_W * 2 + 0.4, 8]} />
        <meshStandardMaterial color="#777" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* ── Brake Lever (bracket on one side) ── */}
      <mesh
        position={[FORK_ARM_OFFSET_X + FORK_ARM_W / 2 + BRAKE_W / 2, WHEEL_CENTER_Y + WHEEL_R * 0.3, FORK_ARM_D / 2 - 0.2]}
        material={darkSteel}
        castShadow
      >
        <boxGeometry args={[BRAKE_W, BRAKE_H, BRAKE_D]} />
      </mesh>

      {/* ── Brake Lever Arm (angled down toward wheel) ── */}
      <mesh
        position={[FORK_ARM_OFFSET_X + FORK_ARM_W / 2 + BRAKE_W / 2, WHEEL_CENTER_Y - 0.2, FORK_ARM_D / 2 + BRAKE_D / 2 - 0.2]}
        rotation={[0.4, 0, 0]}
        material={darkSteel}
      >
        <boxGeometry args={[BRAKE_W, BRAKE_H, WHEEL_R * 0.8]} />
      </mesh>

      {/* ── Brake Pad (touches wheel) ── */}
      <mesh
        position={[FORK_ARM_OFFSET_X + FORK_ARM_W / 2 + BRAKE_W / 2, WHEEL_CENTER_Y - WHEEL_R * 0.15, 0]}
        material={darkSteel}
      >
        <boxGeometry args={[BRAKE_W + 0.1, 0.3, 0.6]} />
      </mesh>
    </group>
  );
}
