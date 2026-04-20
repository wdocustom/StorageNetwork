"use client";

import { useEffect, useRef } from "react";
import { trackPageView } from "@/app/actions/analytics";

// ═══════════════════════════════════════════════════════════════════════════
// PageViewTracker — Fires a single page view event on mount
//
// Drop this into any page that should track visits for an installer.
// It fires once, silently, and renders nothing.
// ═══════════════════════════════════════════════════════════════════════════

interface PageViewTrackerProps {
  installerId: string;
  page: string;
}

export default function PageViewTracker({ installerId, page }: PageViewTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current || !installerId) return;
    tracked.current = true;

    trackPageView({
      installerId,
      page,
      referrer: document.referrer || undefined,
      userAgent: navigator.userAgent || undefined,
      screenWidth: window.innerWidth || undefined,
    });
  }, [installerId, page]);

  return null;
}
