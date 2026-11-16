import type { Metadata } from "next";

// Private order page (session id / manage token in the URL): keep it out of
// search results and don't send its URL to other sites.
export const metadata: Metadata = {
  title: "Your Gift | Storage Network",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
  referrer: "no-referrer",
};

export default function GiftSentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
