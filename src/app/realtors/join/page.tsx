import type { Metadata } from "next";
import RealtorJoinPageClient from "./RealtorJoinPageClient";

// ═══════════════════════════════════════════════════════════════════════════
// /realtors/join — server wrapper so we can export metadata + JSON-LD
// around the existing "use client" signup page. The client component
// owns the signup form + the visible FAQ section; this server shell's
// only job is SEO.
//
// Keyword strategy — note: unlike the homeowner side, this keyword set
// isn't validated by a paid campaign. Picks are based on intent
// patterns (realtors searching for closing-gift ideas, moving-tote
// rental, etc.). Once the realtor product has its own Search Ads
// campaign running, prune this list against actual converter data.
// ═══════════════════════════════════════════════════════════════════════════

export const metadata: Metadata = {
  title:
    "Realtor Closing Gifts — Reusable Moving Tote Rentals | Storage Network",
  description:
    "The closing gift that gets remembered. Storage Network sends 20–50 reusable moving totes to your buyer or seller — delivered and picked up by a local pro. Free realtor account, no subscription, only pay when you send.",
  keywords: [
    // Core realtor / closing gift intent
    "real estate closing gifts",
    "realtor closing gifts",
    "closing gift for buyers",
    "closing gift for sellers",
    "closing gift ideas",
    "realtor closing gift ideas",
    "best closing gifts",
    "unique closing gifts",
    "closing gift for new homeowners",
    "realtor gift",
    // Moving tote / rental intent (high-volume adjacent)
    "moving tote rental",
    "reusable moving boxes",
    "rent moving totes",
    "moving box rental",
    "plastic moving boxes",
    "reusable moving box rental",
    "moving tote service",
    // Platform / brand
    "storage network closing gift",
    "realtor marketing gift",
    "realtor branded gift",
  ],
  alternates: {
    canonical: "/realtors/join",
  },
  openGraph: {
    title:
      "Realtor Closing Gifts — Reusable Moving Tote Rentals | Storage Network",
    description:
      "The smartest closing gift on the market. Reusable moving totes delivered to your buyer or seller before the move and picked up after — no cardboard, no mess.",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

// FAQPage schema — must mirror the visible FAQ section on the client
// page (Google penalizes FAQPage that isn't actually on the page).
// If you edit the visible Q&A in RealtorJoinPageClient.tsx, update
// these answer strings to match.
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What's the best closing gift for buyers right now?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The closing gifts that get remembered are the ones that arrive when your client is using them — and nobody's using a wine glass during their move. Reusable moving totes show up before the move-in date, get filled, get returned. Your name is the one they think of every time they pack a box.",
      },
    },
    {
      "@type": "Question",
      name: "How much should a realtor spend on a closing gift?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most agents land between $100 and $400 depending on commission size and relationship. Storage Network packages start around $200 for a 20-tote starter and run up to $500 for a 50-tote premium move — priced per-package, no subscription, only pay when you send.",
      },
    },
    {
      "@type": "Question",
      name: "Are reusable moving totes actually a good closing gift?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "They're a closing gift that doubles as a service. Buyers and sellers consistently rank moving as the most stressful part of the transaction; handing them 20–50 stackable, reusable totes plus a local pro who delivers and picks them up removes the worst part of the day they remember you for.",
      },
    },
    {
      "@type": "Question",
      name: "When should I send the closing gift — at signing or before move-in?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Send the gift link as soon as you've got a closing date. The recipient picks their own delivery window through the link, so the totes show up the week of the move, not the week of the signature.",
      },
    },
    {
      "@type": "Question",
      name: "What if my client is in a city where you don't have an installer?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We confirm coverage at checkout — if no installer covers the delivery ZIP, the gift won't go through and you won't be charged. Coverage is expanding monthly, but you can always check a specific area before committing.",
      },
    },
  ],
};

// Service schema — closing-gift / moving-tote-rental product framed
// in schema.org's Service vocabulary so the offering can be matched
// against intent-rich queries beyond pure keyword density.
const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Realtor Closing Gift — Reusable Moving Tote Rental",
  serviceType: "Real Estate Closing Gift",
  provider: {
    "@type": "Organization",
    name: "Storage Network",
    url: "https://storage-network.app",
  },
  audience: {
    "@type": "BusinessAudience",
    audienceType: "Real Estate Agents and Brokers",
  },
  description:
    "Realtors send a closing gift of 20–50 reusable moving totes to their buyer or seller. A local pro delivers the totes before the move and picks them up after — no cardboard, no follow-up, only pay when you send.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "200",
    highPrice: "500",
    offerCount: "4",
    description:
      "Starter (20 totes), Standard (30), Pro (40), and Premium (50). 7- or 14-day rental windows. Pricing matches the published catalog.",
  },
};

export default function RealtorJoinPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <RealtorJoinPageClient />
    </>
  );
}
