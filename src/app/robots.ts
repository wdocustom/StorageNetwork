import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Default: allow all crawlers
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/login", "/reset-password"],
      },
      {
        // Google AI / Gemini
        userAgent: "Google-Extended",
        allow: "/",
      },
      {
        // OpenAI / ChatGPT
        userAgent: "GPTBot",
        allow: "/",
      },
      {
        // Anthropic / Claude
        userAgent: "ClaudeBot",
        allow: "/",
      },
      {
        // Perplexity
        userAgent: "PerplexityBot",
        allow: "/",
      },
      {
        // Google general
        userAgent: "Googlebot",
        allow: "/",
      },
      {
        // Bing
        userAgent: "Bingbot",
        allow: "/",
      },
    ],
    sitemap: "https://storage-network.app/sitemap.xml",
  };
}
