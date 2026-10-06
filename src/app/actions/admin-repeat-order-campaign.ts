"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { runRepeatOrderCampaign, type CampaignRunResult } from "@/lib/server/repeat-order-campaign";

// Admin-only controls for the one-time repeat-order marketing email.
// Same actions as /api/cron/repeat-order-campaign, but behind the logged-in
// admin session so no secret needs to be typed or pasted anywhere.

async function requireAdmin(): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Not authenticated");
  const { data } = await getServiceClient()
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!data?.is_admin) throw new Error("Admin access required");
}

export async function isRepeatOrderCampaignAdmin(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

export async function runRepeatOrderCampaignAdmin(input: {
  mode: "dry-run" | "test" | "send";
  testTo?: string;
  limit?: number;
}): Promise<{ success: true; result: CampaignRunResult } | { success: false; error: string }> {
  try {
    await requireAdmin();

    if (input.mode === "test") {
      const to = input.testTo?.trim() || "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return { success: false, error: "Enter a valid email address to send the test to." };
      }
      return { success: true, result: await runRepeatOrderCampaign({ send: false, limit: 1, testTo: to }) };
    }

    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 5) || 5, 1), 200);
    return {
      success: true,
      result: await runRepeatOrderCampaign({ send: input.mode === "send", limit }),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
