/**
 * Facebook Ad Copy Generator — Ready-to-use ad variants for Ads Manager
 *
 * Budget: $80 across 4 variants ($20 each, or kill losers and scale winner)
 *
 * Targeting Recommendations:
 * - Job titles: Handyman, Carpenter, General Contractor, Home Improvement
 * - Interests: Home Depot, Lowe's, garage organization, woodworking, Kreg tools,
 *              garage shelving, tote storage, 27 gallon totes, DIY shelves
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
  {
    name: "VARIANT D — Course Killer",
    headline: "Skip the Course. Start Getting Paid.",
    primary_text: `Tired of people selling you a $500 course to "learn the shelf business"?

Here's what they don't tell you:
❌ You still have to find your own customers
❌ You still have to do all the quoting
❌ You still have to calculate your own cut lists
❌ You compete with everyone else who bought the same course

Storage Network flips the script:
✅ Pre-sold customers delivered to YOUR territory
✅ Cut lists auto-generated (zero math errors)
✅ Exclusive ZIP code — no competition
✅ Instant Stripe payout when you're done

Free to join. No course to buy. No franchise fee. Your first 3 jobs are on us.`,
    description: "No Course Needed. Pre-Sold Jobs. Exclusive Territory.",
    cta: "Sign Up",
    url: "https://storage-network.app/invite?utm_source=facebook&utm_medium=cpc&utm_campaign=course_killer",
    image_direction:
      "Split screen. Left side (red tint): laptop showing '$497 COURSE — Learn to sell shelves' with a big X over it. Right side (green tint): contractor building shelves with '$800-1,200/Weekend' overlay. Bottom text: 'Why pay to learn when you can get paid to build?' Dark background.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════════

function main() {
  console.log("══════════════════════════════════════════════════════════");
  console.log("  FACEBOOK AD COPY — Storage Network");
  console.log("  Budget: $80 | 4 Variants | $20 each");
  console.log("══════════════════════════════════════════════════════════\n");

  console.log("TARGETING SETUP:");
  console.log("  Objective:    Conversions (Landing Page Views)");
  console.log("  Age:          25-55");
  console.log("  Location:     United States (exclude AK, HI)");
  console.log("  Job Titles:   Handyman, Carpenter, General Contractor");
  console.log("  Interests:    Home Depot, Lowe's, Woodworking, Garage Organization,");
  console.log("                Garage Shelving, Tote Storage, 27 Gallon Totes, DIY Shelves");
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
  console.log("  Day 1-2: Run all 4 variants at $10/day each");
  console.log("  Day 3:   Check CTR and CPC. Kill the 2 worst performers.");
  console.log("  Day 3-6: Split remaining $40 between top 2 variants.");
  console.log("  Day 5:   Kill 2nd worst. Put remaining budget on winner.");
  console.log("  Target:  CPL < $3.00, CTR > 1.5%, CVR > 10%");
  console.log("══════════════════════════════════════════════════════════\n");
}

main();
