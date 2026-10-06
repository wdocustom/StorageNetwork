// Content-Security-Policy. The public site and the installed PWA get the base
// policy, unchanged. The Capacitor shell loads the production origin itself
// (server.url), so 'self' already covers its own origin — nothing extra is
// needed for that. Requests carrying the native app's User-Agent token
// additionally get the Stripe hosted/3DS frames and Supabase realtime sockets
// (see the `has` rule in headers()); browsers never see that variant.
function buildCsp({ native = false } = {}) {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://replicate.delivery",
    "font-src 'self'",
    `connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.upstash.io https://raw.githack.com${native ? " wss://*.supabase.co" : ""}`,
    `frame-src 'self' https://js.stripe.com${native ? " https://hooks.stripe.com https://checkout.stripe.com https://connect.stripe.com" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Never ship source maps to the browser in production
  productionBrowserSourceMaps: false,

  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
    // Ensure private/ files are bundled into the serverless function
    // that handles /api/chair-plans so they're available at runtime on Vercel.
    outputFileTracingIncludes: {
      "/api/chair-plans": ["./private/**/*"],
      "/api/plans/view": ["./private/**/*"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "replicate.delivery",
      },
    ],
  },

  // Security + caching headers
  async headers() {
    // Shared security headers for every response
    const securityHeaders = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(self), geolocation=(self), payment=(self)",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      },
      { key: "Content-Security-Policy", value: buildCsp() },
    ];

    return [
      // Security headers on all routes
      { source: "/(.*)", headers: securityHeaders },

      // Native app only (User-Agent carries StorageNetworkApp/): extended CSP.
      // Declared after the catch-all so it overrides the base CSP for these
      // requests; every other header from the base set still applies.
      // Limited to dynamic, never-CDN-cached sections so the native variant
      // can't be cached and served to browsers.
      {
        source: "/:section(dashboard|login|pay|payment|upsell|plans|reset-password)/:path*",
        has: [{ type: "header", key: "user-agent", value: ".*StorageNetworkApp.*" }],
        headers: [{ key: "Content-Security-Policy", value: buildCsp({ native: true }) }],
      },

      // ── Universal / App Links association files ─────────────────────
      // Apple requires application/json with no redirect; cache briefly so a
      // fixed TEAMID / fingerprint propagates quickly.
      {
        source: "/.well-known/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },

      // ── CDN caching for static marketing pages ──────────────────────
      // These pages have zero dynamic data — cache 5 min at CDN,
      // serve stale for up to 1 hour while revalidating in background.
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/about/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=600, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/features",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=600, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/technology",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=600, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/join",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/design",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/demo",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/legal/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/privacy",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/terms",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },

      // ── Static assets — aggressive cache ────────────────────────────
      {
        source: "/(.*)\\.(png|jpg|jpeg|gif|webp|svg|ico|woff2|woff)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
