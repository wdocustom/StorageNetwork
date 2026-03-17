"use server";

// ═══════════════════════════════════════════════════════════════════════════
// BUILD MANIFEST — Server action wrapper
// Keeps the proprietary build engine (bin-packing, cut-list generation,
// dimensional constants) off the client bundle.
// ═══════════════════════════════════════════════════════════════════════════

import { generateBuildManifest } from "@/lib/buildEngine";
import type { QuoteUnit, BuildManifest } from "@/lib/buildEngine.types";

/**
 * Validate that a quote doesn't mix tote organizers with open shelving.
 * Shelving and totes require different frame structures and can't share a build.
 * Overhead ceiling storage CAN be mixed with tote organizers (different system).
 */
function validateQuoteUnits(units: QuoteUnit[]): void {
  const hasTotes = units.some((u) => !u.shelvingConfigId && !u.overheadGridPresetId && u.cols > 0 && u.rows > 0);
  const hasShelving = units.some((u) => !!u.shelvingConfigId);

  if (hasTotes && hasShelving) {
    throw new Error("Cannot mix tote organizers with open shelving in the same quote.");
  }
}

/**
 * Expand compound preset units (e.g. "The Gass Station" stored as a single
 * item with presetUnits) into individual QuoteUnit entries so the build
 * engine generates correct modules for each sub-unit.
 */
function expandPresetUnits(units: QuoteUnit[]): QuoteUnit[] {
  const expanded: QuoteUnit[] = [];
  for (const unit of units) {
    const presetUnits = (unit as Record<string, unknown>).presetUnits as
      | Array<{ cols: number; rows: number; totalW: number; totalH: number; hasTop: boolean; hasWheels: boolean }>
      | undefined;

    if (presetUnits && presetUnits.length > 1) {
      const totalSlots = presetUnits.reduce((s, u) => s + u.cols * u.rows, 0);
      for (const sub of presetUnits) {
        const subSlots = sub.cols * sub.rows;
        expanded.push({
          ...unit,
          cols: sub.cols,
          rows: sub.rows,
          totalW: sub.totalW,
          totalH: sub.totalH,
          hasTop: sub.hasTop,
          hasWheels: sub.hasWheels,
          price: Math.round((unit.price * subSlots / totalSlots) * 100) / 100,
          desc: `${unit.desc} — ${sub.cols}x${sub.rows}`,
        });
      }
    } else {
      expanded.push(unit);
    }
  }
  return expanded;
}

/**
 * Server-side wrapper for generateBuildManifest.
 * Accepts the same arguments as the underlying engine function
 * but runs exclusively on the server.
 */
export async function generateBuildManifestServer(
  quoteData: QuoteUnit[],
  customDepositRate?: number,
): Promise<BuildManifest> {
  const expanded = expandPresetUnits(quoteData);
  validateQuoteUnits(expanded);
  return generateBuildManifest(expanded, customDepositRate);
}
