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
 * Server-side wrapper for generateBuildManifest.
 *
 * The earlier version threw when a quote mixed tote-organizer units with
 * open-shelving units ("can't share a build"). That guard contradicted the
 * actual engine — `buildEngine.ts:300` explicitly routes shelving parts
 * into the same allParts pool as tote-organizer parts so the FFD bin
 * packer can share boards and carry offcuts across both. The validation
 * was killing the manifest for any quote with both types, which made
 * `<JobTicket>` render with no Cut Plan section at all (Allison Anderson
 * job: 3 tote racks + 1 open shelving → throw → buildManifest=null →
 * silent missing cut list).
 *
 * `cut_plan_visuals` (tote racks), `shelving_cut_plans`, and
 * `overhead_cut_plans` live on separate arrays in the manifest and are
 * rendered separately in JobTicket, so a mixed quote produces independent
 * cut-plan sections for each unit type — no overlap, no contamination.
 */
export async function generateBuildManifestServer(
  quoteData: QuoteUnit[],
  customDepositRate?: number,
): Promise<BuildManifest> {
  const expanded = expandPresetUnits(quoteData);
  return generateBuildManifest(expanded, customDepositRate);
}
