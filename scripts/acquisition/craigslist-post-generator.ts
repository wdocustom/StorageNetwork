/**
 * Craigslist Post Generator — Generate ready-to-paste gig postings
 *
 * Generates customized Craigslist "skilled trades" / "gigs" posts for
 * target metro areas. You manually post these — this just generates the copy.
 *
 * Usage:
 *   npx ts-node scripts/acquisition/craigslist-post-generator.ts
 *   npx ts-node scripts/acquisition/craigslist-post-generator.ts --metros "Dallas,Phoenix,Atlanta"
 */

// ═══════════════════════════════════════════════════════════════════════════
// Target Metros — Top 20 US metros with high garage density & contractor base
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_METROS = [
  "Dallas / Fort Worth",
  "Phoenix / Scottsdale",
  "Houston",
  "Atlanta",
  "Tampa / St. Petersburg",
  "Denver",
  "Nashville",
  "Charlotte",
  "San Antonio",
  "Columbus, OH",
  "Indianapolis",
  "Jacksonville",
  "Austin",
  "Raleigh / Durham",
  "Salt Lake City",
  "Oklahoma City",
  "Kansas City",
  "Boise",
  "Las Vegas",
  "Orlando",
];

// ═══════════════════════════════════════════════════════════════════════════
// Post Templates
// ═══════════════════════════════════════════════════════════════════════════

function generatePost(metro: string): { title: string; body: string } {
  const inviteUrl = `https://storage-network.app/invite?utm_source=craigslist&utm_medium=post&utm_campaign=${encodeURIComponent(metro.toLowerCase().replace(/[^a-z0-9]/g, "_"))}`;

  return {
    title: `Garage Storage Installer Needed — $400-600/Job, Cut Lists Provided [${metro}]`,
    body: `
STORAGE NETWORK — INSTALLER OPPORTUNITY

We're looking for a skilled builder in the ${metro} area to install pre-designed tote storage rack systems in residential garages.

WHAT YOU GET:
- Pre-sold customers (deposit already collected)
- Complete material list and cut list for every job
- No quoting, no estimating, no selling
- Instant payout via Stripe when the job is done

THE WORK:
- Build and install custom 2x4 tote storage racks
- Average job takes 3-4 hours
- Materials: standard 2x4 lumber + 27-gallon totes (customer purchases)
- You need: miter saw, drill, tape measure, level

THE PAY:
- $400-600 per installation (varies by size)
- Instant payout — no invoicing, no waiting
- First 3 jobs are completely free (no platform fees)

WHO WE'RE LOOKING FOR:
- Experience with basic carpentry / woodworking
- Own tools (miter saw, drill, basic hand tools)
- Reliable transportation
- Professional attitude (these are residential homes)

This is NOT a W-2 job. You're an independent contractor building a side income (or full-time income) through our installer network.

HOW TO APPLY:
Visit ${inviteUrl} and sign up in 30 seconds. No credit card required.

We limit the number of installers per area, so first come first served.

---
Storage Network — Professional Grade Storage Systems
storage-network.app
    `.trim(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Generate All Posts
// ═══════════════════════════════════════════════════════════════════════════

function main() {
  const metroArg = process.argv.find((a) => a.startsWith("--metros"));
  const metros = metroArg
    ? process.argv[process.argv.indexOf(metroArg) + 1].split(",").map((m) => m.trim())
    : DEFAULT_METROS;

  console.log("══════════════════════════════════════════════════════════");
  console.log("  CRAIGSLIST POST GENERATOR — Storage Network");
  console.log(`  Generating ${metros.length} posts for manual posting`);
  console.log("══════════════════════════════════════════════════════════\n");

  for (const metro of metros) {
    const post = generatePost(metro);

    console.log("────────────────────────────────────────────────────────");
    console.log(`METRO: ${metro}`);
    console.log(`CATEGORY: skilled trades / gigs`);
    console.log("────────────────────────────────────────────────────────");
    console.log(`TITLE: ${post.title}`);
    console.log();
    console.log(post.body);
    console.log("\n\n");
  }

  console.log("════════════════════════════════════════════════════════════");
  console.log("  POSTING INSTRUCTIONS:");
  console.log("  1. Go to each metro's craigslist (e.g., dallas.craigslist.org)");
  console.log("  2. Click 'post to classifieds' → 'gig offered' or 'skilled trade'");
  console.log("  3. Paste the title and body");
  console.log("  4. Pay $5 per featured posting (budget: $20 = top 4 metros)");
  console.log("  5. Repost every 7 days for visibility");
  console.log("════════════════════════════════════════════════════════════\n");
}

main();
