// ═══════════════════════════════════════════════════════════════════════════
// Site Configuration — White Label Ready
// All brand-specific values should come from environment variables or this file
// ═══════════════════════════════════════════════════════════════════════════

export const siteConfig = {
  // App Identity
  name: process.env.NEXT_PUBLIC_APP_NAME || "Partner Network",
  tagline: process.env.NEXT_PUBLIC_APP_TAGLINE || "Professional Storage Solutions",

  // URLs
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",

  // Support
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com",

  // Branding
  logoPath: "/logo.png",

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

// Type for the site config
export type SiteConfig = typeof siteConfig;
