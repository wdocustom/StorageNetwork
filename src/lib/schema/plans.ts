// ═══════════════════════════════════════════════════════════════════════════
// DIY Plans Storefront — FAQ content + JSON-LD (Product, FAQPage)
//
// Every price and dimension is read from the plan constants so the copy,
// the rendered FAQ and the structured data can't drift from what checkout
// actually charges and what the plans actually build.
// ═══════════════════════════════════════════════════════════════════════════

import { aggregateRatingJsonLd } from "@/lib/reviews";
import { PUBLIC_PLANS, type PublicPlan } from "@/lib/plans-config";
import { planPageHref, type PlanPageContent } from "@/lib/plan-pages";
import {
  BAY_OPENING_IN,
  MODULE_MAX_COLS,
  MODULE_MAX_ROWS,
  TOTE_PLAN_LIMITS,
  TOTE_PLAN_ALL_ACCESS,
  TOTE_PLAN_MINI,
  formatPlanPrice,
} from "@/lib/tote-plans";
import { MINI, miniMaxModuleCols, miniMaxRowsPerTier } from "@/lib/mini-rack";
import {
  LADDER_JIG_NAME,
  LADDER_JIG_OWNER_PRICE,
  LADDER_JIG_PRICE,
  LADDER_JIG_TAGLINE,
} from "@/lib/ladder-jig";

const BASE = "https://storage-network.app";
const ORGANIZATION_ID = `${BASE}/#organization`;

export const PLANS_PRICES = {
  /** All-Access tote plans: one payment, unlimited plans, for life */
  allAccess: formatPlanPrice(TOTE_PLAN_ALL_ACCESS.price),
  /** Mini Tote Rack Plans (6.5 qt): one payment, every mini size, for life */
  mini: formatPlanPrice(TOTE_PLAN_MINI.price),
  miniOwner: formatPlanPrice(TOTE_PLAN_MINI.ownerPrice),
  /** The lowest price on the page */
  from: formatPlanPrice(Math.min(TOTE_PLAN_MINI.price, TOTE_PLAN_ALL_ACCESS.price)),
  jig: formatPlanPrice(LADDER_JIG_PRICE),
  jigOwner: formatPlanPrice(LADDER_JIG_OWNER_PRICE),
};

export interface PlansFaq {
  question: string;
  answer: string;
}

