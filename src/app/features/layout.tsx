import type { Metadata } from "next";
import { generateBreadcrumbJsonLd } from "@/lib/schema/breadcrumb";
import { PRO_FREE_PROMO, PRO_MONTHLY_PRICE } from "@/config/pro-pricing";

export const metadata: Metadata = {
  title: PRO_FREE_PROMO
    ? "Features & Pricing | Storage Network — Pro Is Free for a Limited Time"
    : `Features & Pricing | Storage Network — $${PRO_MONTHLY_PRICE}/mo Installer Platform`,
  description:
    `Everything included in one plan: 3D configurator, auto-generated cut plans, material lists, built-in scheduling, Stripe payments, portfolio page, and pre-sold network leads. ${PRO_FREE_PROMO ? `Free right now (normally $${PRO_MONTHLY_PRICE}/mo)` : `$${PRO_MONTHLY_PRICE}/mo`} + low maintenance fees.`,
  alternates: {
    canonical: "/features",
  },
  keywords: [
    "tote rack installer platform",
    "garage storage business software",
    "installer pricing",
    "3D configurator subscription",
    "storage network features",
    "contractor scheduling software",
    "home improvement installer tools",
  ],
  openGraph: {
    title: "Features & Pricing | Storage Network",
    description:
      `One plan, everything included. 3D configurator, automated cut plans, scheduling, payments, and pre-sold leads — ${PRO_FREE_PROMO ? `free for a limited time (normally $${PRO_MONTHLY_PRICE}/mo)` : `$${PRO_MONTHLY_PRICE}/mo`}.`,
    type: "website",
  },
};

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Features & Pricing", path: "/features" },
]);

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
