import type { Metadata } from "next";
import { generateBreadcrumbJsonLd } from "@/lib/schema/breadcrumb";

export const metadata: Metadata = {
  title: "Become a Storage Network Installer | Join the Network",
  description:
    "Join Storage Network and get pre-sold tote rack installation jobs in your area. 3D configurator, automated cut plans, built-in scheduling, and Stripe payments — everything you need to run a professional storage installation business.",
  alternates: {
    canonical: "/join",
  },
  keywords: [
    "become tote rack installer",
    "garage storage installer signup",
    "storage network join",
    "home improvement contractor platform",
    "tote rack business opportunity",
  ],
  openGraph: {
    title: "Become a Storage Network Installer",
    description:
      "Get pre-sold jobs, automated tools, and everything you need to build a professional tote rack installation business.",
    type: "website",
  },
};

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Join", path: "/join" },
]);

export default function JoinLayout({
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
