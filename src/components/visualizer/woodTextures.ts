/**
 * woodTextures.ts — Procedural wood grain textures for realistic lumber rendering.
 *
 * Generates Canvas-based textures that mimic:
 *   - Doug-fir 2×4 construction lumber (warm honey tones, pronounced grain)
 *   - Construction-grade plywood (layered cross-grain with visible plies)
 *
 * Used by Rack3D.tsx and AssemblyGuide.tsx for Three.js materials,
 * and by BlueprintCanvas.tsx for 2D canvas patterns.
 */

import {
  CanvasTexture,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Color,
} from "three";

// ═══════════════════════════════════════════════════════════════════════════
// TEXTURE PERSISTENCE — survive browser canvas GC during tab inactivity
//
// Browsers can reclaim the pixel buffer of detached (offscreen) canvases
// to free memory when a tab is backgrounded. When Three.js re-renders,
// it reads zeroed-out data → everything turns black.
//
// Fix: After generating a procedural canvas texture, immediately snapshot
// the pixel data as ImageData. On WebGL context restore (or periodic
// integrity checks), we can repaint the canvas from the snapshot.
// ═══════════════════════════════════════════════════════════════════════════

/** Store pixel snapshots keyed by the canvas element */
const textureSnapshots = new Map<HTMLCanvasElement, ImageData>();

/**
 * Snapshot a procedural canvas's pixel data so it survives browser GC.
 * Call this immediately after drawing the canvas.
 */
function snapshotCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  textureSnapshots.set(canvas, imageData);
}

/**
 * Restore a canvas from its snapshot if the browser cleared it.
 * Returns true if restoration was needed.
 */
function restoreCanvasIfNeeded(canvas: HTMLCanvasElement): boolean {
  const snapshot = textureSnapshots.get(canvas);
  if (!snapshot) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  // Check if canvas data has been zeroed out by reading a few pixels
  const probe = ctx.getImageData(0, 0, 1, 1).data;
  // If alpha is 0 at origin but snapshot has data, canvas was cleared
  if (probe[3] === 0 && snapshot.data[3] !== 0) {
    ctx.putImageData(snapshot, 0, 0);
    return true;
  }
  return false;
}

/** All canvas-backed textures that need restoration after context loss */
const managedTextures: CanvasTexture[] = [];

/**
 * Dispose all managed textures and clear caches. Called on 3D canvas
 * unmount to free GPU memory and prevent leaks on SPA navigation.
 */
export function disposeAllTextures(): void {
  for (const tex of managedTextures) {
    tex.dispose();
  }
  managedTextures.length = 0;
  textureSnapshots.clear();
}

/**
 * Restore all managed textures after WebGL context loss or browser
 * canvas GC. Called from Rack3D's context-restore handler.
 */
export function restoreAllTextures(): void {
  for (const tex of managedTextures) {
    const canvas = tex.image as HTMLCanvasElement;
    if (canvas && restoreCanvasIfNeeded(canvas)) {
      tex.needsUpdate = true;
    }
  }
}

/** Register a canvas texture for lifecycle management */
function trackTexture(texture: CanvasTexture, canvas: HTMLCanvasElement): void {
  snapshotCanvas(canvas);
  managedTextures.push(texture);
}

// ═══════════════════════════════════════════════════════════════════════════
// SEEDED RANDOM — deterministic noise for consistent textures across renders
// ═══════════════════════════════════════════════════════════════════════════

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DOUG-FIR 2×4 TEXTURE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a procedural doug-fir lumber texture canvas.
 * Realistic warm honey-amber base with dark grain lines, subtle heartwood
 * variation, and occasional small knots typical of #2 construction grade.
 */
