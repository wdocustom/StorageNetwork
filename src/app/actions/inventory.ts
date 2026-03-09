"use server";

import { getServiceClient } from "@/lib/supabase-server";
import {
  normalizeInventory,
  calculateInventoryAfterJob,
  type MaterialInventory,
  type RawJobNeeds,
} from "@/utils/inventoryManager";

// ═══════════════════════════════════════════════════════════════════════════
// Inventory — Server actions for reading and updating material inventory
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

/** Fetch the installer's current material inventory. */
export async function getInstallerInventory(
  installerId: string
): Promise<MaterialInventory> {
  const { data } = await supabase
    .from("profiles")
    .select("material_inventory")
    .eq("id", installerId)
    .single();

  return normalizeInventory(data?.material_inventory);
}

/**
 * Update inventory after a job is completed.
 * Calculates what was purchased and what remains, then persists.
 */
export async function updateInventoryAfterJob(
  installerId: string,
  rawJobNeeds: RawJobNeeds
): Promise<{ success: boolean; inventory: MaterialInventory }> {
  // Read current
  const current = await getInstallerInventory(installerId);

  // Calculate new state
  const updated = calculateInventoryAfterJob(rawJobNeeds, current);

  // Persist
  const { error } = await supabase
    .from("profiles")
    .update({ material_inventory: updated })
    .eq("id", installerId);

  if (error) {
    console.error("[Inventory] Update failed:", error);
    return { success: false, inventory: current };
  }

  return { success: true, inventory: updated };
}
