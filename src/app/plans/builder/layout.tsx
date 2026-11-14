import type { Metadata } from "next";

// The Custom Builder (and the share, marketplace and purchased-plan pages
// under it) is in preview: reachable by its address, not yet linked from
// the plans pages and kept out of search results. Crawlable (not blocked in robots) so search
// engines can see this noindex.
export const metadata: Metadata = {
  title: "Custom Storage Builder | Storage Network",
  description: "Design your own shelving, workbench or storage system from 2×4s and plywood, in 2D and 3D.",
  robots: { index: false, follow: false },
  // Don't inherit the root layout's canonical ("/") — that points the page at the homepage.
  alternates: { canonical: null },
};

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
