#!/usr/bin/env node
/**
 * Generate solid-color PNG splash screens for iOS PWA.
 * Pure Node.js — no external dependencies (uses built-in zlib).
 *
 * Color: #020617 (slate-950)
 *
 * Run: node scripts/generate-splash.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "splash");

// slate-950 = #020617 → RGB(2, 6, 23)
const R = 2, G = 6, B = 23;

// iOS device splash screen sizes (width × height in pixels)
// Covers iPhone SE through iPhone 16 Pro Max + iPads
const SIZES = [
  // iPhones (portrait)
  { w: 640,  h: 1136, name: "iphone5" },
  { w: 750,  h: 1334, name: "iphone6" },
  { w: 1242, h: 2208, name: "iphone6plus" },
  { w: 1125, h: 2436, name: "iphonex" },
  { w: 828,  h: 1792, name: "iphonexr" },
  { w: 1242, h: 2688, name: "iphonexsmax" },
  { w: 1080, h: 2340, name: "iphone12mini" },
  { w: 1170, h: 2532, name: "iphone12" },
  { w: 1284, h: 2778, name: "iphone12promax" },
  { w: 1179, h: 2556, name: "iphone14pro" },
  { w: 1290, h: 2796, name: "iphone14promax" },
  { w: 1206, h: 2622, name: "iphone16pro" },
  { w: 1320, h: 2868, name: "iphone16promax" },
  // iPads (portrait)
  { w: 1536, h: 2048, name: "ipad" },
  { w: 1668, h: 2224, name: "ipadpro105" },
  { w: 1668, h: 2388, name: "ipadpro11" },
  { w: 2048, h: 2732, name: "ipadpro129" },
];

/**
 * Create a minimal valid PNG file with a solid color.
 *
 * PNG structure:
 *   - 8-byte signature
 *   - IHDR chunk (image header)
 *   - IDAT chunk (compressed image data)
 *   - IEND chunk (image end)
 *
 * We use indexed color (palette) mode to keep file sizes tiny:
 *   - 1 palette entry = our dark color
 *   - Every pixel = index 0
 *   - With deflate compression, this compresses extremely well
 */
function createSolidPNG(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // ── IHDR ──
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 3;  // color type: indexed
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk("IHDR", ihdrData);

  // ── PLTE (palette: single entry) ──
  const plteData = Buffer.from([r, g, b]);
  const plte = makeChunk("PLTE", plteData);

  // ── IDAT (image data) ──
  // Each row = 1 filter byte (0 = None) + width bytes (all 0 = palette index 0)
  const rowSize = 1 + width;
  const raw = Buffer.alloc(rowSize * height); // pre-filled with 0s — perfect
  const compressed = deflateSync(raw, { level: 9 });
  const idat = makeChunk("IDAT", compressed);

  // ── IEND ──
  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, plte, idat, iend]);
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuf]);
}

// CRC-32 (used by PNG)
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── Generate ──
mkdirSync(OUT_DIR, { recursive: true });

for (const { w, h, name } of SIZES) {
  const png = createSolidPNG(w, h, R, G, B);
  const path = join(OUT_DIR, `${name}_${w}x${h}.png`);
  writeFileSync(path, png);
  const kb = (png.length / 1024).toFixed(1);
  console.log(`  ✓ ${name} (${w}×${h}) — ${kb} KB`);
}

console.log(`\nDone. ${SIZES.length} splash images written to public/splash/`);
