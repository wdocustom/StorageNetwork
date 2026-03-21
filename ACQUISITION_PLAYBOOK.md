# Storage Network — $100 Acquisition Playbook

**Goal:** 50 active, verified installer signups
**Budget:** $100 total
**Timeline:** 14 days
**Constraints:** No SMS, no cold calling, $0 on lead gen tools/scraping APIs/lists

---

## Executive Analysis

### Why Most Approaches Fail for This Niche

Blue-collar contractors (carpenters, handymen, garage organizers) are:
- **Not on LinkedIn.** Cold email to business emails has <2% open rates for this demographic.
- **On Facebook/YouTube constantly.** They consume content during breaks and after hours.
- **Trust peers, not ads.** A recommendation from another contractor > any marketing.
- **Motivated by money, not features.** "Make $1,000 this weekend" > "3D WebGL configurator."

### The Winning Insight

The highest-ROI play is **not** cold outreach. It's **demand-side capture** — getting in front of contractors where they already congregate, with a message that speaks their language: **money per weekend.**

---

## Budget Allocation ($100)

| Channel                          | Spend  | Expected Installs | Cost/Install |
|----------------------------------|--------|--------------------|--------------|
| Facebook Ads (contractor groups) | $60    | 20-25              | $2.40-3.00   |
| Reddit/Forum seeding (organic)   | $0     | 8-12               | $0           |
| Referral viral loop (built-in)   | $0     | 10-15              | $0           |
| YouTube comment engagement       | $0     | 3-5                | $0           |
| Craigslist gig postings          | $20    | 5-8                | $2.50-4.00   |
| Google Business Profile (setup)  | $0     | 2-3                | $0           |
| Buffer for retargeting           | $20    | 5-8                | $2.50-4.00   |
| **TOTAL**                        | **$100** | **50-76**        | **$1.31-2.00** |

---

## Channel Strategy Deep-Dive

### Channel 1: Facebook Ads — $60 (Primary Driver)

**Why:** 73% of contractors aged 25-54 use Facebook daily. Contractor-specific groups have 50K-500K members. Facebook allows hyper-targeting by job title + interests.

**Targeting:**
- Job titles: Handyman, Carpenter, General Contractor, Home Improvement
- Interests: Home Depot, Lowe's, garage organization, woodworking
- Age: 25-55
- Location: US metro areas with garage culture (suburbs, Sun Belt, Midwest)

**Ad Creative (3 variants to A/B test):**

**Variant A — "Money Shot" (Lead with income)**
> Headline: "Installers Are Making $800-$1,200/Weekend"
> Body: "Storage Network sends you pre-sold garage storage jobs with cut lists included. No quoting. No selling. Just show up, build, get paid same-day. 3 jobs free — claim your territory."
> CTA: "Claim Your Territory"
> Image: Before/after garage photo with cash overlay

**Variant B — "Zero Selling" (Lead with pain removal)**
> Headline: "Stop Chasing Leads. Start Building."
> Body: "What if every job came with the customer already sold, the deposit already collected, and a cut list already calculated? That's Storage Network. Try 3 jobs free."
> CTA: "Start Building"
> Image: Cut list screenshot + finished rack photo

**Variant C — "Territory" (Lead with scarcity/FOMO)**
> Headline: "Your ZIP Code Is Still Open"
> Body: "We're locking in ONE certified installer per territory. Pre-sold jobs, instant Stripe payouts, no bidding wars. First come, first served."
> CTA: "Lock In My Territory"
> Image: Map with "CLAIMED" badges on ZIP codes

**Landing URL:** `/invite?utm_source=facebook&utm_medium=cpc&utm_campaign=installer_acq`

---

### Channel 2: Reddit & Forum Seeding — $0

**Target Subreddits:**
- r/handyman (45K members)
- r/carpentry (180K members)
- r/HomeImprovement (5M members — post as a success story)
- r/sidehustle (800K members)
- r/sweatystartup (100K members)
- r/garageporn (50K members — post build photos)
- r/Entrepreneur (2M members)

**Approach:** NOT spamming links. Create genuine value posts:

**Post Template 1 — "I made $X building tote racks" (r/sidehustle)**
> Title: "Side hustle update: made $3,200 last month building garage storage racks"
> Body: Genuine story about the tote-rack niche. Mention the platform naturally. Include photos. Answer questions. Drop the /invite link only when asked "how do I get started?"

**Post Template 2 — "Found a platform that sends pre-sold jobs" (r/handyman)**
> Title: "Has anyone tried platforms that send you pre-sold jobs instead of bidding?"
> Body: Discussion-style post about the pain of lead gen. Mention Storage Network as one option. Be authentic, not salesy.

**Post Template 3 — Build showcase (r/garageporn, r/carpentry)**
> Title: "Built this 8-column tote rack for a client's garage [before/after]"
> Body: Photo post showcasing actual builds. Naturally mention the platform in comments.

---

### Channel 3: Referral Viral Loop — $0 (Built Into Platform)

