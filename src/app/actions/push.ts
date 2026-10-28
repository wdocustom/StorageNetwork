"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { pushToUser } from "@/lib/server/push";

// Installer push subscriptions — always for the signed-in installer's own
// devices. Sending lives in @/lib/server/push.

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function savePushSubscription(
  sub: PushSubscriptionInput,
  userAgent?: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not signed in." };
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { success: false, error: "Invalid subscription." };
  }
  const { error } = await getServiceClient()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: userAgent?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" },
    );
  if (error) {
    console.error("[Push] save failed:", error.message);
    return { success: false, error: "Couldn't turn on notifications." };
  }
  return { success: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ success: boolean }> {
  const user = await getAuthenticatedUser();
  if (!user || !endpoint) return { success: false };
  await getServiceClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return { success: true };
}

export async function sendTestPush(): Promise<{ success: boolean }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false };
  await pushToUser(user.id, {
    title: "Notifications are on",
    body: "You'll hear about new bookings, payments and customers opening your quotes.",
    url: "/dashboard",
    tag: "test",
  });
  return { success: true };
}