export function createDougFirCanvas(
  width = 512,
  height = 512,
  seed = 42,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const rand = seededRandom(seed);

  // Base color — light doug-fir heartwood (pale honey)
  ctx.fillStyle = "#D4B87A";
  ctx.fillRect(0, 0, width, height);

  // Subtle heartwood color variation (wider warm/cool bands)
  for (let i = 0; i < 6; i++) {
    const y = rand() * height;
    const bandH = 40 + rand() * 100;
    const hue = rand() > 0.5 ? "rgba(190, 160, 100," : "rgba(215, 190, 130,";
    const grad = ctx.createLinearGradient(0, y, 0, y + bandH);
    grad.addColorStop(0, hue + "0)");
    grad.addColorStop(0.5, hue + "0.15)");
    grad.addColorStop(1, hue + "0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, width, bandH);
  }

  // Primary grain lines — long, slightly wavy, running along the length
  for (let i = 0; i < 60; i++) {
    const baseY = (i / 60) * height + (rand() - 0.5) * 12;
    const darkness = 0.08 + rand() * 0.18;
    const lineWidth = 0.5 + rand() * 2.0;

    ctx.beginPath();
    ctx.moveTo(0, baseY);

    // Wavy grain path
    for (let x = 0; x <= width; x += 8) {
      const wave = Math.sin(x * 0.008 + rand() * 6) * (2 + rand() * 5);
      const jitter = (rand() - 0.5) * 1.5;
      ctx.lineTo(x, baseY + wave + jitter);
    }

    ctx.strokeStyle = `rgba(90, 55, 20, ${darkness})`;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  // Secondary fine grain — tighter, thinner lines between primary grain
  for (let i = 0; i < 120; i++) {
    const baseY = rand() * height;
    const darkness = 0.04 + rand() * 0.08;

    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= width; x += 12) {
      const wave = Math.sin(x * 0.012 + rand() * 10) * (1 + rand() * 2);
      ctx.lineTo(x, baseY + wave);
    }
    ctx.strokeStyle = `rgba(100, 65, 25, ${darkness})`;
    ctx.lineWidth = 0.3 + rand() * 0.6;
    ctx.stroke();
  }

  // Earlywood / latewood annual ring banding (subtle light/dark stripes)
  for (let i = 0; i < 12; i++) {
    const y = (i / 12) * height + rand() * 30;
    const bandH = 8 + rand() * 20;
    // Latewood is darker and denser
    const isLatewood = rand() > 0.4;
    const alpha = isLatewood ? 0.06 + rand() * 0.1 : 0.03 + rand() * 0.05;
    const color = isLatewood ? "70, 40, 15" : "220, 180, 120";

    ctx.fillStyle = `rgba(${color}, ${alpha})`;
    ctx.fillRect(0, y, width, bandH);
  }

  // Small knots (2-4 per board, typical of #2 grade doug-fir)
  const numKnots = 2 + Math.floor(rand() * 3);
  for (let k = 0; k < numKnots; k++) {
    const kx = 60 + rand() * (width - 120);
    const ky = 60 + rand() * (height - 120);
    const kr = 6 + rand() * 14;

    // Dark knot center
    const knotGrad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
    knotGrad.addColorStop(0, "rgba(60, 35, 15, 0.7)");
    knotGrad.addColorStop(0.4, "rgba(80, 50, 25, 0.5)");
    knotGrad.addColorStop(0.7, "rgba(120, 75, 35, 0.25)");
    knotGrad.addColorStop(1, "rgba(160, 110, 60, 0)");

    ctx.beginPath();
    ctx.ellipse(kx, ky, kr, kr * (0.7 + rand() * 0.3), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = knotGrad;
    ctx.fill();

    // Ring lines around knot
    for (let ring = 0; ring < 4; ring++) {
      const rr = kr * (0.3 + ring * 0.2) + rand() * 2;
      ctx.beginPath();
      ctx.ellipse(kx, ky, rr, rr * (0.6 + rand() * 0.3), rand() * 0.3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(70, 40, 18, ${0.15 + rand() * 0.15})`;
      ctx.lineWidth = 0.5 + rand() * 0.8;
      ctx.stroke();
    }
  }

  // Surface roughness noise — fine speckle
  for (let i = 0; i < 3000; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const bright = rand() > 0.5;
    ctx.fillStyle = bright
      ? `rgba(230, 200, 150, ${0.03 + rand() * 0.06})`
      : `rgba(80, 50, 20, ${0.02 + rand() * 0.05})`;
    ctx.fillRect(x, y, 1 + rand() * 2, 1);
  }

  return canvas;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLYWOOD TEXTURE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a procedural plywood texture canvas.
 * Shows visible ply layers, cross-grain pattern, and the characteristic
 * patchwork of veneer sheets with slightly different tones.
 */
export function createPlywoodCanvas(
  width = 512,
  height = 512,
  seed = 137,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const rand = seededRandom(seed);

  // Base — lighter birch/pine veneer typical of construction ply
  ctx.fillStyle = "#CCBA84";
  ctx.fillRect(0, 0, width, height);

  // Veneer sheet patches — plywood face has glued veneer sheets with
  // slightly different tones. Divide into 2-3 horizontal bands.
  const numPatches = 2 + Math.floor(rand() * 2);
  let patchY = 0;
  for (let p = 0; p < numPatches; p++) {
    const patchH = height / numPatches + (rand() - 0.5) * 40;
    const toneShift = (rand() - 0.5) * 30;
    const r = Math.min(255, Math.max(0, 191 + toneShift));
    const g = Math.min(255, Math.max(0, 160 + toneShift * 0.8));
    const b = Math.min(255, Math.max(0, 106 + toneShift * 0.5));
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
    ctx.fillRect(0, patchY, width, patchH);

    // Seam line between veneer sheets
    if (p > 0) {
      ctx.beginPath();
      ctx.moveTo(0, patchY);
      for (let x = 0; x <= width; x += 20) {
        ctx.lineTo(x, patchY + (rand() - 0.5) * 1.5);
      }
      ctx.strokeStyle = `rgba(100, 70, 35, 0.25)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    patchY += patchH;
  }

  // Face grain — horizontal lines (face veneer grain runs one direction)
  for (let i = 0; i < 80; i++) {
    const baseY = (i / 80) * height + (rand() - 0.5) * 8;
    const darkness = 0.05 + rand() * 0.12;

    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= width; x += 10) {
      const wave = Math.sin(x * 0.006 + rand() * 8) * (1.5 + rand() * 3);
      ctx.lineTo(x, baseY + wave);
    }
    ctx.strokeStyle = `rgba(110, 75, 30, ${darkness})`;
    ctx.lineWidth = 0.4 + rand() * 1.2;
    ctx.stroke();
  }

  // Cross-grain hints — faint perpendicular lines showing inner ply layers
  // bleeding through the face (common on construction grade ply)
  for (let i = 0; i < 25; i++) {
    const baseX = rand() * width;
    ctx.beginPath();
    ctx.moveTo(baseX, 0);
    for (let y = 0; y <= height; y += 15) {
      const wave = Math.sin(y * 0.01 + rand() * 6) * 2;
      ctx.lineTo(baseX + wave, y);
    }
    ctx.strokeStyle = `rgba(130, 90, 45, ${0.03 + rand() * 0.06})`;
    ctx.lineWidth = 0.5 + rand() * 1;
    ctx.stroke();
  }

  // Surface texture noise — plywood has a slightly rougher surface
  for (let i = 0; i < 4000; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const bright = rand() > 0.5;
    ctx.fillStyle = bright
      ? `rgba(220, 190, 140, ${0.03 + rand() * 0.05})`
      : `rgba(90, 60, 25, ${0.02 + rand() * 0.04})`;
    ctx.fillRect(x, y, 1 + rand(), 1 + rand());
  }

  // Occasional small voids/defects typical of CDX ply
  for (let i = 0; i < 3; i++) {
    const dx = 40 + rand() * (width - 80);
    const dy = 40 + rand() * (height - 80);
    const dw = 3 + rand() * 8;
    const dh = 1 + rand() * 3;
    ctx.fillStyle = `rgba(80, 55, 25, ${0.15 + rand() * 0.15})`;
    ctx.fillRect(dx, dy, dw, dh);
  }

  return canvas;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLYWOOD EDGE TEXTURE (cross-section showing laminated layers)
// ═══════════════════════════════════════════════════════════════════════════

export function createPlywoodEdgeCanvas(
  width = 256,
  height = 64,
  seed = 200,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const rand = seededRandom(seed);

  // Base
  ctx.fillStyle = "#C8AA72";
  ctx.fillRect(0, 0, width, height);

  // Alternating ply layers (typically 5-7 for 3/4" plywood)
  const numPlies = 5 + Math.floor(rand() * 3);
  const plyH = height / numPlies;
  for (let p = 0; p < numPlies; p++) {
    const y = p * plyH;
    const isOdd = p % 2 === 1;
    // Alternate grain direction (odd plies are cross-grain, appear slightly different)
    const toneShift = isOdd ? 15 : -10;
    const r = 175 + toneShift + rand() * 15;
    const g = 140 + toneShift * 0.7 + rand() * 10;
    const b = 80 + toneShift * 0.3 + rand() * 8;
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, y, width, plyH);

    // Glue line between plies
    if (p > 0) {
      ctx.fillStyle = `rgba(120, 80, 30, ${0.3 + rand() * 0.2})`;
      ctx.fillRect(0, y - 0.5, width, 1);
    }

    // Grain lines in each ply (horizontal for face, vertical dots for cross)
    if (isOdd) {
      // Cross-grain ply: small dots/dashes (end grain view)
      for (let d = 0; d < 60; d++) {
        const dx = rand() * width;
        const dy = y + rand() * plyH;
        ctx.fillStyle = `rgba(100, 65, 25, ${0.1 + rand() * 0.15})`;
        ctx.fillRect(dx, dy, 1, 1);
      }
    } else {
      // Face grain ply: horizontal lines
      for (let l = 0; l < 6; l++) {
        const ly = y + (l / 6) * plyH + rand() * 2;
        ctx.beginPath();
        ctx.moveTo(0, ly);
        for (let x = 0; x <= width; x += 8) {
          ctx.lineTo(x, ly + (rand() - 0.5) * 1);
        }
        ctx.strokeStyle = `rgba(100, 65, 25, ${0.08 + rand() * 0.1})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  return canvas;
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
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  trackTexture(texture, canvas);

  const bumpCanvas = createDougFirCanvas(256, 256, seed + 1);
  const bumpTexture = bumpCanvas ? new CanvasTexture(bumpCanvas) : null;
  if (bumpTexture) {
    bumpTexture.wrapS = RepeatWrapping;
    bumpTexture.wrapT = RepeatWrapping;
    trackTexture(bumpTexture, bumpCanvas!);
  }

  return new MeshStandardMaterial({
    map: texture,
    ...(bumpTexture ? { bumpMap: bumpTexture, bumpScale: 0.3 } : {}),
    roughness: 0.78,
    metalness: 0.0,
    color: new Color("#E8D4A8"),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION LUMBER TEXTURE — clean, straight grain like dimensional pine/fir
// ═══════════════════════════════════════════════════════════════════════════

export function createConstructionLumberCanvas(
  width = 512,
  height = 512,
  seed = 42,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const rand = seededRandom(seed);

  // Pale pine/fir base — lighter than doug fir
  ctx.fillStyle = "#E2D1A8";
  ctx.fillRect(0, 0, width, height);

  // Subtle warm/cool banding (very gentle)
  for (let i = 0; i < 4; i++) {
    const y = rand() * height;
    const bandH = 60 + rand() * 120;
    const warm = rand() > 0.5;
    const color = warm ? "210, 185, 140" : "225, 205, 165";
    const grad = ctx.createLinearGradient(0, y, 0, y + bandH);
    grad.addColorStop(0, `rgba(${color}, 0)`);
    grad.addColorStop(0.5, `rgba(${color}, 0.12)`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, width, bandH);
  }

  // Straight grain lines — long, mostly parallel, minimal wave
  for (let i = 0; i < 35; i++) {
    const baseY = (i / 35) * height + (rand() - 0.5) * 8;
    const darkness = 0.05 + rand() * 0.12;
    const lineWidth = 0.4 + rand() * 1.2;

    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= width; x += 16) {
      const wave = Math.sin(x * 0.003 + rand() * 6) * (0.5 + rand() * 1.5);
      ctx.lineTo(x, baseY + wave);
    }
    ctx.strokeStyle = `rgba(160, 120, 60, ${darkness})`;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  // Fine secondary grain — very subtle
  for (let i = 0; i < 50; i++) {
    const baseY = rand() * height;
    const darkness = 0.02 + rand() * 0.05;

    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= width; x += 20) {
      const wave = Math.sin(x * 0.004 + rand() * 10) * (0.3 + rand() * 0.8);
      ctx.lineTo(x, baseY + wave);
    }
    ctx.strokeStyle = `rgba(170, 130, 70, ${darkness})`;
    ctx.lineWidth = 0.2 + rand() * 0.4;
    ctx.stroke();
  }

  // Latewood banding — very subtle
  for (let i = 0; i < 6; i++) {
    const y = (i / 6) * height + rand() * 40;
    const bandH = 6 + rand() * 14;
    const alpha = 0.02 + rand() * 0.05;
    ctx.fillStyle = `rgba(150, 110, 55, ${alpha})`;
    ctx.fillRect(0, y, width, bandH);
  }

  // Occasional small knot (0-2 per board)
  const numKnots = Math.floor(rand() * 2.5);
  for (let k = 0; k < numKnots; k++) {
    const kx = 80 + rand() * (width - 160);
    const ky = 80 + rand() * (height - 160);
    const kr = 4 + rand() * 8;

    const knotGrad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
    knotGrad.addColorStop(0, "rgba(100, 65, 30, 0.5)");
    knotGrad.addColorStop(0.5, "rgba(130, 90, 45, 0.3)");
    knotGrad.addColorStop(1, "rgba(180, 140, 80, 0)");

    ctx.beginPath();
    ctx.ellipse(kx, ky, kr, kr * (0.7 + rand() * 0.3), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = knotGrad;
    ctx.fill();

    for (let ring = 0; ring < 3; ring++) {
      const rr = kr * (0.3 + ring * 0.25) + rand() * 1.5;
      ctx.beginPath();
      ctx.ellipse(kx, ky, rr, rr * (0.6 + rand() * 0.3), rand() * 0.2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(120, 80, 35, ${0.08 + rand() * 0.1})`;
      ctx.lineWidth = 0.4 + rand() * 0.5;
      ctx.stroke();
    }
  }

  // Minimal surface noise
  for (let i = 0; i < 800; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const bright = rand() > 0.5;
    ctx.fillStyle = bright
      ? `rgba(240, 220, 180, ${0.02 + rand() * 0.04})`
      : `rgba(140, 100, 50, ${0.01 + rand() * 0.03})`;
    ctx.fillRect(x, y, 1 + rand(), 1);
  }

  return canvas;
}

export function createConstructionLumberMaterial(seed = 42): MeshStandardMaterial {
  const canvas = createConstructionLumberCanvas(512, 512, seed);
  if (!canvas) {
    return new MeshStandardMaterial({ color: new Color("#E2D1A8"), roughness: 0.75, metalness: 0.0 });
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  trackTexture(texture, canvas);

  const bumpCanvas = createConstructionLumberCanvas(256, 256, seed + 1);
  const bumpTexture = bumpCanvas ? new CanvasTexture(bumpCanvas) : null;
  if (bumpTexture) {
    bumpTexture.wrapS = RepeatWrapping;
    bumpTexture.wrapT = RepeatWrapping;
    trackTexture(bumpTexture, bumpCanvas!);
  }

  return new MeshStandardMaterial({
    map: texture,
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
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  trackTexture(texture, canvas);

  return new MeshStandardMaterial({
    map: texture,
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
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  trackTexture(texture, canvas);

  return new MeshStandardMaterial({
    map: texture,
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

// ═══════════════════════════════════════════════════════════════════════════
// 2D CANVAS PATTERN GENERATORS (for BlueprintCanvas)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a CanvasPattern for 2D wood grain rendering in the blueprint view.
 */
export function create2DWoodPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const canvas = createDougFirCanvas(128, 128, 42);
  if (!canvas) return null;
  return ctx.createPattern(canvas, "repeat");
}

/**
 * Creates a CanvasPattern for 2D plywood rendering in the blueprint view.
 */
export function create2DPlywoodPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const canvas = createPlywoodCanvas(128, 128, 137);
  if (!canvas) return null;
  return ctx.createPattern(canvas, "repeat");
}
