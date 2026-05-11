#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Re-encodes the heavy assets under /public.
//
// Two modes per entry:
//   format: "webp" — writes a sibling .webp; .png will be deleted afterwards
//                    by the JSX migration. Use for marketing imagery where
//                    next/image is the only consumer.
//   format: "png"  — recompresses (and optionally resizes) the .png IN PLACE.
//                    Use for assets that are also fetched by email clients
//                    or social-card crawlers (og:image, logos in email HTML).
//
// Run from repo root:
//   node scripts/optimize-public-images.mjs
// ─────────────────────────────────────────────────────────────────────────────
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public");

/** @type {Array<{src: string, format: "webp"|"png", maxWidth?: number, quality?: number}>} */
const TARGETS = [
  // Hero — homepage LCP. Resize down (2942px is overkill for a hero) and
  // re-encode as WebP. next/image will derive AVIF for capable browsers.
  { src: "hero-rack.png", format: "webp", maxWidth: 1920, quality: 80 },

  // Feature row on /features. All shipped to WebP.
  { src: "feature-community.png",    format: "webp", maxWidth: 1080, quality: 80 },
  { src: "feature-marketing.png",    format: "webp", maxWidth: 1080, quality: 80 },
  { src: "feature-booking.png",      format: "webp", maxWidth: 1080, quality: 80 },
  { src: "feature-configurator.png", format: "webp", maxWidth: 1080, quality: 80 },
  { src: "feature-cutplan.png",      format: "webp", maxWidth: 1080, quality: 80 },
  { src: "feature-payment.png",      format: "webp", maxWidth: 1080, quality: 80 },

  // PlatformShowcase + partner/join + join + locked-blueprints-teaser previews.
  { src: "images/dashboard-preview.png",        format: "webp", maxWidth: 1600, quality: 80 },
  { src: "images/designer-preview.png",         format: "webp", maxWidth: 1600, quality: 80 },
  { src: "images/3d-visualizer-preview.png",    format: "webp", maxWidth: 1600, quality: 80 },
  { src: "images/ai-script-generator-preview.png", format: "webp", maxWidth: 1600, quality: 80 },
  { src: "images/custom-pricing-preview.png",   format: "webp", maxWidth: 1600, quality: 80 },
  { src: "images/example-cut-plan.png",         format: "webp", maxWidth: 1600, quality: 80 },
  { src: "images/example-material-list.png",    format: "webp", maxWidth: 1600, quality: 80 },

  // Used in email announcement HTML — stays PNG. Just recompress at the
  // size mail clients actually display.
  { src: "images/Overhead-Storage-2.png", format: "png", maxWidth: 800, quality: 80 },

  // Used as og:image AND in email shells AND in next/image JSX. Stays PNG
  // for crawler/mail-client compatibility; resize to the actual display
  // size (≤512px), which already kills most of the bytes.
  { src: "landing_page_logo.png",   format: "png", maxWidth: 512, quality: 80 },
  { src: "logo-storage-network.png", format: "png", maxWidth: 512, quality: 80 },
];

let totalBefore = 0;
let totalAfter = 0;

for (const t of TARGETS) {
  const absIn = path.join(ROOT, t.src);
  let inputBuf;
  try {
    inputBuf = await fs.readFile(absIn);
  } catch (err) {
    console.warn(`skip — missing ${t.src}: ${err.message}`);
    continue;
  }
  const beforeBytes = inputBuf.length;
  totalBefore += beforeBytes;

  let pipeline = sharp(inputBuf, { failOn: "none" });
  const meta = await pipeline.metadata();
  if (t.maxWidth && meta.width && meta.width > t.maxWidth) {
    pipeline = pipeline.resize({ width: t.maxWidth, withoutEnlargement: true });
  }

  let outBuf;
  let outPath;
  if (t.format === "webp") {
    outBuf = await pipeline.webp({ quality: t.quality ?? 80, effort: 5 }).toBuffer();
    outPath = absIn.replace(/\.png$/i, ".webp").replace(/\.jpg$/i, ".webp").replace(/\.jpeg$/i, ".webp");
  } else {
    // PNG with palette quantization for serious size reduction on UI graphics.
    outBuf = await pipeline.png({ quality: t.quality ?? 80, compressionLevel: 9, palette: true }).toBuffer();
    outPath = absIn;
  }

  await fs.writeFile(outPath, outBuf);
  totalAfter += outBuf.length;
  const ratio = ((1 - outBuf.length / beforeBytes) * 100).toFixed(0);
  console.log(`${t.src} → ${path.relative(ROOT, outPath)}  ${beforeBytes} → ${outBuf.length} bytes  (-${ratio}%)`);
}

console.log("─".repeat(72));
console.log(`Total before: ${(totalBefore / 1024).toFixed(0)} KB`);
console.log(`Total after:  ${(totalAfter / 1024).toFixed(0)} KB`);
console.log(`Savings:      ${((1 - totalAfter / totalBefore) * 100).toFixed(0)}%`);
