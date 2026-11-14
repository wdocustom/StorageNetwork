import type { Metadata } from "next";

// Token-gated purchase page: keep it out of search results.
export const metadata: Metadata = {
  title: "Your Build Plan | Storage Network",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function PurchasedPlanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
