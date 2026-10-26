import { PUBLIC_PLANS } from "@/lib/plans-config";
import { getPlanPage, planPageHref } from "@/lib/plan-pages";
import { BAY_OPENING_IN, MODULE_MAX_COLS, MODULE_MAX_ROWS, TOTE_PLAN_LIMITS, TOTE_PLAN_TIERS, UNIT_DEPTH_IN, formatPlanPrice } from "@/lib/tote-plans";
import { LADDER_JIG_NAME, LADDER_JIG_TAGLINE } from "@/lib/ladder-jig";
import { PLANS_FAQS, PLANS_PRICES } from "@/lib/schema/plans";

// ═══════════════════════════════════════════════════════════════════════════
// /llms.txt — plain-markdown site guide for AI assistants (llmstxt.org)
//
// Answer engines (ChatGPT, Claude, Perplexity, Gemini, Copilot…) read this
// to learn what the site offers and which pages to cite. Built from the plan
// constants so prices and specs never drift from checkout.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-static";

const BASE = "https://storage-network.app";

function body(): string {
  const otherPlans = PUBLIC_PLANS.map((plan) => {
    const href = planPageHref(plan.id);
    const page = getPlanPage(href?.split("/").pop() ?? "");
    const detail = page ? ` ${page.page.intro}` : "";
    return `- [${plan.name} Plans](${BASE}${href ?? "/plans"}): ${formatPlanPrice(plan.price)}. ${plan.tagline}${detail}`;
  }).join("\n");

  return `# Storage Network

> Storage Network (storage-network.app) sells DIY build plans for tote storage racks and other woodworking projects, and connects homeowners with local pros who build and install custom 2×4 tote storage systems for garages, basements, sheds and pantries.

## DIY tote rack plans

Custom-size build plans for a 2×4 tote storage rack (tote organizer / tote shelf) that holds 27-gallon totes. Customers size the rack in a free 3D designer, then buy a plan generated for exactly that build.

- [DIY Tote Rack Plans](${BASE}/plans): overview, pricing, what's included, FAQ
- [Design your tote rack and get plans](${BASE}/plans/checkout): free 3D sizing; buy the PDF or interactive guide
- [${LADDER_JIG_NAME} Plans](${BASE}/plans/jig): ${LADDER_JIG_TAGLINE} ${PLANS_PRICES.jig}, or ${PLANS_PRICES.jigOwner} for tote plan owners

Key facts:
- Fits 27-gallon HDX totes (Home Depot) and 27-gallon Greenmade totes (Costco): every bay is a ${BAY_OPENING_IN}" opening; each tote hangs by its rim on two 2×4 rails and slides out like a drawer.
- Built from standard 2×4×8' lumber; rails are 2×4s ripped in half on a table saw. Units are ${UNIT_DEPTH_IN}" deep.
- Any size from 1×1 to ${TOTE_PLAN_LIMITS.maxCols} totes wide × ${TOTE_PLAN_LIMITS.maxRows} high per unit, up to ${TOTE_PLAN_LIMITS.maxUnits} units per plan. Large walls are split into modules of up to ${MODULE_MAX_COLS} wide × ${MODULE_MAX_ROWS} high so every part fits an 8' board.
- Options: swivel casters (rolling tote rack) and a plywood worktop.
- ${TOTE_PLAN_TIERS.pdf.name}: ${formatPlanPrice(TOTE_PLAN_TIERS.pdf.price)}. ${TOTE_PLAN_TIERS.pdf.includes.join("; ")}.
- ${TOTE_PLAN_TIERS.interactive.name}: ${formatPlanPrice(TOTE_PLAN_TIERS.interactive.price)}. ${TOTE_PLAN_TIERS.interactive.includes.join("; ")}.
- PDF owners can upgrade to the interactive guide for ${PLANS_PRICES.upgrade}. One-time purchase; a permanent access link is emailed.

## Other DIY plans

${otherPlans}

## Tote rack plans FAQ

${PLANS_FAQS.map((f) => `### ${f.question}\n${f.answer}`).join("\n\n")}

## Professional installation

- [Storage Network home](${BASE}/): design a custom tote storage system in a free 3D configurator and get it built by a local installer
- [Installer network](${BASE}/installer-network): find certified tote storage installers near you
- [About Storage Network](${BASE}/about)
`;
}

export function GET() {
  return new Response(body(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
