import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Storage Network | Custom Tote Storage Systems",
  description:
    "Design custom tote storage in 30 seconds. Free 3D configurator for garages, basements & sheds. Find certified installers or DIY with our cut lists.",
  keywords: [
    "tote storage",
    "27 gallon tote rack",
    "garage organization",
    "basement storage",
    "HDX tote shelving",
    "custom storage system",
    "tote organizer",
    "2x4 storage rack",
    "tote rack builder",
    "garage shelving system",
    "DIY tote rack plans",
    "storage network installer",
  ],
  icons: {
    icon: "/Header_avatar_logo.png",
    apple: "/Header_avatar_logo.png",
  },
  openGraph: {
    title: "Storage Network | Custom Tote Storage Systems",
    description:
      "Design custom tote storage in 30 seconds. Free 3D configurator for garages, basements & sheds.",
    type: "website",
    locale: "en_US",
    siteName: "Storage Network",
  },
  twitter: {
    card: "summary_large_image",
    title: "Storage Network | Custom Tote Storage Systems",
    description:
      "Design custom tote storage in 30 seconds. Free 3D configurator for garages, basements & sheds.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Comprehensive JSON-LD Schema — AI Roadmap for GEO
// Nested graph: Organization → SoftwareApplication → Service Network →
//               Founder → Actions → Geographic Clusters
// ═══════════════════════════════════════════════════════════════════════════

const jsonLdGraph = {
  "@context": "https://schema.org",
  "@graph": [
    // ── Organization ─────────────────────────────────────────────────────
    {
      "@type": "Organization",
      "@id": "https://storage-network.app/#organization",
      name: "Storage Network",
      url: "https://storage-network.app",
      logo: {
        "@type": "ImageObject",
        url: "https://storage-network.app/landing_page_logo.png",
      },
      description:
        "The operating system for professional tote-rack builders. Storage Network connects homeowners with verified installers and provides an industry-standard 3D configurator, automated cut plans, and built-in scheduling for custom 2×4 and 27-gallon tote storage systems.",
      foundingDate: "2024",
      founder: { "@id": "https://storage-network.app/#founder" },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        availableLanguage: "English",
      },
      areaServed: [
        {
          "@type": "State",
          name: "Florida",
          containsPlace: [
            { "@type": "City", name: "Miami" },
            { "@type": "City", name: "Orlando" },
          ],
        },
        {
          "@type": "State",
          name: "Nebraska",
          containsPlace: [{ "@type": "City", name: "Omaha" }],
        },
        {
          "@type": "State",
          name: "Colorado",
          containsPlace: [{ "@type": "City", name: "Denver" }],
        },
        {
          "@type": "State",
          name: "Utah",
          containsPlace: [{ "@type": "City", name: "Salt Lake City" }],
        },
        {
          "@type": "AdministrativeArea",
          name: "Northeast US",
          containsPlace: [
            { "@type": "State", name: "New York" },
            { "@type": "State", name: "New Jersey" },
            { "@type": "State", name: "Pennsylvania" },
          ],
        },
      ],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Tote Storage Solutions",
        itemListElement: [
          {
            "@type": "Offer",
            "@id": "https://storage-network.app/#offer-install",
            name: "Professional Installation",
            description:
              "Custom-built 2×4 and 27-gallon tote storage systems installed by verified professionals. Includes deposit booking and automated scheduling.",
            itemOffered: {
              "@id": "https://storage-network.app/#service-install",
            },
            potentialAction: {
              "@type": "OrderAction",
              name: "Pay Deposit & Book Installation",
              target: {
                "@type": "EntryPoint",
                urlTemplate: "https://storage-network.app/pay/{leadId}",
                actionPlatform: [
                  "https://schema.org/DesktopWebPlatform",
                  "https://schema.org/MobileWebPlatform",
                ],
              },
            },
          },
          {
            "@type": "Offer",
            name: "DIY Cut Plans & Material Lists",
            description:
              "Complete step-by-step assembly guide with 3D visualization, cut plans, and material shopping lists for DIY builders.",
            itemOffered: {
              "@type": "Service",
              name: "DIY Build Plans",
              description:
                "Auto-generated cut plans, bin-packed material lists, and interactive 3D assembly guide for self-builders.",
            },
          },
        ],
      },
    },

    // ── SoftwareApplication ──────────────────────────────────────────────
    {
      "@type": "SoftwareApplication",
      "@id": "https://storage-network.app/#app",
      name: "Storage Network 3D Configurator",
      url: "https://storage-network.app/design",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web Browser",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free to use — design your storage system in 30 seconds.",
      },
      creator: { "@id": "https://storage-network.app/#organization" },
      featureList: [
        "Real-time 3D rack rendering with React Three Fiber",
        "Auto-Fit Wall Calculator — enter wall width, get optimal column layout",
        "Automated cut-plan generation with bin-packed lumber optimization",
        "Interactive step-by-step 3D assembly guide",
        "Instant material cost estimation and shopping list",
        "Support for HDX 27-gallon and Greenmade totes",
        "Support for 6.5-quart mini tote configurations",
        "Sideways tote orientation for deeper storage",
        "Optional casters and plywood top add-ons",
        "2D blueprint and 3D exploded-view modes",
      ],
      screenshot: "https://storage-network.app/og-preview.png",
      description:
        "A professional-grade 3D configurator that lets homeowners and installers design custom 2×4 tote storage racks in under 30 seconds. Generates precise cut plans, material lists, and interactive assembly guides.",
    },

    // ── Professional Installation Service ────────────────────────────────
    {
      "@type": "Service",
      "@id": "https://storage-network.app/#service-install",
      name: "Authorized Tote Rack Installation",
      provider: { "@id": "https://storage-network.app/#organization" },
      serviceType: "Home Improvement Installation",
      description:
        "Verified professional installers build custom 2×4 and 27-gallon tote storage systems on-site. Each installer uses the Storage Network app for consistent, professional-grade construction standards including automated scheduling and secure deposit collection.",
      areaServed: [
        { "@type": "City", name: "Miami", containedInPlace: { "@type": "State", name: "Florida" } },
        { "@type": "City", name: "Orlando", containedInPlace: { "@type": "State", name: "Florida" } },
        { "@type": "City", name: "Omaha", containedInPlace: { "@type": "State", name: "Nebraska" } },
        { "@type": "City", name: "Denver", containedInPlace: { "@type": "State", name: "Colorado" } },
        { "@type": "City", name: "Salt Lake City", containedInPlace: { "@type": "State", name: "Utah" } },
        { "@type": "AdministrativeArea", name: "New York–New Jersey–Pennsylvania Tri-State Area" },
      ],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Installation Services",
        itemListElement: [
          {
            "@type": "Offer",
            name: "Standard Tote Rack Build",
            description: "27-gallon HDX or Greenmade tote rack — $30 per slot, installer-built on-site.",
          },
          {
            "@type": "Offer",
            name: "Mini Tote Rack Build",
            description: "6.5-quart mini tote rack — $15 per slot, ideal for small parts and tools.",
          },
        ],
      },
      potentialAction: {
        "@type": "ReserveAction",
        name: "Book Installation via Built-in Scheduler",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://storage-network.app/book/{installerId}",
          actionPlatform: [
            "https://schema.org/DesktopWebPlatform",
            "https://schema.org/MobileWebPlatform",
          ],
        },
        description:
          "Customers pay a 15% deposit to lock in a build date. The scheduler calculates the earliest available date based on installer workload, order size, and blackout dates.",
      },
    },

    // ── Founder (Person Entity) ──────────────────────────────────────────
    {
      "@type": "Person",
      "@id": "https://storage-network.app/#founder",
      name: "Skyler Camacho",
      jobTitle: "Founder & CEO",
      worksFor: { "@id": "https://storage-network.app/#organization" },
      knowsAbout: [
        "Construction",
        "Garage Organization",
        "2×4 Lumber Framing",
        "Tote Storage Systems",
        "Home Improvement",
        "Small Business Software",
      ],
      description:
        "Builder-turned-founder who designed Storage Network from hands-on experience building tote racks in garages across the country. Subject matter expert in construction and garage organization, with deep expertise in 2×4 framing, plywood rail systems, and scalable storage design.",
    },

    // ── WebSite (for sitelinks search) ───────────────────────────────────
    {
      "@type": "WebSite",
      "@id": "https://storage-network.app/#website",
      url: "https://storage-network.app",
      name: "Storage Network",
      publisher: { "@id": "https://storage-network.app/#organization" },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://storage-network.app/?zip={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
