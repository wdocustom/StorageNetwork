import type { Metadata } from "next";

// Token-gated purchase page: keep it out of search results. Crawlable (not
// blocked in robots) so search engines can see this noindex.
export const metadata: Metadata = {
  title: "Your Build Plans | Storage Network",
  robots: { index: false, follow: false },
  // Don't inherit the root layout's canonical ("/") — that points the page at the homepage.
  alternates: { canonical: null },
};

export default function GatedPlansLayout({ children }: { children: React.ReactNode }) {
  return children;
}
