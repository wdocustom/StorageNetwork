import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

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
    apple: "/icon-192x192.png",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
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
            { "@type": "City", name: "Tampa" },
            { "@type": "City", name: "Jacksonville" },
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
          containsPlace: [
            { "@type": "City", name: "Denver" },
            { "@type": "City", name: "Colorado Springs" },
          ],
        },
        {
          "@type": "State",
          name: "Utah",
          containsPlace: [
            { "@type": "City", name: "Salt Lake City" },
            { "@type": "City", name: "Provo" },
          ],
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
        {
          "@type": "State",
          name: "Georgia",
          containsPlace: [{ "@type": "City", name: "Atlanta" }],
        },
        {
          "@type": "State",
          name: "North Carolina",
          containsPlace: [
            { "@type": "City", name: "Charlotte" },
            { "@type": "City", name: "Raleigh" },
          ],
        },
        {
          "@type": "State",
          name: "Tennessee",
          containsPlace: [
            { "@type": "City", name: "Nashville" },
            { "@type": "City", name: "Memphis" },
            { "@type": "City", name: "Knoxville" },
          ],
        },
        {
          "@type": "State",
          name: "Texas",
          containsPlace: [
            { "@type": "City", name: "Dallas" },
            { "@type": "City", name: "Fort Worth" },
            { "@type": "City", name: "Houston" },
            { "@type": "City", name: "San Antonio" },
            { "@type": "City", name: "Austin" },
          ],
        },
        {
          "@type": "State",
          name: "Arizona",
          containsPlace: [
            { "@type": "City", name: "Phoenix" },
            { "@type": "City", name: "Scottsdale" },
            { "@type": "City", name: "Tucson" },
          ],
        },
        {
          "@type": "State",
          name: "Indiana",
          containsPlace: [{ "@type": "City", name: "Indianapolis" }],
        },
        {
          "@type": "State",
          name: "Ohio",
          containsPlace: [
            { "@type": "City", name: "Columbus" },
            { "@type": "City", name: "Cincinnati" },
            { "@type": "City", name: "Cleveland" },
          ],
        },
        {
          "@type": "State",
          name: "Minnesota",
          containsPlace: [{ "@type": "City", name: "Minneapolis" }],
        },
        {
          "@type": "State",
          name: "Missouri",
          containsPlace: [
            { "@type": "City", name: "St. Louis" },
            { "@type": "City", name: "Kansas City" },
          ],
        },
        {
          "@type": "State",
          name: "Wisconsin",
          containsPlace: [{ "@type": "City", name: "Milwaukee" }],
        },
        {
          "@type": "State",
          name: "Michigan",
          containsPlace: [
            { "@type": "City", name: "Detroit" },
            { "@type": "City", name: "Grand Rapids" },
          ],
        },
        {
          "@type": "State",
          name: "Kentucky",
          containsPlace: [{ "@type": "City", name: "Louisville" }],
        },
        {
          "@type": "State",
          name: "Virginia",
          containsPlace: [
            { "@type": "City", name: "Richmond" },
            { "@type": "City", name: "Virginia Beach" },
          ],
        },
        {
          "@type": "State",
          name: "South Carolina",
          containsPlace: [
            { "@type": "City", name: "Charleston" },
            { "@type": "City", name: "Greenville" },
          ],
        },
        {
          "@type": "State",
          name: "Idaho",
          containsPlace: [{ "@type": "City", name: "Boise" }],
        },
        {
          "@type": "State",
          name: "Oregon",
          containsPlace: [{ "@type": "City", name: "Portland" }],
        },
        {
          "@type": "State",
          name: "Washington",
          containsPlace: [
            { "@type": "City", name: "Seattle" },
            { "@type": "City", name: "Spokane" },
          ],
        },
        {
          "@type": "State",
          name: "California",
          containsPlace: [
            { "@type": "City", name: "Sacramento" },
            { "@type": "City", name: "San Diego" },
            { "@type": "City", name: "Bakersfield" },
          ],
        },
        {
          "@type": "State",
          name: "Nevada",
          containsPlace: [
            { "@type": "City", name: "Las Vegas" },
            { "@type": "City", name: "Reno" },
          ],
        },
        {
          "@type": "State",
          name: "New Mexico",
          containsPlace: [{ "@type": "City", name: "Albuquerque" }],
        },
        {
          "@type": "State",
          name: "Oklahoma",
          containsPlace: [
            { "@type": "City", name: "Oklahoma City" },
            { "@type": "City", name: "Tulsa" },
          ],
        },
        {
          "@type": "State",
          name: "Iowa",
          containsPlace: [{ "@type": "City", name: "Des Moines" }],
        },
        {
          "@type": "State",
          name: "Alabama",
          containsPlace: [
            { "@type": "City", name: "Huntsville" },
            { "@type": "City", name: "Birmingham" },
          ],
        },
        {
          "@type": "State",
          name: "Kansas",
          containsPlace: [{ "@type": "City", name: "Wichita" }],
        },
        {
          "@type": "State",
          name: "Arkansas",
          containsPlace: [{ "@type": "City", name: "Little Rock" }],
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
        // Florida
        { "@type": "City", name: "Miami", containedInPlace: { "@type": "State", name: "Florida" } },
        { "@type": "City", name: "Orlando", containedInPlace: { "@type": "State", name: "Florida" } },
        { "@type": "City", name: "Tampa", containedInPlace: { "@type": "State", name: "Florida" } },
        { "@type": "City", name: "Jacksonville", containedInPlace: { "@type": "State", name: "Florida" } },
        // Nebraska
        { "@type": "City", name: "Omaha", containedInPlace: { "@type": "State", name: "Nebraska" } },
        // Colorado
        { "@type": "City", name: "Denver", containedInPlace: { "@type": "State", name: "Colorado" } },
        { "@type": "City", name: "Colorado Springs", containedInPlace: { "@type": "State", name: "Colorado" } },
        // Utah
        { "@type": "City", name: "Salt Lake City", containedInPlace: { "@type": "State", name: "Utah" } },
        { "@type": "City", name: "Provo", containedInPlace: { "@type": "State", name: "Utah" } },
        // Northeast
        { "@type": "AdministrativeArea", name: "New York–New Jersey–Pennsylvania Tri-State Area" },
        // Georgia
        { "@type": "City", name: "Atlanta", containedInPlace: { "@type": "State", name: "Georgia" } },
        // North Carolina
        { "@type": "City", name: "Charlotte", containedInPlace: { "@type": "State", name: "North Carolina" } },
        { "@type": "City", name: "Raleigh", containedInPlace: { "@type": "State", name: "North Carolina" } },
        // Tennessee
        { "@type": "City", name: "Nashville", containedInPlace: { "@type": "State", name: "Tennessee" } },
        { "@type": "City", name: "Memphis", containedInPlace: { "@type": "State", name: "Tennessee" } },
        { "@type": "City", name: "Knoxville", containedInPlace: { "@type": "State", name: "Tennessee" } },
        // Texas
        { "@type": "City", name: "Dallas", containedInPlace: { "@type": "State", name: "Texas" } },
        { "@type": "City", name: "Fort Worth", containedInPlace: { "@type": "State", name: "Texas" } },
        { "@type": "City", name: "Houston", containedInPlace: { "@type": "State", name: "Texas" } },
        { "@type": "City", name: "San Antonio", containedInPlace: { "@type": "State", name: "Texas" } },
        { "@type": "City", name: "Austin", containedInPlace: { "@type": "State", name: "Texas" } },
        // Arizona
        { "@type": "City", name: "Phoenix", containedInPlace: { "@type": "State", name: "Arizona" } },
        { "@type": "City", name: "Scottsdale", containedInPlace: { "@type": "State", name: "Arizona" } },
        { "@type": "City", name: "Tucson", containedInPlace: { "@type": "State", name: "Arizona" } },
        // Indiana
        { "@type": "City", name: "Indianapolis", containedInPlace: { "@type": "State", name: "Indiana" } },
        // Ohio
        { "@type": "City", name: "Columbus", containedInPlace: { "@type": "State", name: "Ohio" } },
        { "@type": "City", name: "Cincinnati", containedInPlace: { "@type": "State", name: "Ohio" } },
        { "@type": "City", name: "Cleveland", containedInPlace: { "@type": "State", name: "Ohio" } },
        // Minnesota
        { "@type": "City", name: "Minneapolis", containedInPlace: { "@type": "State", name: "Minnesota" } },
        // Missouri
        { "@type": "City", name: "St. Louis", containedInPlace: { "@type": "State", name: "Missouri" } },
        { "@type": "City", name: "Kansas City", containedInPlace: { "@type": "State", name: "Missouri" } },
        // Wisconsin
        { "@type": "City", name: "Milwaukee", containedInPlace: { "@type": "State", name: "Wisconsin" } },
        // Michigan
        { "@type": "City", name: "Detroit", containedInPlace: { "@type": "State", name: "Michigan" } },
        { "@type": "City", name: "Grand Rapids", containedInPlace: { "@type": "State", name: "Michigan" } },
        // Kentucky
        { "@type": "City", name: "Louisville", containedInPlace: { "@type": "State", name: "Kentucky" } },
        // Virginia
        { "@type": "City", name: "Richmond", containedInPlace: { "@type": "State", name: "Virginia" } },
        { "@type": "City", name: "Virginia Beach", containedInPlace: { "@type": "State", name: "Virginia" } },
        // South Carolina
        { "@type": "City", name: "Charleston", containedInPlace: { "@type": "State", name: "South Carolina" } },
        { "@type": "City", name: "Greenville", containedInPlace: { "@type": "State", name: "South Carolina" } },
        // Idaho
        { "@type": "City", name: "Boise", containedInPlace: { "@type": "State", name: "Idaho" } },
        // Oregon
        { "@type": "City", name: "Portland", containedInPlace: { "@type": "State", name: "Oregon" } },
        // Washington
        { "@type": "City", name: "Seattle", containedInPlace: { "@type": "State", name: "Washington" } },
        { "@type": "City", name: "Spokane", containedInPlace: { "@type": "State", name: "Washington" } },
        // California
        { "@type": "City", name: "Sacramento", containedInPlace: { "@type": "State", name: "California" } },
        { "@type": "City", name: "San Diego", containedInPlace: { "@type": "State", name: "California" } },
        { "@type": "City", name: "Bakersfield", containedInPlace: { "@type": "State", name: "California" } },
        // Nevada
        { "@type": "City", name: "Las Vegas", containedInPlace: { "@type": "State", name: "Nevada" } },
        { "@type": "City", name: "Reno", containedInPlace: { "@type": "State", name: "Nevada" } },
        // New Mexico
        { "@type": "City", name: "Albuquerque", containedInPlace: { "@type": "State", name: "New Mexico" } },
        // Oklahoma
        { "@type": "City", name: "Oklahoma City", containedInPlace: { "@type": "State", name: "Oklahoma" } },
        { "@type": "City", name: "Tulsa", containedInPlace: { "@type": "State", name: "Oklahoma" } },
        // Iowa
        { "@type": "City", name: "Des Moines", containedInPlace: { "@type": "State", name: "Iowa" } },
        // Alabama
        { "@type": "City", name: "Huntsville", containedInPlace: { "@type": "State", name: "Alabama" } },
        { "@type": "City", name: "Birmingham", containedInPlace: { "@type": "State", name: "Alabama" } },
        // Kansas
        { "@type": "City", name: "Wichita", containedInPlace: { "@type": "State", name: "Kansas" } },
        // Arkansas
        { "@type": "City", name: "Little Rock", containedInPlace: { "@type": "State", name: "Arkansas" } },
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
    <html lang="en" style={{ backgroundColor: "#020617" }}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Storage" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />

        {/* ── iOS Splash Screens (dark #020617) ─────────────────────────────
            Without these, iOS shows a white splash screen on PWA launch.
            Each image is a solid slate-950 PNG matched to a device size.
            Generated by: node scripts/generate-splash.mjs
        ───────────────────────────────────────────────────────────────────── */}
        {/* iPhone SE / 5s (320×568 @2x → 640×1136) */}
        <link rel="apple-touch-startup-image" href="/splash/iphone5_640x1136.png"
          media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" />
        {/* iPhone 6/7/8/SE2/SE3 (375×667 @2x → 750×1334) */}
        <link rel="apple-touch-startup-image" href="/splash/iphone6_750x1334.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" />
        {/* iPhone 6+/7+/8+ (414×736 @3x → 1242×2208) */}
        <link rel="apple-touch-startup-image" href="/splash/iphone6plus_1242x2208.png"
          media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" />
        {/* iPhone X/XS/11 Pro (375×812 @3x → 1125×2436) */}
        <link rel="apple-touch-startup-image" href="/splash/iphonex_1125x2436.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />
        {/* iPhone XR/11 (414×896 @2x → 828×1792) */}
        <link rel="apple-touch-startup-image" href="/splash/iphonexr_828x1792.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" />
        {/* iPhone XS Max/11 Pro Max (414×896 @3x → 1242×2688) */}
        <link rel="apple-touch-startup-image" href="/splash/iphonexsmax_1242x2688.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" />
        {/* iPhone 12 mini/13 mini (360×780 @3x → 1080×2340) */}
        <link rel="apple-touch-startup-image" href="/splash/iphone12mini_1080x2340.png"
          media="(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3)" />
        {/* iPhone 12/13/14/15 (390×844 @3x → 1170×2532) */}
        <link rel="apple-touch-startup-image" href="/splash/iphone12_1170x2532.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" />
        {/* iPhone 12 Pro Max/13 Pro Max/14 Plus (428×926 @3x → 1284×2778) */}
        <link rel="apple-touch-startup-image" href="/splash/iphone12promax_1284x2778.png"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" />
        {/* iPhone 14 Pro/15 Pro (393×852 @3x → 1179×2556) */}
        <link rel="apple-touch-startup-image" href="/splash/iphone14pro_1179x2556.png"
          media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" />
        {/* iPhone 14 Pro Max/15 Pro Max (430×932 @3x → 1290×2796) */}
        <link rel="apple-touch-startup-image" href="/splash/iphone14promax_1290x2796.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" />
        {/* iPhone 16 Pro (402×874 @3x → 1206×2622) */}
        <link rel="apple-touch-startup-image" href="/splash/iphone16pro_1206x2622.png"
          media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)" />
        {/* iPhone 16 Pro Max (440×956 @3x → 1320×2868) */}
        <link rel="apple-touch-startup-image" href="/splash/iphone16promax_1320x2868.png"
          media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)" />
        {/* iPad (768×1024 @2x → 1536×2048) */}
        <link rel="apple-touch-startup-image" href="/splash/ipad_1536x2048.png"
          media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" />
        {/* iPad Pro 10.5" (834×1112 @2x → 1668×2224) */}
        <link rel="apple-touch-startup-image" href="/splash/ipadpro105_1668x2224.png"
          media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)" />
        {/* iPad Pro 11" (834×1194 @2x → 1668×2388) */}
        <link rel="apple-touch-startup-image" href="/splash/ipadpro11_1668x2388.png"
          media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)" />
        {/* iPad Pro 12.9" (1024×1366 @2x → 2048×2732) */}
        <link rel="apple-touch-startup-image" href="/splash/ipadpro129_2048x2732.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
        />
      </head>
      <body className="antialiased" style={{ backgroundColor: "#020617" }}>{children}</body>
    </html>
  );
}