export const PLANS_FAQS: PlansFaq[] = [
  {
    question: "What totes do these tote rack plans fit?",
    answer: `Two sizes. Full-size racks take 27-gallon totes: every bay is a universal ${BAY_OPENING_IN}" opening between 2×4 uprights that should fit most brands (HDX, Greenmade and others), with each tote hanging by its rim on two rails so it slides out like a drawer. Mini racks take HDX 6.5 qt totes in ${MINI.opening}" bays. Either way, double-check your totes' measurements before you build.`,
  },
  {
    question: "What's the difference between the full-size and Mini plans?",
    answer: `They're two separate systems. Full-size plans (${PLANS_PRICES.allAccess}) are for 27-gallon totes: a 2×4 frame for garages, sheds and basements, with casters, a worktop and a sideways option. Mini Tote Rack Plans (${PLANS_PRICES.mini}, or ${PLANS_PRICES.miniOwner} if you own the full-size plans) are for 6.5 qt totes: a lighter 2×3 and plywood frame for closets, craft rooms, workshops and shelves. Each one covers every size of its own rack, for life.`,
  },
  {
    question: "What does All-Access include?",
    answer: `One payment of ${PLANS_PRICES.allAccess} gets you lifetime All-Access: build plans for every tote organizer you design, not just one size. Each plan comes with the interactive 3D build guide (rotate, zoom and step through it on your phone in the garage) and a printable PDF with every assembly step, a shopping list with exact quantities, board-by-board cut diagrams including the 2×4 rail rips, and a tools checklist.`,
  },
  {
    question: "Can I make plans for more than one size?",
    answer: `Yes, as many as you like, within the system you bought. After your first plan, open it and tap "Build another plan": design a new size and its plan is generated at no charge. Full-size plans cover every 27-gallon rack you design; Mini plans cover every 6.5 qt mini rack. Your garage, your shed, a craft-room closet: every size is included, for life.`,
  },
  {
    question: "How big a tote rack can I build?",
    answer: `Full-size: any size from 1×1 up to ${TOTE_PLAN_LIMITS.maxCols} totes wide by ${TOTE_PLAN_LIMITS.maxRows} high per unit, and up to ${TOTE_PLAN_LIMITS.maxUnits} units in one plan. Mini: up to ${TOTE_PLAN_LIMITS.maxRowsMini} totes high. Big walls are split into self-contained modules (full-size up to ${MODULE_MAX_COLS} wide and ${MODULE_MAX_ROWS} high; mini up to ${miniMaxModuleCols()} wide and ${miniMaxRowsPerTier()} high) so every part comes out of a standard 8' board. Identical modules share a type, so you learn each one once and repeat it.`,
  },
  {
    question: "Do the plans include a cut list and shopping list?",
    answer: "Yes. Each plan is generated for your build, with a shopping list of exact quantities, board-by-board cut diagrams for every 2×4 (including how to rip the rails), fastener callouts, and a tools checklist.",
  },
  {
    question: "Can I build a tote rack for a shallow wall?",
    answer: `Yes. Choose Sideways in the designer: each tote turns 90° so its long side faces out, and the rack is only 20" deep instead of 30". Bays widen to 30-1/4", so a sideways rack is wider for the same number of totes, and it's built in modules up to 2 totes wide so every plate still comes out of an 8' 2×4. The 3D guide, cut list and PDF all follow the sideways build.`,
  },
  {
    question: "Can I put my tote rack on casters?",
    answer: `Yes, rolling tote racks are a design option. A unit up to 8' long rolls on 4 swivel casters, one at each corner. Longer units get 6, plus another pair for every extra 48" of length, each placed under an upright. The plan shows where each caster goes.`,
  },
  {
    question: "What tools do I need to build it?",
    answer: "A miter saw or circular saw for crosscuts, a table saw to rip the 2×4 rails, a drill/driver with a T-25 star bit, a speed square, a tape measure, clamps, plus safety glasses and a push stick for the rips. If you can make square cuts and rip a 2×4, you can build it. The plan walks through every step.",
  },
  {
    question: "What is the ladder jig, and do I need it?",
    answer: `${LADDER_JIG_NAME}: a plan for a simple OSB jig with every rail line marked. Lay two uprights in it, set each rail on its line and screw, so every ladder frame comes out identical and the whole rack goes together square. It's optional: ${PLANS_PRICES.jig}, or ${PLANS_PRICES.jigOwner} if you own a tote organizer plan.`,
  },
  {
    question: "How do I get my plans after I buy?",
    answer: "Right after checkout you land on your plan, and we email you a permanent link. Buy once and it's yours for good. If you lose the link, enter your purchase email on the plans page and we'll resend it.",
  },
  {
    question: "Can I get a refund?",
    answer: "No. Plans are digital and you get full access the moment payment is confirmed, so all sales are final. Before you buy, design your rack free in 3D and open the sample 3D guide and PDF to see exactly what you'll get.",
  },
  {
    question: "Are these tote rack plans free?",
    answer: `Sizing your build and previewing it in 3D is free. Plans are a one-time payment with no subscription: ${PLANS_PRICES.mini} for Mini racks (6.5 qt totes) or ${PLANS_PRICES.allAccess} for full-size racks (27-gallon totes). Each covers the size you designed and every rack of that system you design after it, with the 3D guide and the PDF.`,
  },
];

export function plansFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PLANS_FAQS.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

function offer(name: string, cents: number, url: string) {
  return {
    "@type": "Offer",
    name,
    price: (cents / 100).toFixed(2),
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url,
    seller: { "@id": ORGANIZATION_ID },
  };
}

/** Product.aggregateRating + a few Product.review entries, from published plan reviews. */
export interface ProductReviewsLd {
  summary: { average: number; total: number };
  reviews: { name: string; rating: number; headline: string | null; comment: string | null }[];
}

function reviewsLd(r?: ProductReviewsLd) {
  if (!r || !r.summary.total) return {};
  return {
    aggregateRating: aggregateRatingJsonLd(r.summary),
    review: r.reviews
      .filter((x) => x.comment || x.headline)
      .slice(0, 5)
      .map((x) => ({
        "@type": "Review",
        author: { "@type": "Person", name: x.name },
        reviewRating: { "@type": "Rating", ratingValue: x.rating, bestRating: 5, worstRating: 1 },
        ...(x.headline ? { name: x.headline } : {}),
        ...(x.comment ? { reviewBody: x.comment } : {}),
      })),
  };
}

