/** @type {import('next').NextConfig} */
const nextConfig = {
  // Never ship source maps to the browser in production
  productionBrowserSourceMaps: false,

  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Security headers applied to every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking — block iframing by other sites
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Stop MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Basic XSS protection (legacy browsers)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Only send origin as referrer to external sites
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict permissions (camera, mic, geolocation, etc.)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
          },
          // Strict transport security — force HTTPS for 1 year
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
