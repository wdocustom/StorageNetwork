import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { Metadata } from "next";

const CustomerChatWidget = dynamic(() => import("@/components/chat/CustomerChatWidget"), { ssr: false });
import {
  getInstallerById,
  getInstallerByRef,
  getInstallerBySlug,
  type AvailabilityResult,
} from "@/app/actions/customer";
import { mapToDesignViewModel } from "@/lib/mappers/installerMapper";
import { PLATFORM_DEFAULTS, ADDON_PLATFORM_DEFAULTS } from "@/lib/server/pricing-constants";
import { generateHowToJsonLd } from "@/lib/schema/howto";
import { getSavedQuoteFromSignal } from "@/app/actions/demand-signals";
import { checkInstallerAtCapacity } from "@/app/actions/pro-trial";
import { getServiceClient } from "@/lib/supabase-server";
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
  alternates: {
    canonical: "/design",
  },
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
  const fromChat = params.from === "chat"; // Came from AI chat configurator
  const signalId = typeof params.signal_id === "string" ? params.signal_id : "";
  const refInstaller = typeof params.ref_installer === "string" ? params.ref_installer : "";

  // Decode chat config if present (base64-encoded JSON from AI chatbot)
  let chatConfig: Record<string, unknown> | null = null;
  if (typeof params.config === "string") {
    try {
      chatConfig = JSON.parse(Buffer.from(params.config, "base64").toString());
    } catch {}
  }

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

  // ── Waitlist re-engagement: fetch saved quote from demand signal ──────
  // When a waitlisted customer clicks the activation email, the link includes
  // signal_id (their demand signal) and ref_installer (original referrer).
  // We fetch their saved build so the configurator can pre-populate it.
  const savedSignal = signalId ? await getSavedQuoteFromSignal(signalId) : null;

  // Determine lead source:
  // - Direct lead (partner_link): customer used installer's custom link (ref param or slug)
  // - Network lead (platform): customer found installer via platform ZIP lookup (from=network)
  // If from=network is set, it's always a platform lead even if installer param exists
  const isDirectLead = !fromNetwork && !!(rawInstaller && (ref || installerId || installerParam));

  // ── Trial cap check — is the installer at their 3-job limit? ────────
  // If so, we pass a flag to the configurator so it can swap the booking
  // CTA with a waitlist flow. Runs in parallel with saved signal fetch.
  const capacityStatus = rawInstaller?.installer_id
    ? await checkInstallerAtCapacity(rawInstaller.installer_id)
    : null;

  // ── Map to View Model — branding gate applied here ──────────────────
  // The raw installer object dies here. Only the view model is serialized
  // to the client. Free installers get platform branding; Pro gets theirs.
  const viewModel = mapToDesignViewModel(rawInstaller);

  // Inject server-only pricing defaults into the view model
  // These values NEVER appear in the client bundle — they're serialized as data, not code
  if (viewModel) {
    viewModel.platformDefaults = { ...PLATFORM_DEFAULTS };
    viewModel.addonDefaults = { ...ADDON_PLATFORM_DEFAULTS };
  }

  // ── Fresh scheduling_enabled read (bypasses installer cache) ───────
  // The installer cache is in-memory and doesn't sync across serverless
  // function instances, so the cached value can be stale. Read directly.
  if (viewModel && rawInstaller?.installer_id) {
    const supabase = getServiceClient();
    const { data: freshProfile } = await supabase
      .from("profiles")
      .select("scheduling_enabled")
      .eq("id", rawInstaller.installer_id)
      .maybeSingle();
    if (freshProfile && typeof freshProfile.scheduling_enabled === "boolean") {
      viewModel.routing.schedulingEnabled = freshProfile.scheduling_enabled;
    }
  }

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
          initialInstallerAtCapacity={capacityStatus?.atCapacity ?? false}
          initialConfig={chatConfig}
          savedSignal={savedSignal ? {
            quoteData: savedSignal.quoteData,
            sourceInstallerId: savedSignal.sourceInstallerId || refInstaller || null,
            customerName: savedSignal.customerName,
            customerEmail: savedSignal.customerEmail,
            customerPhone: savedSignal.customerPhone,
          } : refInstaller ? {
            quoteData: null,
            sourceInstallerId: refInstaller,
            customerName: null,
            customerEmail: null,
            customerPhone: null,
          } : undefined}
        />
      </Suspense>

      {/* AI Design Assistant */}
      <CustomerChatWidget
        installerId={viewModel?.routing.installerId}
        installerSlug={viewModel?.routing.slug || undefined}
        installerContext={viewModel ? {
          installerName: viewModel.branding.title,
          standardSlot: viewModel.pricing?.standard_slot,
          miniSlot: viewModel.pricing?.mini_slot,
          standardTote: viewModel.pricing?.standard_tote,
          standardToteClear: viewModel.pricing?.standard_tote_clear,
          miniTote: viewModel.pricing?.mini_tote,
          standardWheels: viewModel.pricing?.standard_wheels,
          miniWheels: viewModel.pricing?.mini_wheels,
          plywoodTop: viewModel.pricing?.plywood_top,
          miniEnabled: viewModel.pricing?.mini_enabled === true,
          shelvingEnabled: viewModel.pricing?.open_shelving_enabled === true,
          overheadEnabled: viewModel.pricing?.overhead_storage_enabled === true,
          raisedBedEnabled: viewModel.pricing?.raised_bed_enabled === true,
          disabledPresets: [
            viewModel.pricing?.bestseller_indiana_joe_disabled ? "indiana-joe" : "",
            viewModel.pricing?.bestseller_cornhusker_disabled ? "cornhusker" : "",
            viewModel.pricing?.bestseller_long_ranger_disabled ? "long-ranger" : "",
            viewModel.pricing?.bestseller_gas_station_disabled ? "gas-station" : "",
            viewModel.pricing?.bestseller_track_norris_disabled ? "track-norris" : "",
          ].filter(Boolean),
        } : undefined}
      />
    </>
  );
}