export function totePlansProductJsonLd(reviews?: ProductReviewsLd) {
  return {
    ...reviewsLd(reviews),
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${BASE}/plans#tote-organizer-plans`,
    name: "DIY Tote Rack Plans: Custom-Size Tote Organizer",
    description: `Build plans for 2×4 tote storage racks sized to your wall, for 27-gallon HDX and Greenmade totes. Cut list, shopping list and every assembly step in 3D, with the interactive 3D build guide and a printable PDF. ${PLANS_PRICES.allAccess} once for unlimited plans: every size you design, for life.`,
    image: [`${BASE}/hero-rack.webp`],
    category: "DIY Woodworking Plans",
    brand: { "@id": ORGANIZATION_ID },
    url: `${BASE}/plans`,
    offers: [
      offer(TOTE_PLAN_ALL_ACCESS.name, TOTE_PLAN_ALL_ACCESS.price, `${BASE}/plans/checkout`),
    ],
  };
}

export function miniPlansProductJsonLd(reviews?: ProductReviewsLd) {
  return {
    ...reviewsLd(reviews),
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${BASE}/plans#mini-tote-rack-plans`,
    name: "DIY Mini Tote Rack Plans for 6.5 Qt Totes",
    description: `Build plans for mini tote racks sized to your space, for HDX 6.5 qt totes: a 2×3 and plywood frame with ${MINI.opening}" bays, cut list, shopping list and every step in 3D, plus a printable PDF. ${PLANS_PRICES.mini} once for every mini size you design, for life (${PLANS_PRICES.miniOwner} for full-size plan owners).`,
    category: "DIY Woodworking Plans",
    brand: { "@id": ORGANIZATION_ID },
    url: `${BASE}/plans/mini`,
    offers: [offer(TOTE_PLAN_MINI.name, TOTE_PLAN_MINI.price, `${BASE}/plans/mini`)],
  };
}

export function ladderJigProductJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${BASE}/plans/jig#product`,
    name: `${LADDER_JIG_NAME} Plans`,
    description: `${LADDER_JIG_TAGLINE} Plans for an OSB ladder jig with every 2×4 rail line marked, for building tote rack ladder frames. ${PLANS_PRICES.jigOwner} for tote organizer plan owners.`,
    category: "DIY Woodworking Plans",
    brand: { "@id": ORGANIZATION_ID },
    url: `${BASE}/plans/jig`,
    offers: offer(`${LADDER_JIG_NAME} Plans`, LADDER_JIG_PRICE, `${BASE}/plans/jig`),
  };
}

function publicPlanProductJsonLd(plan: PublicPlan, description?: string) {
  const url = `${BASE}${planPageHref(plan.id) ?? "/plans"}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: `${plan.name} Plans`,
    description: description ?? `${plan.tagline} ${plan.includes.join(". ")}.`,
    image: [`${BASE}${plan.previewImage}`],
    category: "DIY Woodworking Plans",
    brand: { "@id": ORGANIZATION_ID },
    url,
    offers: offer(`${plan.name} Plans`, plan.price, url),
  };
}

export function publicPlanProductsJsonLd() {
  return PUBLIC_PLANS.map((plan) => publicPlanProductJsonLd(plan));
}

/** Product + FAQPage for a /plans/[slug] page. */
export function planPageJsonLd(page: PlanPageContent, plan: PublicPlan) {
  return [
    publicPlanProductJsonLd(plan, page.metaDescription),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  ];
}

/** Bump when the /plans copy or offers change — read as a freshness signal. */
export const PLANS_UPDATED = "2026-11-16";

export function plansWebPageJsonLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${BASE}/plans#webpage`,
    url: `${BASE}/plans`,
    name: "DIY Tote Rack Plans",
    description,
    dateModified: PLANS_UPDATED,
    inLanguage: "en-US",
    isPartOf: { "@id": `${BASE}/#website` },
    publisher: { "@id": ORGANIZATION_ID },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: [
        `${BASE}/plans#tote-organizer-plans`,
        `${BASE}/plans/jig#product`,
        ...PUBLIC_PLANS.map((plan) => `${BASE}${planPageHref(plan.id) ?? "/plans"}#product`),
      ].map((id, i) => ({ "@type": "ListItem", position: i + 1, item: { "@id": id } })),
    },
  };
}
