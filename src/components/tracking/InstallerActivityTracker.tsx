"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { logActivityClient } from "@/lib/activity-client";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Activity Tracker
//
// Drop into the dashboard layout to automatically log every page view
// an authenticated installer makes. Fires on every pathname change.
// Non-blocking — errors are silently swallowed.
// ═══════════════════════════════════════════════════════════════════════════

export default function InstallerActivityTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string>("");

  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;

    logActivityClient({ action: "page_view", pagePath: pathname });
  }, [pathname]);

  return null;
}
