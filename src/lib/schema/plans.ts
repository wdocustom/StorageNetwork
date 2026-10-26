// ═══════════════════════════════════════════════════════════════════════════
// DIY Plans Storefront — FAQ content + JSON-LD (Product, FAQPage)
//
// Every price and dimension is read from the plan constants so the copy,
// the rendered FAQ and the structured data can't drift from what checkout
// actually charges and what the plans actually build.
// ═══════════════════════════════════════════════════════════════════════════

import { PUBLIC_PLANS } from "@/lib/plans-config";
import {
  BAY_OPENING_IN,
  MODULE_MAX_COLS,
  MODULE_MAX_ROWS,
  TOTE_PLAN_LIMITS,
  TOTE_PLAN_TIERS,
  TOTE_PLAN_UPGRADE_PRICE,
  formatPlanPrice,
} from "@/lib/tote-plans";
import {
  LADDER_JIG_NAME,
  LADDER_JIG_OWNER_PRICE,
  LADDER_JIG_PRICE,
  LADDER_JIG_TAGLINE,
} from "@/lib/ladder-jig";

const BASE = "https://storage-network.app";
const ORGANIZATION_ID = `${BASE}/#organization`;

export const PLANS_PRICES = {
  pdf: formatPlanPrice(TOTE_PLAN_TIERS.pdf.price),
  interactive: formatPlanPrice(TOTE_PLAN_TIERS.interactive.price),
  upgrade: formatPlanPrice(TOTE_PLAN_UPGRADE_PRICE),
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
    answer: `27-gallon HDX totes from Home Depot and 27-gallon Greenmade totes from Costco. Every bay is a ${BAY_OPENING_IN}" opening between 2×4 uprights, which fits both brands, and each tote hangs by its rim on a pair of 2×4 rails so it slides in and out like a drawer.`,
  },
  {
    question: "What's the difference between the PDF plan and the interactive 3D guide?",
    answer: `The PDF Build Plan (${PLANS_PRICES.pdf}) is a printable plan for your exact size: every assembly step rendered in 3D, a shopping list with exact quantities, board-by-board cut diagrams including the 2×4 rail rips, and a tools checklist. The Interactive Build Guide (${PLANS_PRICES.interactive}) includes the PDF plus lifetime access to the interactive 3D assembly guide our pro installers build from. You can rotate, zoom and step through it on your phone in the garage.`,
  },
  {
    question: "Can I upgrade from the PDF to the interactive guide later?",
    answer: `Yes. If you bought the PDF plan, you can upgrade to the interactive 3D guide for the ${PLANS_PRICES.upgrade} difference. The link is on your plan page.`,
  },
  {
    question: "How big a tote rack can I build?",
    answer: `Any size from 1×1 up to ${TOTE_PLAN_LIMITS.maxCols} totes wide by ${TOTE_PLAN_LIMITS.maxRows} totes high per unit, and up to ${TOTE_PLAN_LIMITS.maxUnits} units in one plan. Big walls are split into self-contained modules (up to ${MODULE_MAX_COLS} totes wide and ${MODULE_MAX_ROWS} high) so every part comes out of standard 8' 2×4s. Identical modules share a type, so you learn each one once and repeat it.`,
  },
  {
    question: "Do the plans include a cut list and shopping list?",
    answer: "Yes. Each plan is generated for your build, with a shopping list of exact quantities, board-by-board cut diagrams for every 2×4 (including how to rip the rails), fastener callouts, and a tools checklist.",
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
    question: "Are these tote rack plans free?",
    answer: `Sizing your build and previewing it in 3D is free. The plan itself is a one-time purchase of ${PLANS_PRICES.pdf} for the PDF or ${PLANS_PRICES.interactive} with the interactive guide, generated for exactly the size you designed.`,
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

export function totePlansProductJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${BASE}/plans#tote-organizer-plans`,
    name: "DIY Tote Rack Plans: Custom-Size Tote Organizer",
    description: `Build plans for a 2×4 tote storage rack sized to your wall, for 27-gallon HDX and Greenmade totes. Cut list, shopping list and every assembly step in 3D. PDF ${PLANS_PRICES.pdf}, or ${PLANS_PRICES.interactive} with the interactive 3D build guide.`,
    image: [`${BASE}/hero-rack.webp`],
    category: "DIY Woodworking Plans",
    brand: { "@id": ORGANIZATION_ID },
    url: `${BASE}/plans`,
    offers: [
      offer(TOTE_PLAN_TIERS.pdf.name, TOTE_PLAN_TIERS.pdf.price, `${BASE}/plans/checkout`),
      offer(TOTE_PLAN_TIERS.interactive.name, TOTE_PLAN_TIERS.interactive.price, `${BASE}/plans/checkout`),
    ],
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

export function publicPlanProductsJsonLd() {
  return PUBLIC_PLANS.map((plan) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${BASE}/plans#${plan.id}`,
    name: `${plan.name} Plans`,
    description: `${plan.tagline} ${plan.includes.join(". ")}.`,
    image: [`${BASE}${plan.previewImage}`],
    category: "DIY Woodworking Plans",
    brand: { "@id": ORGANIZATION_ID },
    url: `${BASE}/plans`,
    offers: offer(`${plan.name} Plans`, plan.price, `${BASE}/plans`),
  }));
}
