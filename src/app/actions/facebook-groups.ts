"use server";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Facebook Groups — CRUD for installer's saved Facebook groups
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

export interface SavedFacebookGroup {
  id: string;
  installer_id: string;
  group_name: string;
  group_url: string;
  created_at: string;
}

/** Fetch all saved groups for an installer */
export async function getSavedFacebookGroups(
  installerId: string
): Promise<SavedFacebookGroup[]> {
  const { data, error } = await supabase
    .from("saved_facebook_groups")
    .select("*")
    .eq("installer_id", installerId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SavedFacebookGroup[];
}

/** Add a new Facebook group */
export async function addFacebookGroup(
  installerId: string,
  groupName: string,
  groupUrl: string
): Promise<SavedFacebookGroup> {
  const { data, error } = await supabase
    .from("saved_facebook_groups")
    .insert({ installer_id: installerId, group_name: groupName.trim(), group_url: groupUrl.trim() })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as SavedFacebookGroup;
}

/** Remove a saved Facebook group */
export async function removeFacebookGroup(
  installerId: string,
  groupId: string
): Promise<void> {
  const { error } = await supabase
    .from("saved_facebook_groups")
    .delete()
    .eq("id", groupId)
    .eq("installer_id", installerId);

  if (error) throw new Error(error.message);
}
