import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join Storage Network | Build Tote Storage & Get Paid — Free Trial",
  description:
    "Start building tote storage systems for pre-sold customers. Free trial — 3 jobs, no credit card. Automated cut plans, Stripe payouts, branded portfolio page, AI marketing tools, and tiered priority territory.",
  keywords: [
    "become a storage installer", "tote rack installer", "garage storage business",
    "handyman side hustle", "carpentry jobs", "storage network installer",
  ],
  openGraph: {
    title: "Join Storage Network | Build Storage & Get Paid",
    description: "Pre-sold garage storage jobs. Cut lists included. No selling. Just build & get paid. Free trial.",
  },
  alternates: { canonical: "https://storage-network.app/invite" },
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
