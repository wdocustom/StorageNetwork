import { redirect, notFound } from "next/navigation";
import { getProfileBySlug } from "@/app/actions/profile";

// ═══════════════════════════════════════════════════════════════════════════
// Partner Link Route — /p/[slug]
// Resolves Pro installer's custom slug to their booking page
// ═══════════════════════════════════════════════════════════════════════════

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PartnerLinkPage({ params }: PageProps) {
  const { slug } = await params;

  // Look up the installer by their custom slug
  const profile = await getProfileBySlug(slug);

  if (!profile) {
    // Slug not found — show 404
    notFound();
  }

  // Redirect to the installer's booking page
  redirect(`/book/${profile.id}`);
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);

  if (!profile) {
    return {
      title: "Partner Not Found | Storage Network",
    };
  }

  return {
    title: `Book with ${profile.business_name || "Storage Network Partner"}`,
    description: `Design and book your custom tote storage system with ${profile.business_name || "a certified Storage Network installer"}.`,
  };
}
