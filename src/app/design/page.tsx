import { Suspense } from "react";
import type { Metadata } from "next";
import {
  getInstallerById,
  getInstallerByRef,
  getInstallerBySlug,
  type AvailabilityResult,
} from "@/app/actions/customer";
import { mapToDesignViewModel } from "@/lib/mappers/installerMapper";
import { generateHowToJsonLd } from "@/lib/schema/howto";
import DesignConfigurator from "./DesignConfigurator";

// ═══════════════════════════════════════════════════════════════════════════
// SEO Metadata
// ═══════════════════════════════════════════════════════════════════════════

export const metadata: Metadata = {
  title: "3D Tote Storage Designer | Free Configurator | Storage Network",
  description:
    "Design your custom tote storage system in 30 seconds. Free 3D configurator calculates how many 27-gallon totes fit your wall. Get instant pricing and cut lists.",
  keywords: [
    "tote storage designer",
    "3D storage configurator",
    "27 gallon tote rack",
    "garage storage calculator",
    "custom shelving planner",
    "HDX tote system",
    "basement storage design",
  ],
  openGraph: {
    title: "Free 3D Tote Storage Designer",
    description:
      "Design your custom tote storage system in 30 seconds. See exactly how many bins fit your wall.",
    type: "website",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Schema Markup (JSON-LD)
// ═══════════════════════════════════════════════════════════════════════════

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Storage Network 3D Designer",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web Browser",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Free 3D configurator for designing custom tote storage systems. Calculates dimensions, pricing, and generates cut lists.",
  featureList: [
    "Wall dimension input",
    "Automatic tote capacity calculation",
    "Real-time 3D visualization",
    "Instant price estimates",
    "Cut list generation",
    "Material shopping list",
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How much does tote storage cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tote storage systems typically cost $30-50 per tote slot for professional installation, or $150-400 in materials for DIY. A standard 4x5 unit (20 totes) costs around $600-850 installed.",
      },
    },
    {
      "@type": "Question",
      name: "How many totes fit on a wall?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Use our free 3D configurator to calculate exactly how many totes fit your wall. A typical 8-foot wide by 7-foot tall wall can fit a 4x4 or 4x5 unit (16-20 totes).",
      },
    },
    {
      "@type": "Question",
      name: "Can I install tote storage myself?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! Our configurator generates a complete cut list and material guide for DIY installation. Most builds take 2-4 hours with basic tools (miter saw, drill, level).",
      },
    },
    {
      "@type": "Question",
      name: "What size totes work with this system?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our systems are designed for standard 27-gallon totes (HDX or Greenmade brands). HDX totes are 30.6\" x 20.3\" x 14.3\" and Greenmade are 30.4\" x 20.3\" x 14.8\".",
      },
    },
    {
      "@type": "Question",
      name: "How much weight can tote shelving hold?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our heavy-duty 2x4 frame construction supports 1,000+ lbs per unit. Each individual tote slot can safely hold 100+ lbs when properly installed into wall studs.",
      },
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Design Page — Server Component
//
// Resolves the installer SERVER-SIDE, maps to a DesignPageViewModel,
// then passes ONLY the view model to the client. The raw profile
// (including is_pro, business_name, logo_url) never reaches the browser.
// ═══════════════════════════════════════════════════════════════════════════

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DesignPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const installerId = typeof params.installer_id === "string" ? params.installer_id : "";
  const installerParam = typeof params.installer === "string" ? params.installer : "";
  const ref = typeof params.ref === "string" ? params.ref : "";
  const zip = typeof params.zip === "string" ? params.zip : "";
  const mode = typeof params.mode === "string" ? params.mode : "";
  const fromNetwork = params.from === "network"; // Came from platform ZIP lookup

  // UUID detection — route ?installer=UUID to getInstallerById, not slug lookup
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const installerParamIsUUID = UUID_RE.test(installerParam);

  // ── Server-side installer resolution ────────────────────────────────
  let rawInstaller: AvailabilityResult | null = null;

  if (ref) {
    const res = await getInstallerByRef(ref);
    if (res.available) rawInstaller = res;
  } else if (installerId) {
    const res = await getInstallerById(installerId);
    if (res.available) rawInstaller = res;
  } else if (installerParam && installerParamIsUUID) {
    const res = await getInstallerById(installerParam);
    if (res.available) rawInstaller = res;
  } else if (installerParam) {
    const res = await getInstallerBySlug(installerParam);
    if (res.available) rawInstaller = res;
  }

  // Determine lead source:
  // - Direct lead (partner_link): customer used installer's custom link (ref param or slug)
  // - Network lead (platform): customer found installer via platform ZIP lookup (from=network)
  // If from=network is set, it's always a platform lead even if installer param exists
  const isDirectLead = !fromNetwork && !!(rawInstaller && (ref || installerId || installerParam));

  // ── Map to View Model — branding gate applied here ──────────────────
  // The raw installer object dies here. Only the view model is serialized
  // to the client. Free installers get platform branding; Pro gets theirs.
  const viewModel = mapToDesignViewModel(rawInstaller);

  // ── HowTo JSON-LD — standard 5×4 build for rich snippet eligibility ──
  // This generates a generic HowTo for the default build configuration.
  // For /p/[slug] partner pages, the description field can be enriched
  // with a Gemini-generated project summary per-installer.
  const howToSchema = generateHowToJsonLd({
    cols: 5,
    rows: 4,
    hasWheels: true,
    hasTop: false,
    installerName: rawInstaller?.installer_name || undefined,
  });

  return (
    <>
      {/* SEO Schema Markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />

      <Suspense>
        <DesignConfigurator
          initialData={viewModel}
          initialZip={zip}
          mode={mode}
          leadSource={isDirectLead ? "partner_link" : "platform"}
        />
      </Suspense>
    </>
  );
}
