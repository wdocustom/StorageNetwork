import { NATIVE_SCHEME, WEB_ORIGIN } from "@/lib/native/env";

// Paths the app is allowed to open from a universal link / custom scheme /
// notification tap. Anything else is ignored so a crafted link cannot steer
// the WebView off the app's own surfaces.
const ALLOWED_PREFIXES = [
  "/dashboard",
  "/login",
  "/pay/",
  "/payment/success",
  "/auth/callback",
  "/reset-password",
];

/** Only same-origin relative paths: "/x" yes, "//evil.com" and "https://…" no. */
export function isSafeRelativePath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
  return true;
}

/**
 * Map an incoming deep link to a path+query on the web origin, or null when
 * the link is not ours / not allowed.
 *
 *   storagenetwork://auth/callback?code=…   → /auth/callback?code=…
 *   storagenetwork://dashboard/leads/abc    → /dashboard/leads/abc
 *   https://storage-network.app/dashboard   → /dashboard
 */
export function resolveDeepLink(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  let path: string;
  if (url.protocol === `${NATIVE_SCHEME}:`) {
    // For custom schemes the "host" is the first path segment.
    path = `/${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } else if (url.origin === WEB_ORIGIN) {
    path = url.pathname;
  } else {
    return null;
  }

  if (!isSafeRelativePath(path)) return null;
  if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
    return null;
  }
  return `${path}${url.search}`;
}

/** Path to open when a push notification is tapped. */
export function notificationTargetPath(data: Record<string, unknown> | undefined): string {
  const leadId = typeof data?.leadId === "string" ? data.leadId : null;
  if (leadId && /^[0-9a-f-]{8,64}$/i.test(leadId)) {
    return `/dashboard/leads/${leadId}`;
  }
  return "/dashboard";
}
