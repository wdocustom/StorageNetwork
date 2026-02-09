import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Become an Installer | Join Storage Network | Earn $50K+/Year",
  description:
    "Join the Storage Network installer program. Get pre-sold jobs with paid deposits, cut lists included, and instant payouts. No sales, no quoting—just build and earn.",
  keywords: [
    "garage organization business",
    "installer network",
    "handyman side hustle",
    "tote storage installer",
    "home organization business",
    "earn money as handyman",
  ],
  openGraph: {
    title: "Become a Certified Tote Storage Installer",
    description:
      "Pre-sold jobs. Cut lists included. Instant payouts. Join the fastest-growing storage installation network.",
    type: "website",
  },
};

// B2B Lead Schema
const jobPostingSchema = {
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Tote Storage Installer - Independent Contractor",
  description:
    "Join Storage Network as an independent installer. Receive pre-sold jobs with paid deposits, complete cut lists, and instant payouts. Flexible schedule, no sales required.",
  employmentType: "CONTRACTOR",
  jobLocationType: "TELECOMMUTE",
  applicantLocationRequirements: {
    "@type": "Country",
    name: "United States",
  },
  hiringOrganization: {
    "@type": "Organization",
    name: "Storage Network",
    sameAs: "https://storage-network.app",
    logo: "https://storage-network.app/logo-storage-network.png",
  },
  jobBenefits:
    "Flexible schedule, no sales or quoting, pre-calculated materials, instant payouts",
  skills: "Basic carpentry, power tool operation, customer service",
  qualifications: "Own transportation, basic tools (miter saw, drill, level)",
};

export default function PartnerJoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema) }}
      />
      {children}
    </>
  );
}
