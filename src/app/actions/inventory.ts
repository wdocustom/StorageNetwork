"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  normalizeInventory,
  calculateInventoryAfterJob,
  EMPTY_INVENTORY,
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

// ═══════════════════════════════════════════════════════════════════════════
// Manual edit + reset — installer-facing, auth-gated.
//
// The auto-deduction system (updateInventoryAfterJob) runs from job
// completion and trusts its installerId argument. These two actions are
// called from the /dashboard/inventory page directly by the user, so they
// derive installerId from the authenticated session — installers can
// only ever overwrite their own inventory.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Overwrite the authenticated installer's inventory with the supplied
 * values. Inputs are normalized through the same path as auto-updates,
 * so out-of-range or malformed values get coerced rather than rejected.
 */
export async function setMyInventory(
  patch: Partial<MaterialInventory>
): Promise<{ success: boolean; inventory: MaterialInventory; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, inventory: { ...EMPTY_INVENTORY }, error: "Not authenticated." };
  }

  const current = await getInstallerInventory(user.id);
  const merged = normalizeInventory({ ...current, ...patch });

  const { error } = await supabase
    .from("profiles")
    .update({ material_inventory: merged })
    .eq("id", user.id);

  if (error) {
    console.error("[Inventory] setMyInventory failed:", error);
    return { success: false, inventory: current, error: "Could not save inventory." };
  }

  return { success: true, inventory: merged };
}

/**
 * Reset the authenticated installer's inventory to zero on every field.
 * Useful when the auto-deduction has drifted out of sync with reality
 * and the installer wants a clean slate.
 */
export async function clearMyInventory(): Promise<{
  success: boolean;
  inventory: MaterialInventory;
  error?: string;
}> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, inventory: { ...EMPTY_INVENTORY }, error: "Not authenticated." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ material_inventory: EMPTY_INVENTORY })
    .eq("id", user.id);

  if (error) {
    console.error("[Inventory] clearMyInventory failed:", error);
    return { success: false, inventory: await getInstallerInventory(user.id), error: "Could not clear inventory." };
  }

  return { success: true, inventory: { ...EMPTY_INVENTORY } };
}

