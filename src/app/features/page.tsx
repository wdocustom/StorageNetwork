import type { Metadata } from "next";
import FeaturesPageClient from "./FeaturesPageClient";

// ═══════════════════════════════════════════════════════════════════════════
// /features — server wrapper so we can export metadata + JSON-LD around
// the existing "use client" page. The client component does all the
// rendering; this file is a shell whose only job is SEO.
// ═══════════════════════════════════════════════════════════════════════════

export const metadata: Metadata = {
  title:
    "Platform Features | Storage Network — Tote Storage Systems, 3D Designer & Installer Toolkit",
  description:
    "Everything in the Storage Network platform: the 3D tote storage designer, automated cut plans for tote racks and tote shelving, scheduling and deposits, branded portfolio pages, AI marketing, and the installer-network routing engine for custom storage installations.",
  keywords: [
    "tote storage system",
    "tote storage rack",
    "tote racks",
    "tote shelving",
    "tote organizers",
    "shelf system",
    "shelf installation",
    "storage systems",
    "custom storage",
    "storage design",
    "storage installation",
    "built in storage",
    "build storage",
    "tool storage system",
    "27 gallon tote rack",
    "garage shelving system",
    "3D storage configurator",
    "installer network",
  ],
  alternates: {
    canonical: "/features",
  },
  openGraph: {
    title: "Storage Network — Platform Features",
    description:
      "The full Storage Network toolkit: 3D tote storage designer, automated cut plans, scheduling, deposits, branded portfolios, and the installer routing engine.",
    type: "website",
  },
};

// FAQPage schema — the public-facing copy on this page already answers
// most of these questions in long-form; the schema lets Google surface
// them as rich snippets. Questions are aligned with the high-intent
// keywords from our search campaigns so we get matched on the SERP
// where the click is.
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What's included in a Storage Network tote storage system?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A complete tote storage system includes the 2×4 frame, plywood rails sized to 27-gallon HDX or Greenmade totes, anchoring hardware, and the totes themselves. We design it in 3D, generate the cut plan, and either route the build to a certified installer or hand you the materials list for DIY.",
      },
    },
    {
      "@type": "Question",
      name: "Do you offer custom storage installation or just plans?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Both. Use the free configurator to design your wall and then choose: book a certified installer in your area for a full custom storage installation (frame, shelf installation, totes loaded), or download the cut list and material guide and build it yourself.",
      },
    },
    {
      "@type": "Question",
      name: "Can the same system be used as a tool storage system?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — the same frame supports 27-gallon totes for bulk items and 6.5-quart mini totes for tool storage. Most workshops mix the two: full-depth totes on the bottom rows for power tools and consumables, mini-tote shelves at eye level for fasteners and parts.",
      },
    },
    {
      "@type": "Question",
      name: "Where does tote shelving make the biggest difference?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Garages, basements, pantries, mudrooms, and sheds — anywhere people pile bins on the floor or buy wire shelves that bow. Built-in storage with labeled totes outperforms wire racks on capacity, weight rating, and how fast you find what you're looking for.",
      },
    },
  ],
};

export default function FeaturesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <FeaturesPageClient />
    </>
  );
}
