"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// ═══════════════════════════════════════════════════════════════════════════
// PlatformTracker — Fires a page view event for every navigation.
//
// Placed in the root layout. Tracks every page across the entire platform.
// Uses localStorage for persistent visitor ID and sessionStorage for
// session ID. Sends data to /api/analytics/track via sendBeacon/fetch.
//
// Bot traffic is still recorded (flagged is_bot=true) so admins can
// see the ratio, but it's filtered out of the main analytics view.
// ═══════════════════════════════════════════════════════════════════════════

function getOrCreateId(storage: Storage, key: string): string {
  let id = storage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    storage.setItem(key, id);
  }
  return id;
}

function extractUTM(params: URLSearchParams) {
  return {
    utmSource: params.get("utm_source") || undefined,
    utmMedium: params.get("utm_medium") || undefined,
    utmCampaign: params.get("utm_campaign") || undefined,
  };
}

export default function PlatformTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTracked = useRef<string>("");

  useEffect(() => {
    // Skip during SSR or if same path already tracked
    if (typeof window === "undefined") return;
    const fullPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    if (fullPath === lastTracked.current) return;
    lastTracked.current = fullPath;

    try {
      const visitorId = getOrCreateId(localStorage, "sn_vid");
      const sessionId = getOrCreateId(sessionStorage, "sn_sid");
      const utm = extractUTM(searchParams ?? new URLSearchParams());

      const payload = JSON.stringify({
        pagePath: pathname,
        visitorId,
        sessionId,
        referrer: document.referrer || undefined,
        userAgent: navigator.userAgent || undefined,
        screenWidth: window.innerWidth || undefined,
        ...utm,
      });

      // Prefer sendBeacon (non-blocking, survives page unload)
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics/track", new Blob([payload], { type: "application/json" }));
      } else {
        fetch("/api/analytics/track", {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Tracking is best-effort — never break the app
    }
  }, [pathname, searchParams]);

  return null;
}
