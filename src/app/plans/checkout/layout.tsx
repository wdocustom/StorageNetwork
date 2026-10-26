import type { Metadata } from "next";
import { generateBreadcrumbJsonLd } from "@/lib/schema/breadcrumb";
import { PLANS_PRICES } from "@/lib/schema/plans";

const DESCRIPTION = `Size your tote rack in 3D for free: pick totes wide and high, HDX or Greenmade, casters and worktop. Then get build plans for exactly that size: PDF ${PLANS_PRICES.pdf}, or ${PLANS_PRICES.interactive} with the interactive 3D guide.`;

export const metadata: Metadata = {
  title: "Design Your Tote Rack & Get Custom Build Plans | Storage Network",
  description: DESCRIPTION,
  // Pre-filled designs (?design=…) are the same page.
  alternates: {
    canonical: "/plans/checkout",
  },
  openGraph: {
    title: "Design Your Tote Rack & Get Custom Build Plans",
    description: DESCRIPTION,
    url: "/plans/checkout",
    type: "website",
    siteName: "Storage Network",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Design Your Tote Rack & Get Custom Build Plans",
    description: DESCRIPTION,
  },
};

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "DIY Build Plans", path: "/plans" },
  { name: "Design Your Tote Rack", path: "/plans/checkout" },
]);

export default function PlansCheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {children}
    </>
  );
}
