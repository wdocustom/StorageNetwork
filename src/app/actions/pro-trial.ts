"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { checkProTrial, type TrialStatus } from "@/lib/server/pro-trial";

// Trial rules live in @/lib/server/pro-trial (server-only). Only session-scoped or
// public-by-design checks are exposed as actions here.

const supabase = getServiceClient();

/** The signed-in installer's own trial status. */
export async function checkMyProTrial(): Promise<TrialStatus | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  return checkProTrial(user.id);
}

// ═══════════════════════════════════════════════════════════════════════════
// Public-Facing Capacity Check
//
// Lightweight check for the /design page (customer-facing configurator).
// Returns whether the installer has hit their trial job cap or is soft-locked,
// plus basic installer info needed for the waitlist email flow.
// Does NOT require auth — called from server components and client actions.
// ═══════════════════════════════════════════════════════════════════════════

export interface InstallerCapacityStatus {
  atCapacity: boolean;
  installerName: string | null;
  installerEmail: string | null;
}

export async function checkInstallerAtCapacity(
  installerId: string
): Promise<InstallerCapacityStatus> {
  const none: InstallerCapacityStatus = { atCapacity: false, installerName: null, installerEmail: null };
  if (!installerId) return none;

  try {
    // Fetch trial status
    const trial = await checkProTrial(installerId);
    const atCapacity = trial.softLocked || (trial.jobCapReached && trial.onTrial);

    if (!atCapacity) return none;

    // Fetch installer info for the waitlist email
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name, first_name, email")
      .eq("id", installerId)
      .single();

    return {
      atCapacity: true,
      installerName: profile?.business_name || profile?.first_name || null,
      installerEmail: profile?.email || null,
    };
  } catch {
    return none;
  }
}
