// ═══════════════════════════════════════════════════════════════════════════
// Site Configuration — White Label Ready
// All brand-specific values should come from environment variables or this file
// ═══════════════════════════════════════════════════════════════════════════

import { getAppUrl } from "@/lib/url-helper";

export const siteConfig = {
  // App Identity
  name: process.env.NEXT_PUBLIC_APP_NAME || "The Storage-Network",
  tagline: process.env.NEXT_PUBLIC_APP_TAGLINE || "Professional Storage Solutions",

  // URLs — dynamic resolution (never hardcoded)
  get baseUrl() {
    return getAppUrl();
  },

  // Support
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@storage-network.app",

  // Branding
  logoPath: "/logo-storage-network.png",

  // Cookie Settings
  cookies: {
    partnerRef: {
      name: "partner_ref",
      maxAge: 60 * 60 * 24 * 30, // 30 days in seconds
    },
  },

  // Feature Flags
  features: {
    stripeConnect: true,
    brevoEmail: true,
    proSubscription: true,
  },
} as const;
