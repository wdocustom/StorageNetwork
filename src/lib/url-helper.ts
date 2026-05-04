// ═══════════════════════════════════════════════════════════════════════════
// URL Helper — Single source of truth for app URL resolution
//
// Evaluation order:
//   1. Client-side: window.location.origin (supports www and non-www)
//   2. Production:  NEXT_PUBLIC_APP_URL env var (set in Vercel)
//   3. Vercel Preview: https://${VERCEL_URL}
//   4. Fallback: http://localhost:3000
// ═══════════════════════════════════════════════════════════════════════════

const CANONICAL_PRODUCTION_URL = "https://storage-network.app";

export function getAppUrl(): string {
  // 1. Client-side — use the actual browser origin
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // 2. Explicit production URL from environment
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 3. Vercel preview deployments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Local development fallback
  return "http://localhost:3000";
}

// Email assets must resolve to a publicly reachable URL in the recipient's
// inbox. VERCEL_URL points at deployment-specific hosts which are gated by
// Vercel Deployment Protection (403 to anyone outside the team), so we never
// fall back to it here.
export function getEmailAssetUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  return CANONICAL_PRODUCTION_URL;
}
