"use server";

// ═══════════════════════════════════════════════════════════════════════════
// BUILD MANIFEST — Server action wrapper
// Keeps the proprietary build engine (bin-packing, cut-list generation,
// dimensional constants) off the client bundle.
// ═══════════════════════════════════════════════════════════════════════════

import { generateBuildManifest } from "@/lib/buildEngine";
import type { QuoteUnit, BuildManifest } from "@/lib/buildEngine.types";

/**
 * Server-side wrapper for generateBuildManifest.
 * Accepts the same arguments as the underlying engine function
 * but runs exclusively on the server.
 */
export async function generateBuildManifestServer(
  quoteData: QuoteUnit[],
  customDepositRate?: number,
): Promise<BuildManifest> {
  return generateBuildManifest(quoteData, customDepositRate);
}
