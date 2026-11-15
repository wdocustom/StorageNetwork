import type { Metadata } from "next";

// Token-gated buyer page: keep it out of search results.
export const metadata: Metadata = {
  title: "Smart Inventory | Storage Network",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function DiyInventoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
