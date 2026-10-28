/**
 * woodTextures.ts — Procedural wood grain textures for realistic lumber rendering.
 *
 * Generates Canvas-based textures that mimic:
 *   - Doug-fir 2×4 construction lumber (warm honey tones, pronounced grain)
 *   - Construction-grade plywood (layered cross-grain with visible plies)
 *
 * Used by Rack3D.tsx and AssemblyGuide.tsx for Three.js materials,
 * The grain itself is drawn by woodCanvas.ts (three-free, also used by
 * BlueprintCanvas.tsx for 2D patterns).
 */

import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
  Color,
} from "three";
import { createDougFirCanvas, createPlywoodCanvas, createConstructionLumberCanvas } from "./woodCanvas";

// ═══════════════════════════════════════════════════════════════════════════
// TEXTURE PERSISTENCE — textures own their pixels
//
// The grain is drawn on a 2D canvas, but the GPU texture is built from a copy
// of its pixels in ordinary memory (a DataTexture), never from the canvas.
// Mobile browsers can silently drop a hidden canvas's pixels under GPU memory
// pressure (backgrounded tabs; the PDF renderer, which opens a fresh WebGL
// context per step) — a texture uploaded from such a canvas renders black.
// Pixels held in a typed array upload the same into every context, every time.
// ═══════════════════════════════════════════════════════════════════════════

/** Every procedural texture, so they can be re-uploaded or freed together */
const managedTextures: DataTexture[] = [];

/**
 * Free the GPU copies (on 3D canvas unmount). The pixels stay with each
 * texture, so a material used again later simply re-uploads.
 */
export function disposeAllTextures(): void {
  for (const tex of managedTextures) {
    tex.dispose();
  }
  managedTextures.length = 0;
}

/** Re-upload every texture from its own pixels (after a WebGL context restore or tab return). */
export function restoreAllTextures(): void {
  for (const tex of managedTextures) {
    tex.needsUpdate = true;
  }
}

/**
 * A repeating texture from a finished procedural canvas. Rows are stored
 * bottom-up so it maps exactly as a CanvasTexture (flipY) of the same canvas
 * did; the canvas itself is no longer needed afterwards.
 */
function pixelTexture(canvas: HTMLCanvasElement, srgb: boolean): DataTexture | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = canvas;
  const src = ctx.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(src.length);
  const row = width * 4;
  for (let y = 0; y < height; y++) {
    data.set(src.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
  }
  const tex = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  if (srgb) tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  managedTextures.push(tex);
  return tex;
}

// ═══════════════════════════════════════════════════════════════════════════
// THREE.JS MATERIAL FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a realistic doug-fir 2×4 lumber material with procedural grain texture.
 */
export function createDougFirMaterial(seed = 42): MeshStandardMaterial {
  const canvas = createDougFirCanvas(512, 512, seed);
  if (!canvas) {
    return new MeshStandardMaterial({ color: new Color("#C8A96E"), roughness: 0.82, metalness: 0.0 });
  }
  const texture = pixelTexture(canvas, true);

  const bumpCanvas = createDougFirCanvas(256, 256, seed + 1);
  const bumpTexture = bumpCanvas ? pixelTexture(bumpCanvas, false) : null;

  return new MeshStandardMaterial({
    ...(texture ? { map: texture } : {}),
    ...(bumpTexture ? { bumpMap: bumpTexture, bumpScale: 0.3 } : {}),
    roughness: 0.78,
    metalness: 0.0,
    color: new Color("#E8D4A8"),
  });
}

export function createConstructionLumberMaterial(seed = 42): MeshStandardMaterial {
  const canvas = createConstructionLumberCanvas(512, 512, seed);
  if (!canvas) {
    return new MeshStandardMaterial({ color: new Color("#E2D1A8"), roughness: 0.75, metalness: 0.0 });
  }
  const texture = pixelTexture(canvas, true);

  const bumpCanvas = createConstructionLumberCanvas(256, 256, seed + 1);
  const bumpTexture = bumpCanvas ? pixelTexture(bumpCanvas, false) : null;

  return new MeshStandardMaterial({
    ...(texture ? { map: texture } : {}),
    ...(bumpTexture ? { bumpMap: bumpTexture, bumpScale: 0.15 } : {}),
    roughness: 0.72,
    metalness: 0.0,
    color: new Color("#F0E4C8"),
  });
}

/**
 * Creates a realistic plywood material with procedural texture.
 */
export function createPlywoodMaterial(seed = 137): MeshStandardMaterial {
  const canvas = createPlywoodCanvas(512, 512, seed);
  if (!canvas) {
    return new MeshStandardMaterial({ color: new Color("#A8884E"), roughness: 0.6, metalness: 0.0 });
  }
  const texture = pixelTexture(canvas, true);

  return new MeshStandardMaterial({
    ...(texture ? { map: texture } : {}),
    roughness: 0.55,
    metalness: 0.0,
    color: new Color("#E0C898"),
  });
}

/**
 * Creates a plywood top surface material (slightly lighter, smoother finish).
 */
export function createPlywoodTopMaterial(seed = 250): MeshStandardMaterial {
  const canvas = createPlywoodCanvas(512, 512, seed);
  if (!canvas) {
    return new MeshStandardMaterial({ color: new Color("#D4B896"), roughness: 0.5, metalness: 0.0 });
  }
  const texture = pixelTexture(canvas, true);

  return new MeshStandardMaterial({
    ...(texture ? { map: texture } : {}),
    roughness: 0.5,
    metalness: 0.0,
    color: new Color("#EAD8B0"),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PAINTED MATERIAL — Solid color with subtle surface texture
// ═══════════════════════════════════════════════════════════════════════════

const paintMaterialCache = new Map<string, MeshStandardMaterial>();

/**
 * Creates a painted wood material — solid color with subtle roughness variation
 * to look like a spray-painted or brush-painted wood surface.
 */
export function createPaintedMaterial(hexColor: string): MeshStandardMaterial {
  const cached = paintMaterialCache.get(hexColor);
  if (cached) return cached;

  const mat = new MeshStandardMaterial({
    color: new Color(hexColor),
    roughness: 0.45,
    metalness: 0.02,
  });
  paintMaterialCache.set(hexColor, mat);
  return mat;
}
