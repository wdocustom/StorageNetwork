"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";

export interface InstallerReferralProfile {
  id: string;
  email: string | null;
  business_name: string | null;
  first_name: string | null;
  last_name: string | null;
  service_zip: string | null;
  slug: string | null;
  ref_slug: string | null;
  is_pro: boolean;
  completed_jobs: number;
}

export interface AdminProfileInfo {
  id: string;
  slug: string | null;
  ref_slug: string | null;
  business_name: string | null;
}

async function requireAdmin(): Promise<string> {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Not authenticated");
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!data?.is_admin) throw new Error("Admin access required");
  return user.id;
}

export async function getAdminProfileForReferrals(): Promise<{
  success: boolean;
  profile?: AdminProfileInfo;
  error?: string;
}> {
  try {
    const adminId = await requireAdmin();
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, slug, ref_slug, business_name")
      .eq("id", adminId)
      .single();
    if (!data) return { success: false, error: "Profile not found" };
    return { success: true, profile: data as AdminProfileInfo };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function searchInstallersForReferral(query: string): Promise<{
  success: boolean;
  installers?: InstallerReferralProfile[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const supabase = getServiceClient();
    const q = query.trim().toLowerCase();
    if (!q) return { success: true, installers: [] };

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, business_name, first_name, last_name, service_zip, slug, ref_slug, is_pro, completed_jobs")
      .or(`email.ilike.%${q}%,business_name.ilike.%${q}%,service_zip.eq.${q}`)
      .eq("is_suspended", false)
      .order("completed_jobs", { ascending: false })
      .limit(10);

    if (error) return { success: false, error: error.message };
    return { success: true, installers: (data ?? []) as InstallerReferralProfile[] };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
