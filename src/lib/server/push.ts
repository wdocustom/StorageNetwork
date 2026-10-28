import "server-only";

import webpush from "web-push";
import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Installer push notifications (standard Web Push, VAPID).
//
// Devices subscribe from the dashboard (Settings → Notifications or the
// Today prompt); public/sw.js shows the notification and opens `url` on tap.
// Works on Android Chrome and on iPhone once the app is on the Home Screen.
//
// Env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (mailto:… or https://…). Without them every send is a quiet no-op, so
// callers never need to check.
// ═══════════════════════════════════════════════════════════════════════════

export interface PushMessage {
  title: string;
  body: string;
  /** Dashboard path opened on tap */
  url: string;
  /** Same tag replaces an earlier notification instead of stacking */
  tag?: string;
}

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@storage-network.app", pub, priv);
  configured = true;
  return true;
}

/** Send to every device the installer turned notifications on for. Never throws. */
export async function pushToUser(userId: string | null | undefined, msg: PushMessage): Promise<void> {
  if (!userId || !configure()) return;
  const db = getServiceClient();
  try {
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (!subs?.length) return;

    const payload = JSON.stringify(msg);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
            payload,
            { TTL: 60 * 60 * 24 },
          );
          await db.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("id", s.id);
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // 404/410: the browser dropped this subscription — forget it.
          if (status === 404 || status === 410) {
            await db.from("push_subscriptions").delete().eq("id", s.id);
          } else {
            console.error("[Push] send failed:", status, (err as Error).message);
          }
        }
      }),
    );
  } catch (err) {
    console.error("[Push] pushToUser failed:", err);
  }
}

/** For callers that only know the installer's email (the alert emails). */
export async function pushToEmail(email: string | null | undefined, msg: PushMessage): Promise<void> {
  if (!email || !configure()) return;
  const { data } = await getServiceClient()
    .from("profiles")
    .select("id")
    .eq("email", email.trim().toLowerCase()) // profile emails are stored lowercase
    .limit(1)
    .maybeSingle();
  await pushToUser(data?.id as string | undefined, msg);
}
