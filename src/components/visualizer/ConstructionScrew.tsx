"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Color, Group, MeshStandardMaterial } from "three";

// ═══════════════════════════════════════════════════════════════════════════
// ConstructionScrew — Low-poly Torx construction screw
//
// Geometry: Hex/star head (flat washer disc + drive recess) + threaded shaft
// Color: Zinc/silver metallic
// ═══════════════════════════════════════════════════════════════════════════

const ZINC_COLOR = new Color("#C0C0C0");
const ZINC_HEAD_COLOR = new Color("#A8A8A8");

interface ScrewProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  length?: number; // inches, default 1.625
  label?: string;
  visible?: boolean;
}

export default function ConstructionScrew({
  position,
  rotation = [0, 0, 0],
  length = 1.625,
  label = '#9 × 1-5/8" Star Drive Construction Screw',
  visible = true,
}: ScrewProps) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  // Screw dimensions (inches)
  const headR = 0.22;
  const headH = 0.12;
  const shaftR = 0.07;
  const shaftLen = length - headH;
  const threadR = 0.1;

  // Hover glow
  const glowMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: ZINC_COLOR,
        roughness: 0.2,
        metalness: 0.92,
        emissive: new Color("#ffdd44"),
        emissiveIntensity: 0,
      }),
    []
  );

  const headMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: ZINC_HEAD_COLOR,
        roughness: 0.25,
        metalness: 0.9,
      }),
    []
  );

  useFrame(() => {
    if (!glowMat) return;
    const target = hovered ? 0.6 : 0;
    glowMat.emissiveIntensity += (target - glowMat.emissiveIntensity) * 0.15;
  });

  if (!visible) return null;

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* Head — flat washer disc */}
      <mesh position={[0, 0, 0]} material={headMat}>
        <cylinderGeometry args={[headR, headR, headH, 6]} />
      </mesh>

      {/* Star drive recess (cosmetic indent) */}
      <mesh position={[0, headH / 2 + 0.005, 0]}>
        <cylinderGeometry args={[headR * 0.45, headR * 0.45, 0.03, 6]} />
        <meshStandardMaterial color="#555" roughness={0.5} metalness={0.7} />
      </mesh>

      {/* Shaft */}
      <mesh position={[0, -(shaftLen / 2 + headH / 2), 0]} material={glowMat}>
        <cylinderGeometry args={[shaftR, shaftR, shaftLen, 8]} />
      </mesh>

      {/* Thread ridges (3 rings along shaft for visual detail) */}
      {[0.25, 0.5, 0.75].map((t, i) => (
        <mesh
          key={`thread-${i}`}
          position={[0, -(headH / 2 + shaftLen * t), 0]}
          material={glowMat}
        >
          <cylinderGeometry args={[threadR, threadR, 0.03, 8]} />
        </mesh>
      ))}

      {/* Tip (pointed) */}
      <mesh
        position={[0, -(shaftLen + headH / 2 + 0.06), 0]}
        material={glowMat}
      >
        <coneGeometry args={[shaftR, 0.12, 8]} />
      </mesh>

      {/* Tooltip on hover */}
      {hovered && (
        <Html
          center
          position={[0, headR + 0.8, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              color: "#fbbf24",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "11px",
              fontWeight: 700,
              whiteSpace: "nowrap",
              border: "1px solid rgba(251, 191, 36, 0.3)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}
