"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";

// Registers the calling installer's APNs / FCM device token. Native app only
// (the client never calls this on the web / PWA). Service client is used for
// the upsert because a token may move between accounts on a shared device;
// the user id always comes from the verified session, never from the client.
export async function registerDeviceToken(
  token: string,
  platform: "ios" | "android",
  appVersion?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (platform !== "ios" && platform !== "android") {
    return { success: false, error: "Invalid platform." };
  }
  if (!token || token.length > 4096) return { success: false, error: "Invalid token." };

  const { error } = await getServiceClient()
    .from("device_tokens")
    .upsert(
      {
        user_id: user.id,
        token,
        platform,
        app_version: appVersion ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );

  if (error) {
    console.error("[device-tokens] upsert failed:", error.message);
    return { success: false, error: "Could not register device." };
  }
  return { success: true };
}
