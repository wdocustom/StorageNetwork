"use client";

import { useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// QR Scan Tracker — fires once when ?qr=1 is in the URL
// Dropped into /p/[slug] pages. Sends a beacon to /api/analytics/qr-scan.
// ═══════════════════════════════════════════════════════════════════════════

interface QRScanTrackerProps {
  installerId: string;
  pagePath: string;
}

export default function QRScanTracker({ installerId, pagePath }: QRScanTrackerProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    // Only track if ?qr=1 is present
    const params = new URLSearchParams(window.location.search);
    if (params.get("qr") !== "1") return;
    fired.current = true;

    const payload = JSON.stringify({
      installerId,
      pagePath,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent,
    });

    // Prefer sendBeacon (non-blocking, survives page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/qr-scan", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/analytics/qr-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      }).catch(() => {});
    }

    // Clean up the URL (remove ?qr=1) without a page reload
    params.delete("qr");
    const clean = params.toString();
    const newUrl = window.location.pathname + (clean ? `?${clean}` : "");
    window.history.replaceState({}, "", newUrl);
  }, [installerId, pagePath]);

  return null;
}
