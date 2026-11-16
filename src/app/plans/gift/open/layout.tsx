import type { Metadata } from "next";

// The recipient's gift page (access token in the URL): keep it out of
// search results and don't send its URL to other sites.
export const metadata: Metadata = {
  title: "A Gift for You | Storage Network",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
  referrer: "no-referrer",
};

export default function GiftOpenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
