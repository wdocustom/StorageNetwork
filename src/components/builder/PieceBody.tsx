"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — how one piece looks in 3D
//
// Shared by the editor's 3D view, the build guide and the PDF step renders,
// so a piece is drawn the same everywhere:
//   • 2×4s and plywood: a box in the same procedural wood materials as the
//     tote-rack guide, with a thin outline so stacked boards read as
//     separate parts
//   • casters: the same caster model the tote-rack guide uses
//   • totes: a simple dark body with a yellow lid (a stand-in, not a part)
//
// Draw it inside a group that already has the piece's position and
// rotation; everything here is in the piece's own inches, centered on it.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { MeshStandardMaterial } from "three";
import IndustrialCaster from "@/components/visualizer/IndustrialCaster";
import {
  createConstructionLumberMaterial,
  createPlywoodTopMaterial,
  restoreAllTextures,
} from "@/components/visualizer/woodTextures";
import { getStock } from "@/lib/builder/catalog";
import type { ScenePiece } from "@/lib/builder/scene";

export const PIECE_EDGE_COLOR = "#8a744a";

interface Materials {
  lumber: MeshStandardMaterial;
  plywood: MeshStandardMaterial;
  toteBody: MeshStandardMaterial;
  toteLid: MeshStandardMaterial;
  /** Pieces already built, when the guide dims them */
  ghost: MeshStandardMaterial;
  /** Invisible, but still catches clicks (around a caster's thin parts) */
  hit: MeshStandardMaterial;
}

let materials: Materials | null = null;

/** Made once, in the browser (the wood textures are drawn on a canvas). */
function getMaterials(): Materials {
  materials ??= {
    lumber: createConstructionLumberMaterial(42),
    plywood: createPlywoodTopMaterial(250),
    toteBody: new MeshStandardMaterial({ color: "#27272a", roughness: 0.55, metalness: 0.05 }),
    toteLid: new MeshStandardMaterial({ color: "#eab308", roughness: 0.5, metalness: 0.05 }),
    ghost: new MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.9, transparent: true, opacity: 0.35, depthWrite: false }),
    hit: new MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  };
  return materials;
}

/** Re-uploads the procedural textures when the tab comes back (browsers may drop them). */
export function TextureGuard() {
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

/** Height of the tote's lid, inches */
const TOTE_LID = 1.25;

export default function PieceBody({
  piece,
  edgeColor = PIECE_EDGE_COLOR,
  edgeWidth = 1,
  ghost = false,
}: {
  piece: ScenePiece;
  edgeColor?: string;
  edgeWidth?: number;
  /** Draw it faded: already built, not what this step is about */
  ghost?: boolean;
}) {
  const m = getMaterials();
  const look = getStock(piece.stock)?.look ?? "lumber";
  const size: [number, number, number] = [piece.length, piece.thickness, piece.width];

  if (ghost) {
    return (
      <mesh material={m.ghost}>
        <boxGeometry args={size} />
        <Edges threshold={15} color="#94a3b8" lineWidth={1} />
      </mesh>
    );
  }

  if (look === "caster") {
    return (
      <>
        {/* The caster model stands on y = 0; the piece is centered on its middle */}
        <IndustrialCaster position={[0, -piece.thickness / 2, 0]} />
        <mesh material={m.hit}>
          <boxGeometry args={size} />
          {edgeWidth > 1 && <Edges threshold={15} color={edgeColor} lineWidth={edgeWidth} />}
        </mesh>
      </>
    );
  }

  if (look === "tote") {
    const body = piece.thickness - TOTE_LID;
    return (
      <>
        <mesh material={m.toteBody} position={[0, -TOTE_LID / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[piece.length - 1.5, body, piece.width - 1.5]} />
        </mesh>
        <mesh material={m.toteLid} position={[0, piece.thickness / 2 - TOTE_LID / 2, 0]} castShadow>
          <boxGeometry args={[piece.length, TOTE_LID, piece.width]} />
          <Edges threshold={15} color={edgeWidth > 1 ? edgeColor : "#a16207"} lineWidth={edgeWidth} />
        </mesh>
      </>
    );
  }

  return (
    <mesh material={m[look]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <Edges threshold={15} color={edgeColor} lineWidth={edgeWidth} />
    </mesh>
  );
}
