/**
 * Facebook Ad Copy Generator — Ready-to-use ad variants for Ads Manager
 *
 * Budget: $60 across 3 variants ($20 each, or kill losers and scale winner)
 *
 * Targeting Recommendations:
 * - Job titles: Handyman, Carpenter, General Contractor, Home Improvement
 * - Interests: Home Depot, Lowe's, garage organization, woodworking, Kreg tools
 * - Age: 25-55
 * - Location: US (exclude Alaska, Hawaii)
 * - Placement: Facebook Feed + Instagram Feed
 * - Objective: Conversions (Landing Page Views)
 * - Daily Budget: $10/day for 6 days
 *
 * Usage:
 *   npx ts-node scripts/acquisition/facebook-ad-copy.ts
 */

interface AdVariant {
  name: string;
  headline: string;
  primary_text: string;
  description: string;
  cta: string;
  url: string;
  image_direction: string;
}

const ADS: AdVariant[] = [
  {
    name: "VARIANT A — Money Shot",
    headline: "Installers Are Making $800–$1,200/Weekend",
    primary_text: `Storage Network sends you pre-sold garage storage jobs with cut lists included.

No quoting. No selling. No bidding.

Just show up, build, and get paid same-day via Stripe.

Your first 3 jobs are free — no subscription, no fees.

Claim your territory before another installer does.`,
    description: "3 Jobs Free. No Credit Card Required.",
    cta: "Sign Up",
    url: "https://storage-network.app/invite?utm_source=facebook&utm_medium=cpc&utm_campaign=money_shot",
    image_direction:
      "Before/after garage photo. Left: messy garage. Right: clean organized tote racks. Overlay: '$800-1,200/Weekend' in bold yellow text on dark background.",
  },
  {
    name: "VARIANT B — Zero Selling",
    headline: "Stop Chasing Leads. Start Building.",
    primary_text: `What if every job came with:

✅ The customer already sold
✅ The deposit already collected
✅ A complete cut list already calculated

That's Storage Network.

We handle the sales, scheduling, and payments. You just build garage storage racks and get paid instantly.

3 jobs free. No credit card.`,
    description: "Pre-Sold Jobs. Cut Lists Included. Instant Payout.",
    cta: "Learn More",
    url: "https://storage-network.app/invite?utm_source=facebook&utm_medium=cpc&utm_campaign=zero_selling",
    image_direction:
      "Split screen. Left: frustrated contractor on phone with 'Quoting... Following up... Waiting for payment...' Right: contractor building with 'Just building. Getting paid.' Clean, minimal design.",
  },
  {
    name: "VARIANT C — Territory FOMO",
    headline: "Your ZIP Code Is Still Open",
    primary_text: `We're locking in ONE certified installer per territory.

Pre-sold jobs. Instant Stripe payouts. No bidding wars.

When your ZIP code is claimed, it's gone.

Storage Network is building a nationwide network of garage storage installers. Each installer gets an exclusive territory with guaranteed job flow.

First come, first served. Check if your area is still available.`,
    description: "Limited Territories. First Come, First Served.",
    cta: "Sign Up",
    url: "https://storage-network.app/invite?utm_source=facebook&utm_medium=cpc&utm_campaign=territory_fomo",
    image_direction:
      "Map of the US with colored dots showing 'CLAIMED' territories. A few areas highlighted in yellow showing 'OPEN'. Text overlay: 'Is Your Territory Still Available?' Dark background, yellow accents.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════════

function main() {
  console.log("══════════════════════════════════════════════════════════");
  console.log("  FACEBOOK AD COPY — Storage Network");
  console.log("  Budget: $60 | 3 Variants | $20 each");
  console.log("══════════════════════════════════════════════════════════\n");

  console.log("TARGETING SETUP:");
  console.log("  Objective:    Conversions (Landing Page Views)");
  console.log("  Age:          25-55");
  console.log("  Location:     United States (exclude AK, HI)");
  console.log("  Job Titles:   Handyman, Carpenter, General Contractor");
  console.log("  Interests:    Home Depot, Lowe's, Woodworking, Garage Organization");
  console.log("  Placements:   Facebook Feed, Instagram Feed");
  console.log("  Budget:       $10/day for 6 days\n");

  for (const ad of ADS) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`${ad.name}`);
    console.log(`${"─".repeat(60)}`);
    console.log(`\nHEADLINE:     ${ad.headline}`);
    console.log(`DESCRIPTION:  ${ad.description}`);
    console.log(`CTA BUTTON:   ${ad.cta}`);
    console.log(`URL:          ${ad.url}`);
    console.log(`\nPRIMARY TEXT:\n${ad.primary_text}`);
    console.log(`\nIMAGE DIRECTION:\n${ad.image_direction}`);
    console.log();
  }

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  OPTIMIZATION PLAYBOOK:");
  console.log("  Day 1-2: Run all 3 variants at $10/day each");
  console.log("  Day 3:   Check CTR and CPC. Kill the worst performer.");
  console.log("  Day 3-6: Split remaining $30 between top 2 variants.");
  console.log("  Day 5:   Kill 2nd worst. Put remaining budget on winner.");
  console.log("  Target:  CPL < $3.00, CTR > 1.5%, CVR > 10%");
  console.log("══════════════════════════════════════════════════════════\n");
}

main();
