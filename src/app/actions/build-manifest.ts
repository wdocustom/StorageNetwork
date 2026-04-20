"use server";

// ═══════════════════════════════════════════════════════════════════════════
// BUILD MANIFEST — Server action wrapper
// Keeps the proprietary build engine (bin-packing, cut-list generation,
// dimensional constants) off the client bundle.
// ═══════════════════════════════════════════════════════════════════════════

import { generateBuildManifest } from "@/lib/buildEngine";
import { expandPresetUnits } from "@/lib/buildEngine.types";
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
