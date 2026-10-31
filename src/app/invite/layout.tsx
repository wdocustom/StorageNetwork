import type { Metadata } from "next";
import { PRO_FREE_PROMO, PRO_MONTHLY_PRICE } from "@/config/pro-pricing";

export const metadata: Metadata = {
  title: `Join Storage Network | Build Tote Storage & Get Paid — ${PRO_FREE_PROMO ? "Pro Free for a Limited Time" : "Free Trial"}`,
  description:
    `Start building tote storage systems for pre-sold customers. ${PRO_FREE_PROMO ? `Pro is free right now (normally $${PRO_MONTHLY_PRICE}/mo) — no credit card.` : "Free trial — 3 jobs, no credit card."} Automated cut plans, Stripe payouts, branded portfolio page, AI marketing tools, and tiered priority territory.`,
  keywords: [
    "become a storage installer", "tote rack installer", "garage storage business",
    "handyman side hustle", "carpentry jobs", "storage network installer",
  ],
  openGraph: {
    title: "Join Storage Network | Build Storage & Get Paid",
    description: `Pre-sold garage storage jobs. Cut lists included. No selling. Just build & get paid. ${PRO_FREE_PROMO ? "Pro is free for a limited time." : "Free trial."}`,
  },
  alternates: { canonical: "https://storage-network.app/invite" },
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
