/**
 * Reddit Post Templates — Ready-to-use content for organic outreach
 *
 * These are authentic, value-first posts designed to generate interest
 * without being spammy. Post manually from your personal Reddit account.
 *
 * Usage:
 *   npx ts-node scripts/acquisition/reddit-post-templates.ts
 */

interface RedditPost {
  subreddit: string;
  title: string;
  body: string;
  tips: string;
}

const POSTS: RedditPost[] = [
  {
    subreddit: "r/sidehustle",
    title:
      "Side hustle report: made $3,200 last month building garage storage racks",
    body: `I've been doing this for about 3 months now and wanted to share since I see a lot of people asking about trades-based side hustles.

**The gig:** I build custom tote storage rack systems for homeowners' garages. Think floor-to-ceiling 2x4 frames that hold 27-gallon storage totes. Clean, organized, heavy-duty.

**The numbers:**
- Average job: $400-600
- Time per job: 3-4 hours
- Jobs per weekend: 2-3
- Last month: 7 jobs = ~$3,200

**How I find clients:**
I signed up with a platform called Storage Network that has a 3D configurator where homeowners design their storage unit. When someone in my area places an order, I get the job with a complete cut list — I just show up, cut the lumber, and build.

**What you need:**
- Miter saw, drill, tape measure, level
- Basic carpentry skills (if you can build a bookshelf, you can do this)
- A truck or SUV for lumber runs

**What I like:**
- No quoting or selling (the platform handles that)
- Cut lists are pre-calculated so there's zero math
- I get paid same-day through Stripe

**What I don't like:**
- You're limited to one territory so there's a ceiling
- Some weeks are slower than others
- You have to deal with the occasional messy garage

Happy to answer questions. Not trying to sell anything, just sharing what's working for me.`,
    tips: "Post during weekday evenings (6-9pm EST) for maximum engagement. Answer every comment genuinely. Only share the platform link when someone specifically asks.",
  },
  {
    subreddit: "r/handyman",
    title:
      "Anyone else getting pre-sold jobs through platforms instead of chasing leads?",
    body: `Curious if anyone else has moved away from the Thumbtack/HomeAdvisor model.

I got tired of:
- Paying $20-40 per lead that goes nowhere
- Writing estimates that clients ghost on
- Competing with 10 other contractors for the same job

Started doing garage storage installations through a network that sends me pre-sold jobs. Customer has already designed what they want, paid a deposit, and I get a complete cut list. I just show up and build.

It's not going to replace your full income (unless you're in a busy area), but the "no selling" part is genuinely life-changing. I was spending 40% of my time on estimates and follow-ups.

Anyone else doing anything similar? Are there other platforms like this for different trades?`,
    tips: "This is a discussion-style post. Engage authentically. Don't push the platform — let people ask about it naturally.",
  },
  {
    subreddit: "r/garageporn",
    title: "Built this 8-column tote rack system for a client [Before/After]",
    body: `Client had a 3-car garage that was completely buried in stuff. We designed an 8-column, 5-row tote rack system along the back wall using 27-gallon HDX totes.

**Specs:**
- 8 columns × 5 rows = 40 totes
- 2x4 construction with plywood top
- Rated for 2,000+ lbs per unit
- Built and installed in about 5 hours

**Materials cost:** ~$180 in lumber + totes were $8 each at Home Depot

The whole thing was designed in a 3D configurator that auto-generates the cut list, which made the build way faster than doing the math by hand.

Next project is adding plywood doors to the front for a cleaner look. Anyone done that before?`,
    tips: "This REQUIRES actual before/after photos. Only post if you have real build photos to share. The post is useless without images.",
  },
  {
    subreddit: "r/sweatystartup",
    title:
      "Garage organization as a business: $5K-8K/month with zero marketing spend",
    body: `Posting this because I think garage organization is an underrated service business.

**The model:**
- Build custom tote storage racks for homeowners
- Average ticket: $400-600 per install
- Time investment: 3-4 hours per job
- Overhead: basically zero (miter saw, drill, truck)

**Why it works:**
1. Every homeowner with a garage wants this
2. Nobody is doing it professionally (it's a gap in the market)
3. Materials are dirt cheap (2x4s and storage totes)
4. The work is simple enough that you can train someone in a day

**How I get customers:**
I joined Storage Network, which is basically a marketplace for this specific niche. Homeowners design their storage system in a 3D tool, and installers in the area get matched to the job. The platform handles pricing, deposits, and scheduling.

The key insight: I spend ZERO time on marketing, lead gen, or quoting. Every job comes pre-sold with a cut list.

**Scaling:**
I'm considering hiring a helper so I can do 2 jobs/day instead of 1. At $500/job × 2 jobs/day × 20 working days = $20K/month revenue. Even with a helper at $25/hr, margins are insane.

AMA.`,
    tips: "r/sweatystartup loves real numbers and unit economics. Be prepared to answer detailed questions about margins, startup costs, and scaling.",
  },
  {
    subreddit: "r/carpentry",
    title:
      "Interesting niche: anyone building tote rack systems professionally?",
    body: `Been doing custom furniture and trim work for 15 years, but I recently started doing residential tote storage racks as a side thing and it's surprisingly profitable.

The builds are dead simple — 2x4 frames sized to hold 27-gallon storage totes — but homeowners will pay $400-600 for a professionally installed unit because they don't want to deal with it themselves.

A few things I've learned:
- Use a fractional cut list to minimize waste. A 96" 2x4 yields exactly 6 uprights at 15.25" with minimal scrap
- Plywood tops make a huge difference in perceived quality
- Casters on the bottom units are a premium upsell ($50-75 extra, 10 minutes of work)
- Pre-staining or painting the frames adds $100-150 to the price and takes 20 minutes of spray time

Anyone else in this niche? Curious what others are charging.`,
    tips: "r/carpentry values technical knowledge. Focus on the craft, not the business side. Share real building tips.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════════

function main() {
  console.log("══════════════════════════════════════════════════════════");
  console.log("  REDDIT POST TEMPLATES — Storage Network Acquisition");
  console.log("══════════════════════════════════════════════════════════\n");

  for (const post of POSTS) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`SUBREDDIT: ${post.subreddit}`);
    console.log(`${"─".repeat(60)}`);
    console.log(`\nTITLE: ${post.title}\n`);
    console.log("BODY:");
    console.log(post.body);
    console.log(`\nPOSTING TIPS: ${post.tips}`);
    console.log();
  }

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  GENERAL RULES:");
  console.log("  - Post from an aged, active Reddit account");
  console.log("  - Space posts 2-3 days apart (not all at once)");
  console.log("  - NEVER post the same content to multiple subreddits");
  console.log("  - Answer every comment genuinely");
  console.log("  - Only share the /invite link when someone asks");
  console.log("  - Upvote and engage with other posts in the subreddit");
  console.log("  - If a post gets removed, don't repost — move on");
  console.log("══════════════════════════════════════════════════════════\n");
}

main();
