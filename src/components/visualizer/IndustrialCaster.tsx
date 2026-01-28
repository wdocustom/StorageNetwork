"use client";

import * as THREE from "three";
import { useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// IndustrialCaster — Procedural Heavy-Duty Swivel Caster
// Built entirely from grouped primitives. No external models.
//
// Assembly (top → bottom):
//   Mount Plate  →  Pivot Stem  →  Yoke (U-bracket)  →  Wheel + Hubcaps
//
// CASTER_HEIGHT is measured from floor (y = 0) to top of mounting plate.
// ═══════════════════════════════════════════════════════════════════════════

export const CASTER_HEIGHT = 4; // inches — total floor-to-plate-top

// ── Internal dimensions (inches) ─────────────────────────────────────────
const PLATE_SIZE = 4;       // Mount plate footprint (square)
const PLATE_THICK = 0.2;    // Mount plate thickness
const PIVOT_R = 0.35;       // Pivot stem radius
const PIVOT_H = 0.6;        // Pivot stem height
const WHEEL_R = 1.5;        // Wheel radius
const WHEEL_W = 1.0;        // Wheel width (tread)
const HUB_R = 0.55;         // Hubcap radius
const HUB_THICK = 0.12;     // Hubcap disc thickness
const FORK_ARM_W = 0.4;     // Fork arm width (x)
const FORK_ARM_D = 1.0;     // Fork arm depth (z)
const AXLE_R = 0.15;        // Axle radius

// Derived
const WHEEL_CENTER_Y = WHEEL_R;                          // Wheel rests on floor
const PLATE_TOP_Y = CASTER_HEIGHT;                        // Top surface
const PLATE_CENTER_Y = PLATE_TOP_Y - PLATE_THICK / 2;    // Plate center
const PIVOT_CENTER_Y = PLATE_TOP_Y - PLATE_THICK - PIVOT_H / 2;
const FORK_TOP_Y = PIVOT_CENTER_Y - PIVOT_H / 2;
const FORK_ARM_H = FORK_TOP_Y - (WHEEL_CENTER_Y - WHEEL_R * 0.4);
const FORK_ARM_CENTER_Y = FORK_TOP_Y - FORK_ARM_H / 2;
const FORK_ARM_OFFSET_X = WHEEL_W / 2 + FORK_ARM_W / 2 + 0.08;

// ── Shared materials (created once via hooks) ────────────────────────────

function useSteelMat() {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#A0A0A0"),
        roughness: 0.3,
        metalness: 0.85,
      }),
    []
  );
}

function useRubberMat() {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#333333"),
        roughness: 0.92,
        metalness: 0.02,
      }),
    []
  );
}

function useHubMat() {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#CCCCCC"),
        roughness: 0.2,
        metalness: 0.9,
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
  const rubber = useRubberMat();
  const hub = useHubMat();

  return (
    <group position={position}>
      {/* ── Mounting Plate ── */}
      <mesh position={[0, PLATE_CENTER_Y, 0]} material={steel} castShadow>
        <boxGeometry args={[PLATE_SIZE, PLATE_THICK, PLATE_SIZE]} />
      </mesh>

      {/* ── Bolt holes (cosmetic — 4 dark dots) ── */}
      {[
        [PLATE_SIZE * 0.32, PLATE_TOP_Y + 0.01, PLATE_SIZE * 0.32],
        [-PLATE_SIZE * 0.32, PLATE_TOP_Y + 0.01, PLATE_SIZE * 0.32],
        [PLATE_SIZE * 0.32, PLATE_TOP_Y + 0.01, -PLATE_SIZE * 0.32],
        [-PLATE_SIZE * 0.32, PLATE_TOP_Y + 0.01, -PLATE_SIZE * 0.32],
      ].map((pos, i) => (
        <mesh
          key={`bolt-${i}`}
          position={pos as [number, number, number]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.15, 0.15, 0.02, 8]} />
          <meshStandardMaterial color="#444" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}

      {/* ── Pivot Stem ── */}
      <mesh position={[0, PIVOT_CENTER_Y, 0]} material={steel}>
        <cylinderGeometry args={[PIVOT_R, PIVOT_R, PIVOT_H, 16]} />
      </mesh>

      {/* ── Yoke Cross-bar (top of U) ── */}
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

      {/* ── Wheel (rubber tread) ── */}
      <mesh
        rotation={[0, 0, Math.PI / 2]}
        position={[0, WHEEL_CENTER_Y, 0]}
        material={rubber}
        castShadow
      >
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, WHEEL_W, 32]} />
      </mesh>

      {/* ── Hubcap Left ── */}
      <mesh
        rotation={[0, 0, Math.PI / 2]}
        position={[-(WHEEL_W / 2 + 0.01), WHEEL_CENTER_Y, 0]}
        material={hub}
      >
        <cylinderGeometry args={[HUB_R, HUB_R, HUB_THICK, 16]} />
      </mesh>

      {/* ── Hubcap Right ── */}
      <mesh
        rotation={[0, 0, Math.PI / 2]}
        position={[WHEEL_W / 2 + 0.01, WHEEL_CENTER_Y, 0]}
        material={hub}
      >
        <cylinderGeometry args={[HUB_R, HUB_R, HUB_THICK, 16]} />
      </mesh>

      {/* ── Axle ── */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, WHEEL_CENTER_Y, 0]}>
        <cylinderGeometry args={[AXLE_R, AXLE_R, WHEEL_W + FORK_ARM_W * 2 + 0.4, 8]} />
        <meshStandardMaterial color="#888" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}