**Mechanism:** Every signed-up installer gets a unique referral link. For each new installer they bring in who completes their first paid job:
- Referrer gets: $50 bonus (funded from platform's 15% network fee)
- Referee gets: Extended trial (5 jobs instead of 3)

**Why This Works:**
- Contractors know other contractors. One handyman knows 10 more.
- The $50 bounty is funded from revenue, not from the $100 budget.
- Creates exponential growth: 10 installers → 30 referrals → 90 referrals.

**Implementation:** The `/invite` landing page accepts `?ref=<installer_slug>` parameter and tracks attribution via cookie. The referral system already exists in the dashboard at `/dashboard/referrals`.

---

### Channel 4: YouTube Comment Engagement — $0

**Target Channels:**
- Garage organization YouTubers (50K-500K subscribers)
- DIY storage build videos
- "How I make money as a handyman" videos

**Approach:** Leave genuine, helpful comments on relevant videos. Example:
> "Great build! I've been doing similar tote racks through Storage Network — they send you pre-sold jobs with cut lists already done. Made about $800 last weekend on two installs."

**Volume:** 5-10 comments/day on relevant videos. Natural, not spammy.

---

### Channel 5: Craigslist Gig Postings — $20

**Why:** Handymen and contractors check Craigslist gigs section daily.

**Post in top 20 metro areas under "skilled trades" and "gigs":**

> Title: "Garage Storage Installer Needed — $400-600/Job, Materials Provided"
> Body: "Storage Network is looking for skilled builders in [CITY] to install pre-designed tote storage systems in residential garages. Each job comes with a complete cut list and pre-sold customer. Average job takes 3-4 hours and pays $400-600. We handle sales, scheduling, and payment processing. You just build. Apply at storage-network.app/invite"

**Cost:** $5 for featured posting in top 4 metros.

---

### Channel 6: Google Business Profile — $0

**Action:** Create a Google Business Profile for "Storage Network" as a service-area business. This captures organic "garage storage installer near me" searches at zero cost. Not immediate ROI but compounds over time.

---

## Psychological Copywriting Framework

### The 4 Hooks That Convert Blue-Collar Workers

**Hook 1: MONEY FIRST**
Lead with dollars, not features. "$800-1,200/weekend" is the headline. Everything else is secondary. Contractors think in terms of "how much per job" and "how many jobs per week."

**Hook 2: REMOVE THE PAIN**
The #1 pain for independent contractors is lead generation and quoting. "No quoting, no selling, no bidding" removes their biggest headache. Pre-calculated cut lists remove the second biggest headache (math/planning).

**Hook 3: TERRITORIAL SCARCITY**
"One installer per territory" creates FOMO. Contractors are competitive — if they think someone else will lock down their ZIP code, they'll act fast. This is the single most powerful psychological lever for this demographic.

**Hook 4: PEER PROOF**
"Installers are making $X" with real photos of real builds. Blue-collar workers trust what they can see. Before/after photos + income claims + a real person's name = conversion.

### Copy Rules
- Use ALL CAPS sparingly but strategically (like a job site sign)
- Keep sentences under 10 words where possible
- Use numbers, not words ("$800" not "eight hundred dollars")
- Never say "SaaS" or "platform" — say "the network" or "the system"
- Use action verbs: Build. Install. Get Paid.
- Avoid corporate language. Write like you're texting a fellow contractor.

---

## The Invite Landing Page (`/invite`)

**Purpose:** Single-page conversion funnel for all paid traffic. Designed to convert cold traffic from Facebook ads, Craigslist, Reddit, and referral links in under 60 seconds.

**Page Structure:**
1. **Hero:** "$800-1,200 Per Weekend" headline + territory claim CTA
2. **Pain/Solution:** 3 cards showing the old way (quoting, selling, invoicing) vs. the new way (pre-sold, cut lists, instant payout)
3. **Social Proof:** Real build photos + installer testimonial quotes
4. **How It Works:** 3-step visual (Sign Up → Get Jobs → Get Paid)
5. **3D Demo:** Embedded preview of the configurator (shows the cut list magic)
6. **Scarcity CTA:** "Your ZIP Code May Still Be Open" + signup form
7. **FAQ:** 5 objection-handling questions

**Conversion Optimization:**
- No navigation bar (eliminates escape routes)
- Single CTA repeated 3 times (top, middle, bottom)
- Mobile-first (60%+ of contractor traffic is mobile)
- Page load <2 seconds (no heavy 3D on initial load)
- UTM parameter tracking for attribution
- Referral cookie persistence (30-day window)

---

## Execution Timeline

### Week 1 (Days 1-7)
- [x] Build `/invite` landing page
- [x] Build acquisition scripts (lead tracker, referral link generator)
- [ ] Launch Facebook ad campaign ($60 budget, 3 variants)
- [ ] Post in 5 target subreddits (stagger 1/day)
- [ ] Post in 10 Craigslist metros ($20)

### Week 2 (Days 8-14)
- [ ] Analyze Facebook ad performance, kill losers, scale winners
- [ ] Post in 5 more subreddits
- [ ] Engage on 30+ YouTube videos
- [ ] Follow up with referral activation emails to existing installers
- [ ] Post 10 more Craigslist gigs in secondary metros

### Target Milestones
- Day 3: 10 signups (Facebook + Craigslist early hits)
- Day 7: 25 signups (Reddit posts gain traction + referrals start)
- Day 14: 50 signups (referral loop compounds + retargeting converts)

---

## Measurement & KPIs

| Metric                     | Target  | Tracking Method          |
|----------------------------|---------|--------------------------|
| Invite page visits         | 500+    | UTM params + analytics   |
| Signup conversion rate     | 10%+    | Supabase auth events     |
| Cost per signup            | <$2.00  | Budget / signups         |
| Referral activation rate   | 30%+    | Referral dashboard       |
| First-job completion rate  | 60%+    | Lead completion tracking |
| 30-day retention           | 40%+    | Login activity           |

---

## Risk Mitigation

- **Ad account ban:** Keep ad copy compliant. No income guarantees — use "Installers are reporting" instead of "You will make."
- **Reddit shadowban:** Use aged accounts. Provide genuine value. Never post the same link twice.
- **Low conversion:** If invite page converts <5%, A/B test the hero copy. Money-first vs. pain-removal are the two strongest variants.
- **Budget overrun:** Hard cap at $100. Facebook daily budget set to $10/day for 6 days. Craigslist capped at $20.

---

*This playbook is designed to be executed by a solo founder with $100 and basic Facebook Ads Manager access. No marketing team required.*
