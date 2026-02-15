import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProfileBySlug } from "@/app/actions/profile";
import { generateHowToJsonLd } from "@/lib/schema/howto";

// ═══════════════════════════════════════════════════════════════════════════
// Partner Link Route — /p/[slug]
//
// Resolves Pro installer's custom slug → branded design page.
// Uses server redirect (307) so Google follows to /design?installer=slug.
//
// SEO strategy:
//   - generateMetadata provides rich title/description/OG for crawlers
//   - The HowTo JSON-LD lives on the destination /design page (Google
//     indexes the canonical page, not the redirect source)
//   - alternates.canonical points crawlers to the design page
// ═══════════════════════════════════════════════════════════════════════════

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PartnerLinkPage({ params }: PageProps) {
  const { slug } = await params;

  const profile = await getProfileBySlug(slug);
  if (!profile) notFound();

  redirect(`/design?installer=${slug}`);
}

// ── SEO Metadata ─────────────────────────────────────────────────────────
// Rich metadata with OpenGraph, keywords, and canonical for partner pages.
// The HowTo JSON-LD is served on the destination /design page since
// redirect() prevents body rendering. Google indexes the canonical URL.

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);

  if (!profile) {
    return { title: "Partner Not Found | Storage Network" };
  }

  const businessName = profile.business_name || "Storage Network Partner";

  return {
    title: `Book with ${businessName} | Custom Tote Storage`,
    description: `Design and book your custom tote storage system with ${businessName}. Free 3D configurator with instant pricing, cut lists, and professional installation.`,
    keywords: [
      businessName,
      "tote storage",
      "garage organization",
      "custom shelving",
      "professional installation",
      "27 gallon tote rack",
    ],
    openGraph: {
      title: `Book Custom Storage with ${businessName}`,
      description: `Design your tote storage system with ${businessName}. 3D configurator, instant pricing, and professional installation.`,
      type: "website",
    },
    alternates: {
      canonical: `/design?installer=${slug}`,
    },
  };
}
