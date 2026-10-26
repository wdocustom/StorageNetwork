import type { Metadata } from "next";
import { LADDER_JIG_NAME } from "@/lib/ladder-jig";
import { generateBreadcrumbJsonLd } from "@/lib/schema/breadcrumb";
import { PLANS_PRICES, ladderJigProductJsonLd } from "@/lib/schema/plans";

// The offer, Stripe return and purchased guide all live on /plans/jig (by
// query param), so render per request: the offer copy then reaches the
// server HTML instead of a CSR-bailout spinner.
export const dynamic = "force-dynamic";

const DESCRIPTION = `Plans for a ladder building jig that makes every tote rack ladder frame square and identical: one sheet of OSB and three 2×4s, with every 2×4 rail line marked. ${PLANS_PRICES.jig}, or ${PLANS_PRICES.jigOwner} with a tote organizer plan.`;

export const metadata: Metadata = {
  title: `${LADDER_JIG_NAME} Plans for 2×4 Tote Racks | Storage Network`,
  description: DESCRIPTION,
  alternates: {
    canonical: "/plans/jig",
  },
  openGraph: {
    title: `${LADDER_JIG_NAME} Plans for 2×4 Tote Racks`,
    description: DESCRIPTION,
    url: "/plans/jig",
    type: "website",
    siteName: "Storage Network",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${LADDER_JIG_NAME} Plans for 2×4 Tote Racks`,
    description: DESCRIPTION,
  },
};

const jsonLd = [
  generateBreadcrumbJsonLd([
    { name: "DIY Build Plans", path: "/plans" },
    { name: LADDER_JIG_NAME, path: "/plans/jig" },
  ]),
  ladderJigProductJsonLd(),
];

export default function LadderJigLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {jsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      {children}
    </>
  );
}
