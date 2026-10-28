"use client";

import { useCallback, useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions/push";

// Installer push notifications on this device (see @/lib/server/push).
//
//   not-configured the app was built without the public VAPID key (set it in
//                  Vercel, then redeploy — it's baked in at build time)
//   unsupported    this browser can't do Web Push
//   needs-install  iPhone/iPad in a browser tab — iOS only delivers push to an
//                  app added to the Home Screen
//   denied         the installer blocked notifications in browser settings
//   off / on       ready to turn on / turned on for this device

export type PushState = "loading" | "not-configured" | "unsupported" | "needs-install" | "denied" | "off" | "on";

/** What happened when the installer tried to turn notifications on. */
export type EnableResult = { ok: true; testSent: boolean } | { ok: false; error: string };

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim().replace(/^["']|["']$/g, "");

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const browserCan = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!browserCan) {
        setState(isIOS() && !isStandalone() ? "needs-install" : "unsupported");
        return;
      }
      if (!VAPID_PUBLIC_KEY) return setState("not-configured");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = useCallback(async (): Promise<EnableResult> => {
    if (!VAPID_PUBLIC_KEY) return { ok: false, error: "Notifications aren't set up on the app yet." };
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return {
          ok: false,
          error:
            permission === "denied"
              ? "Notifications are blocked for this site — allow them in your browser's site settings."
              : "Notifications weren't allowed. Tap Turn on again and choose Allow.",
        };
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const saved = await savePushSubscription(json, navigator.userAgent);
      if (!saved.success) return { ok: false, error: saved.error ?? "Couldn't save this device. Try again." };
      setState("on");
      const test = await sendTestPush().catch(() => null);
      return { ok: true, testSent: !!test?.success };
    } catch (err) {
      console.error("[Push] enable failed:", err);
      return { ok: false, error: `Couldn't turn on notifications: ${(err as Error)?.message || "unknown error"}` };
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }, []);

  /** Re-send the test notification to this installer's devices. */
  const test = useCallback(async () => {
    const r = await sendTestPush().catch(() => null);
    if (!r) return "Couldn't reach the server. Try again.";
    if (!r.configured) return "The server's notification keys aren't set — add them in Vercel and redeploy.";
    if (r.sent === 0) return "No device accepted it. Turn notifications off and on again on this device.";
    return null;
  }, []);

  return { state, busy, enable, disable, test };
}
