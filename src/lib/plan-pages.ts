// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC PLAN PAGES — /plans/[slug] content for fixed-price plans
//
// Facts come from the plan itself (private/<htmlFile>): lumber, hardware,
// tools, parts and step names. Part dimensions and the point-to-point cut
// profiles are what the buyer pays for, so they stay off the public page.
// ═══════════════════════════════════════════════════════════════════════════

import { getPlanById, type PublicPlan } from "@/lib/plans-config";

export interface PlanPageStep {
  title: string;
  summary: string;
  image: string;
  imageAlt: string;
}

export interface PlanPageContent {
  slug: string;
  planId: string;
  /** <title> */
  seoTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  keywords: string[];
  lumber: { qty: number; name: string }[];
  hardware: string[];
  tools: string[];
  parts: { name: string; qty: number; from: string }[];
  steps: PlanPageStep[];
  faqs: { question: string; answer: string }[];
}

const CHAIR_IMG = "/images/chair-plans";

const PLAN_PAGES: PlanPageContent[] = [
  {
    slug: "adirondack-chair",
    planId: "adirondack-chair",
    seoTitle: "Low Adirondack Chair Plans (2×6 Build, PDF Cut List) | Storage Network",
    metaDescription:
      "Low boy Adirondack chair plans built from five 2×6s and one 2×8: full cut list, point-to-point cut profiles with exact angles, and a 6-step photo assembly guide with pocket-hole layout. $18, instant access.",
    h1: "Low Boy Adirondack Chair Plans",
    intro:
      "A low-slung Adirondack chair built from standard dimensional lumber: five 2×6×8' boards and one 2×8×8'. The plan gives you the full cut list, point-to-point cut profiles with every mark and angle for the base, legs, arm rests and back supports, pocket-hole layouts, and a 6-step photo assembly guide.",
    keywords: [
      "adirondack chair plans",
      "low adirondack chair plans",
      "low boy adirondack chair plans",
      "2x6 adirondack chair plans",
      "adirondack chair plans PDF",
      "adirondack chair cut list",
      "pocket hole adirondack chair",
    ],
    lumber: [
      { qty: 5, name: "2×6 × 8' dimensional lumber" },
      { qty: 1, name: "2×8 × 8' dimensional lumber" },
    ],
    hardware: [
      '2-1/2" exterior pocket hole screws',
      '2" exterior deck screws',
      '3" exterior deck screws',
      '2" lag screws',
      "Titebond III outdoor wood glue",
    ],
    tools: ["Pocket hole jig (Kreg)", "Miter saw", "Jigsaw", '1/4" spacer block'],
    parts: [
      { name: "Seat & back slats", qty: 6, from: "2×6" },
      { name: "Chair legs", qty: 2, from: "2×6" },
      { name: "Chair base (side rails)", qty: 2, from: "2×8" },
      { name: "Back supports", qty: 2, from: "ripped 2×6" },
      { name: "Arm rests", qty: 2, from: "ripped 2×6" },
    ],
    steps: [
      {
        title: "Drill the pocket holes",
        summary: "Pocket holes in the back supports and on the hidden face of all six slats.",
        image: `${CHAIR_IMG}/step-1-pocket-holes.png`,
        imageAlt: "Step 1: drilling pocket holes in the Adirondack chair slats and back supports",
      },
      {
        title: "Attach the back supports to the base",
        summary: "Glue and pocket-screw each back support to its chair base.",
        image: `${CHAIR_IMG}/step-2-attach-support.png`,
        imageAlt: "Step 2: attaching the back support to the angled 2×8 chair base",
      },
      {
        title: "Install the back slats",
        summary: "Three slats across the supports, gapped with a 1/4\" spacer block.",
        image: `${CHAIR_IMG}/step-3-back-slats.png`,
        imageAlt: "Step 3: installing three back slats with even spacer gaps",
      },
      {
        title: "Install the seat slats",
        summary: "Flip the chair and fit the remaining three slats flush with the base.",
        image: `${CHAIR_IMG}/step-4-seat-slats.png`,
        imageAlt: "Step 4: installing the seat slats flush with the top of the base",
      },
      {
        title: "Attach the legs",
        summary: "Lean the chair back on its angled base and fasten the front legs.",
        image: `${CHAIR_IMG}/step-5-legs.png`,
        imageAlt: "Step 5: attaching the front legs to the low Adirondack chair base",
      },
      {
        title: "Finish with the arm rests",
        summary: "Arm rests over the legs and back supports, lagged at the rear for strength.",
        image: `${CHAIR_IMG}/step-6-armrests.png`,
        imageAlt: "Step 6: fastening the arm rests to the front legs and back supports",
      },
    ],
    faqs: [
      {
        question: "What lumber do I need for this Adirondack chair?",
        answer:
          "Five 2×6 × 8' boards and one 2×8 × 8' board of standard dimensional lumber. The 2×8 becomes the two angled side bases; the 2×6s become the slats, legs, back supports and arm rests.",
      },
      {
        question: "What tools do I need?",
        answer:
          "A pocket hole jig such as a Kreg, a miter saw, a jigsaw for the curved cuts and radii, a drill/driver, and a 1/4\" spacer block for even slat gaps.",
      },
      {
        question: "What makes this a low boy Adirondack chair?",
        answer:
          "The angled 2×8 base sets the seat low and reclined, so the chair leans back on its rear cut. It's a lounge-height chair rather than a dining-height one.",
      },
      {
        question: "What's in the plan?",
        answer:
          "A prep and master cut list with every part's quantity, lumber and dimensions; point-to-point cut profiles with exact marks for the chair base, legs, arm rests and back supports; pocket hole layout; and a 6-step photo assembly guide.",
      },
      {
        question: "How do I get the plans?",
        answer:
          "Checkout is a one-time payment. You get instant access, and we email you a permanent link. If you lose it, request a new one with your purchase email on the plans page.",
      },
      {
        question: "Can I use it outdoors?",
        answer:
          "Yes. The hardware list calls for exterior pocket hole screws, exterior deck screws and Titebond III, an outdoor-rated wood glue.",
      },
    ],
  },
];

export function getPlanPage(slug: string): { page: PlanPageContent; plan: PublicPlan } | null {
  const page = PLAN_PAGES.find((p) => p.slug === slug);
  const plan = page && getPlanById(page.planId);
  return page && plan ? { page, plan } : null;
}

export function planPageSlugs(): string[] {
  return PLAN_PAGES.filter((p) => getPlanById(p.planId)).map((p) => p.slug);
}

export function planPageHref(planId: string): string | null {
  const page = PLAN_PAGES.find((p) => p.planId === planId);
  return page ? `/plans/${page.slug}` : null;
}
