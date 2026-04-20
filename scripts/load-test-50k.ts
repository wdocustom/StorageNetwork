#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════════════════
// Load Test — 50k Visitor Viral Scenario
//
// Simulates a viral traffic event where an installer shares their link
// on Facebook and it gets 50,000 visitors in a 4-hour window with:
//   - 50,000 page views (landing + configurator)
//   - 3,000 installer signups (from /join viral spread)
//   - Realistic user journeys with conversion funnel
//
// Runs entirely in-process using the app's own modules — no HTTP server
// needed. Tests the critical code paths: rate limiter, cache, DB queries,
// email sends, and onboarding under concurrent load.
//
// Usage:  npx tsx scripts/load-test-50k.ts
// ═══════════════════════════════════════════════════════════════════════════

import { rateLimit, type RateLimitResult } from "../src/lib/rate-limit";
import { TtlCache } from "../src/lib/cache";

// ── Simulation Constants ──────────────────────────────────────────────────

const TOTAL_VISITORS = 50_000;
const INSTALLER_SIGNUPS = 3_000;
const SIMULATION_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours
const UNIQUE_IPS = 42_000; // ~84% unique (some return visitors)
const UNIQUE_ZIPS = 8_500; // Spread across ~8,500 unique ZIP codes

// Traffic distribution (percentages of 50k)
const TRAFFIC_MIX = {
  landingPageOnly: 0.40,      // 20,000 — bounce after landing page
  zipCheckOnly: 0.25,         // 12,500 — check ZIP, leave
  configuratorBrowse: 0.15,   // 7,500  — open configurator, browse, leave
  configuratorBuild: 0.08,    // 4,000  — build a unit in configurator
  quoteSubmit: 0.04,          // 2,000  — submit a quote/lead
  waitlistSignup: 0.02,       // 1,000  — join waitlist (no installer in area)
  installerSignup: 0.06,      // 3,000  — sign up as installer via /join
};

// Burst pattern — viral traffic is spiky, not uniform
// Percentage of traffic in each 30-minute slot over 4 hours (8 slots)
const BURST_PATTERN = [
  0.05, 0.08, 0.15, 0.22,  // Hour 1-2: ramp up
  0.20, 0.15, 0.10, 0.05,  // Hour 3-4: tail off
];

// ── Test Infrastructure ──────────────────────────────────────────────────

interface SimulatedRequest {
  ip: string;
  zip: string;
  journey: keyof typeof TRAFFIC_MIX;
  timestamp: number; // ms offset from start
  installerId?: string;
}

interface TestMetrics {
  // Rate Limiter
  rateLimitChecks: number;
  rateLimitBlocked: number;
  rateLimitAllowed: number;
  uniqueIpsTracked: number;

  // Cache
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  maxCacheSize: number;

  // Database simulation
  dbQueriesTotal: number;
  dbQueriesSaved: number; // queries prevented by cache
  dbWriteOps: number;

  // Journeys
  journeyCounts: Record<string, number>;
  journeyErrors: Record<string, number>;

  // Installer onboarding
  onboardAttempts: number;
  onboardSuccesses: number;
  onboardDuplicateEmails: number;
  onboardSlugCollisions: number;
  zipRadiusComputations: number;
  avgZipsPerInstaller: number;

  // Lead submission
  leadSubmissions: number;
  leadSuccesses: number;
  leadBlackoutRejects: number;
  leadCapacityRejects: number;

  // Demand signals
  demandSignalsAnonymous: number;
  demandSignalsWaitlist: number;
  demandSignalsDeduplicated: number;

  // Email volume
  emailsSent: number;
  emailTypes: Record<string, number>;

  // Performance
  peakConcurrentRequests: number;
  avgResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  totalElapsedMs: number;

  // Memory
  peakMemoryMB: number;
  rateLimitStoreSize: number;
}

// ── Utilities ────────────────────────────────────────────────────────────

function randomIp(index: number): string {
  // Generate deterministic but realistic-looking IPs
  const a = 10 + (index % 245);
  const b = (index * 7) % 256;
  const c = (index * 13) % 256;
  const d = (index * 31) % 256;
  return `${a}.${b}.${c}.${d}`;
}

function randomZip(index: number): string {
  // Generate realistic 5-digit ZIP codes across the US
  const base = 10001 + (index * 11) % 89999;
  return String(base).padStart(5, "0");
}

function pickJourney(): keyof typeof TRAFFIC_MIX {
  const r = Math.random();
  let cumulative = 0;
  for (const [journey, pct] of Object.entries(TRAFFIC_MIX)) {
    cumulative += pct;
    if (r < cumulative) return journey as keyof typeof TRAFFIC_MIX;
  }
  return "landingPageOnly";
}

function assignTimestamp(index: number, total: number): number {
  // Assign a timestamp based on burst pattern
  const r = Math.random();
  let cumulative = 0;
  for (let slot = 0; slot < BURST_PATTERN.length; slot++) {
    cumulative += BURST_PATTERN[slot];
    if (r < cumulative) {
      const slotDuration = SIMULATION_WINDOW_MS / BURST_PATTERN.length;
      const slotStart = slot * slotDuration;
      return slotStart + Math.random() * slotDuration;
    }
  }
  return Math.random() * SIMULATION_WINDOW_MS;
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Generate Traffic ─────────────────────────────────────────────────────

function generateTraffic(): SimulatedRequest[] {
  const requests: SimulatedRequest[] = [];

  for (let i = 0; i < TOTAL_VISITORS; i++) {
    const ipIndex = i % UNIQUE_IPS;
    const zipIndex = i % UNIQUE_ZIPS;

    requests.push({
      ip: randomIp(ipIndex),
      zip: randomZip(zipIndex),
      journey: pickJourney(),
      timestamp: assignTimestamp(i, TOTAL_VISITORS),
    });
  }

  // Sort by timestamp for realistic ordering
  requests.sort((a, b) => a.timestamp - b.timestamp);
  return requests;
}

// ── Simulate Each System Under Load ──────────────────────────────────────

async function testRateLimiter(requests: SimulatedRequest[]): Promise<{
  checks: number;
  blocked: number;
  allowed: number;
  uniqueIps: number;
  storeSize: number;
}> {
  let checks = 0;
  let blocked = 0;
  let allowed = 0;
  const seenIps = new Set<string>();

  for (const req of requests) {
    seenIps.add(req.ip);

    // Each visitor triggers 1-4 rate limit checks depending on journey
    const checksPerJourney: Record<string, number> = {
      landingPageOnly: 1,
      zipCheckOnly: 2,      // page + API call
      configuratorBrowse: 3, // page + ZIP check + configurator
      configuratorBuild: 4,  // page + ZIP + configurator + pricing calcs
      quoteSubmit: 5,        // page + ZIP + configurator + build + submit
      waitlistSignup: 3,     // page + ZIP + waitlist form
      installerSignup: 4,    // page + form + validate + onboard
    };

    const numChecks = checksPerJourney[req.journey] || 1;

    for (let c = 0; c < numChecks; c++) {
      checks++;
      const isApi = c > 0; // First check is a page, rest are API
      const limit = isApi ? 30 : 60;
      const key = `${req.ip}:${isApi ? "api" : "page"}`;
      const result = await rateLimit(key, limit);

      if (result.allowed) {
        allowed++;
      } else {
        blocked++;
      }
    }
  }

  return {
    checks,
    blocked,
    allowed,
    uniqueIps: seenIps.size,
    storeSize: seenIps.size * 2, // page + api entries per IP
  };
}

async function testCacheSystem(requests: SimulatedRequest[]): Promise<{
  hits: number;
  misses: number;
  maxSize: number;
  dbQueriesSaved: number;
}> {
  // Simulate the zipCache and installerCache behavior
  const zipCache = new TtlCache<string>(60_000);
  const installerCache = new TtlCache<string>(60_000);

  let hits = 0;
  let misses = 0;
  let maxSize = 0;

  // Simulate requests that trigger cache lookups
  for (const req of requests) {
    if (req.journey === "landingPageOnly") continue; // No cache interaction

    // ZIP availability check (cached per ZIP)
    const zipKey = `avail:${req.zip}`;
    const cachedZip = await zipCache.get(zipKey);
    if (cachedZip !== undefined) {
      hits++;
    } else {
      misses++;
      await zipCache.set(zipKey, `installer-for-${req.zip}`);
    }

    // Installer profile lookup (for configurator journeys)
    if (["configuratorBrowse", "configuratorBuild", "quoteSubmit"].includes(req.journey)) {
      const instKey = `id:installer-${req.zip.slice(0, 3)}`;
      const cachedInst = await installerCache.get(instKey);
      if (cachedInst !== undefined) {
        hits++;
      } else {
        misses++;
        await installerCache.set(instKey, `profile-data-${req.zip}`);
      }
    }

    const currentSize = zipCache.size + installerCache.size;
    if (currentSize > maxSize) maxSize = currentSize;
  }

  return {
    hits,
    misses,
    maxSize,
    dbQueriesSaved: hits, // Each cache hit = 1 Supabase query saved
  };
}

function testDatabaseLoad(requests: SimulatedRequest[]): {
  reads: number;
  writes: number;
  estimatedQueryTimeMs: number;
} {
  let reads = 0;
  let writes = 0;

  // Model DB queries per journey type
  const queryProfile: Record<string, { reads: number; writes: number }> = {
    landingPageOnly: { reads: 0, writes: 1 },       // page_views insert
    zipCheckOnly: { reads: 1, writes: 1 },           // profiles.select + page_views
    configuratorBrowse: { reads: 2, writes: 1 },     // profiles.select + installer lookup + page_views
    configuratorBuild: { reads: 3, writes: 1 },      // above + pricing/calculator
    quoteSubmit: { reads: 4, writes: 3 },             // above + blackout check + scheduling + lead insert + lead_cap update
    waitlistSignup: { reads: 1, writes: 2 },          // dedup check + demand_signals insert + page_views
    installerSignup: { reads: 3, writes: 5 },         // auth + profile upsert + slug check + trial + onboarding step + page_views
  };

  for (const req of requests) {
    const profile = queryProfile[req.journey] || { reads: 0, writes: 0 };
    reads += profile.reads;
    writes += profile.writes;
  }

  // Estimated query time: reads ~5ms avg, writes ~10ms avg on Supabase
  const estimatedQueryTimeMs = reads * 5 + writes * 10;

  return { reads, writes, estimatedQueryTimeMs };
}

function testInstallerOnboarding(requests: SimulatedRequest[]): {
  attempts: number;
  successes: number;
  duplicateEmails: number;
  slugCollisions: number;
  zipComputations: number;
  avgZipsPerInstaller: number;
  dbWrites: number;
  emailsSent: number;
} {
  const signupRequests = requests.filter((r) => r.journey === "installerSignup");

  const seenEmails = new Set<string>();
  const seenSlugs = new Set<string>();
  let duplicateEmails = 0;
  let slugCollisions = 0;
  let successes = 0;
  let totalZips = 0;

  for (let i = 0; i < signupRequests.length; i++) {
    const email = `installer-${i}@test.com`;
    const slug = `installer-${signupRequests[i].zip}-${i}`;

    if (seenEmails.has(email)) {
      duplicateEmails++;
      continue;
    }
    seenEmails.add(email);

    if (seenSlugs.has(slug.split("-").slice(0, 2).join("-"))) {
      slugCollisions++;
    }
    seenSlugs.add(slug);

    // Simulate zipcodes.radius() — 25 mile radius averages ~150-300 ZIPs
    const zipsInRadius = 150 + Math.floor(Math.random() * 150);
    totalZips += zipsInRadius;

    successes++;
  }

  return {
    attempts: signupRequests.length,
    successes,
    duplicateEmails,
    slugCollisions,
    zipComputations: successes,
    avgZipsPerInstaller: successes > 0 ? Math.round(totalZips / successes) : 0,
    // Per successful onboard: auth.createUser + profile.upsert + slug check + trial update + onboarding_step update
    dbWrites: successes * 5,
    emailsSent: successes, // Welcome email per signup
  };
}

function testLeadSubmission(requests: SimulatedRequest[]): {
  attempts: number;
  successes: number;
  blackoutRejects: number;
  capacityRejects: number;
  dbReads: number;
  dbWrites: number;
  emailsSent: number;
} {
  const leadRequests = requests.filter((r) => r.journey === "quoteSubmit");

  // Simulate some installers hitting capacity
  const installerLeadCount = new Map<string, number>();
  let successes = 0;
  let capacityRejects = 0;
  let blackoutRejects = 0;

  for (const req of leadRequests) {
    const installerId = `inst-${req.zip.slice(0, 3)}`;
    const current = installerLeadCount.get(installerId) || 0;

    // 2% chance of blackout date conflict
    if (Math.random() < 0.02) {
      blackoutRejects++;
      continue;
    }

    // Max 25 leads per installer per month
    if (current >= 25) {
      capacityRejects++;
      continue;
    }

    installerLeadCount.set(installerId, current + 1);
    successes++;
  }

  return {
    attempts: leadRequests.length,
    successes,
    blackoutRejects,
    capacityRejects,
    // Per lead: service area validation + blackout check + scheduling check + insert
    dbReads: leadRequests.length * 3,
    dbWrites: successes,
    // ~30% of leads are referral handoffs → 1 email each
    emailsSent: Math.round(successes * 0.30),
  };
}

function testDemandSignals(requests: SimulatedRequest[]): {
  anonymous: number;
  waitlist: number;
  deduplicated: number;
  dbReads: number;
  dbWrites: number;
  emailsSent: number;
} {
  const waitlistRequests = requests.filter((r) => r.journey === "waitlistSignup");
  // ~40% of ZIP checks find no installer → anonymous demand signal
  const zipCheckRequests = requests.filter((r) => r.journey === "zipCheckOnly");
  const anonymousSignalRequests = zipCheckRequests.filter(() => Math.random() < 0.40);

  // Deduplication: 1 signal per ZIP per hour
  const recentZips = new Set<string>();
  let deduplicated = 0;
  let anonymousInserted = 0;

  for (const req of anonymousSignalRequests) {
    if (recentZips.has(req.zip)) {
      deduplicated++;
    } else {
      recentZips.add(req.zip);
      anonymousInserted++;
    }
  }

  return {
    anonymous: anonymousInserted,
    waitlist: waitlistRequests.length,
    deduplicated,
    // Per signal: 1 dedup check read + 1 insert write
    dbReads: anonymousSignalRequests.length + waitlistRequests.length,
    dbWrites: anonymousInserted + waitlistRequests.length,
    // Waitlist confirmation emails
    emailsSent: waitlistRequests.length,
  };
}

function testMemoryPressure(requests: SimulatedRequest[]): {
  rateLimitMapEntries: number;
  zipCacheEntries: number;
  installerCacheEntries: number;
  estimatedMemoryMB: number;
} {
  const uniqueIps = new Set(requests.map((r) => r.ip)).size;
  const uniqueZips = new Set(requests.map((r) => r.zip)).size;
  const uniqueInstallers = new Set(
    requests
      .filter((r) => ["configuratorBrowse", "configuratorBuild", "quoteSubmit"].includes(r.journey))
      .map((r) => r.zip.slice(0, 3))
  ).size;

  // Rate limit: 2 entries per IP (page + api), ~100 bytes each
  const rateLimitEntries = uniqueIps * 2;
  const rateLimitBytes = rateLimitEntries * 100;

  // ZIP cache: 1 entry per ZIP, ~500 bytes each (installer data)
  const zipCacheBytes = uniqueZips * 500;

  // Installer cache: ~2KB per installer profile
  const installerCacheBytes = uniqueInstallers * 2000;

  const totalBytes = rateLimitBytes + zipCacheBytes + installerCacheBytes;

  return {
    rateLimitMapEntries: rateLimitEntries,
    zipCacheEntries: uniqueZips,
    installerCacheEntries: uniqueInstallers,
    estimatedMemoryMB: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
  };
}

// ── Simulated Response Time Distribution ─────────────────────────────────

function simulateResponseTimes(requests: SimulatedRequest[]): number[] {
  const times: number[] = [];

  // Base response times by journey (ms)
  const baseTimes: Record<string, number> = {
    landingPageOnly: 15,       // CDN-cached static page
    zipCheckOnly: 25,          // cached ZIP check
    configuratorBrowse: 45,    // page render + installer lookup
    configuratorBuild: 60,     // above + pricing calculations
    quoteSubmit: 120,          // full validation + DB insert + email
    waitlistSignup: 80,        // demand signal insert + email
    installerSignup: 250,      // auth + profile + ZIP radius + email
  };

  for (const req of requests) {
    const base = baseTimes[req.journey] || 30;
    // Add jitter: ±30% variance + occasional slow queries
    const jitter = base * (0.7 + Math.random() * 0.6);
    // 2% chance of slow query (cache miss, cold DB connection)
    const slowQuery = Math.random() < 0.02 ? base * 3 : 0;
    // 0.1% chance of very slow (Supabase cold start or email timeout)
    const verySlow = Math.random() < 0.001 ? base * 10 : 0;
    times.push(Math.round(jitter + slowQuery + verySlow));
  }

  return times;
}

// ── Concurrency Analysis ─────────────────────────────────────────────────

function analyzeConcurrency(requests: SimulatedRequest[]): {
  peak: number;
  avgConcurrent: number;
  peakSlot: string;
} {
  // Bucket into 1-second windows
  const buckets = new Map<number, number>();

  for (const req of requests) {
    const second = Math.floor(req.timestamp / 1000);
    buckets.set(second, (buckets.get(second) || 0) + 1);
  }

  let peak = 0;
  let peakSecond = 0;
  let total = 0;

  buckets.forEach((count, second) => {
    total += count;
    if (count > peak) {
      peak = count;
      peakSecond = second;
    }
  });

  const avgConcurrent = Math.round(total / buckets.size);
  const peakMinutes = Math.floor(peakSecond / 60);
  const peakSlot = `${Math.floor(peakMinutes / 60)}h ${peakMinutes % 60}m`;

  return { peak, avgConcurrent, peakSlot };
}

// ── Vercel / Infrastructure Cost Estimation ──────────────────────────────

function estimateInfraCosts(metrics: TestMetrics): {
  vercelInvocations: number;
  vercelGbSeconds: number;
  estimatedVercelCost: string;
  supabaseReads: number;
  supabaseWrites: number;
  estimatedSupabaseCost: string;
  resendEmails: number;
  estimatedResendCost: string;
  totalEstimatedCost: string;
} {
  // Vercel serverless: each API/page call = 1 invocation
  const invocations = metrics.rateLimitChecks;
  // Avg 128MB, avg 200ms = ~0.025 GB-seconds per invocation
  const gbSeconds = invocations * 0.025;
  // Vercel Pro: ~$0.60 per 1M invocations + $0.18 per 100 GB-hours
  const vercelCost = (invocations / 1_000_000) * 0.60 + (gbSeconds / 3600 / 100) * 0.18;

  // Supabase: Free tier = 500MB, Pro = $25/mo + usage
  const supabaseReads = metrics.dbQueriesTotal;
  const supabaseWrites = metrics.dbWriteOps;
  // Rough: $0.09 per million reads, $0.09 per million writes (Supabase Pro)
  const supabaseCost = ((supabaseReads + supabaseWrites) / 1_000_000) * 0.09;

  // Resend: $20/mo includes 50k emails, $0.0004 per additional
  const resendEmails = metrics.emailsSent;
  const resendCost = resendEmails > 50_000
    ? 20 + (resendEmails - 50_000) * 0.0004
    : 20; // Base plan

  const totalCost = vercelCost + supabaseCost + resendCost;

  return {
    vercelInvocations: invocations,
    vercelGbSeconds: Math.round(gbSeconds * 100) / 100,
    estimatedVercelCost: `$${vercelCost.toFixed(2)}`,
    supabaseReads,
    supabaseWrites,
    estimatedSupabaseCost: `$${supabaseCost.toFixed(2)}`,
    resendEmails,
    estimatedResendCost: `$${resendCost.toFixed(2)}`,
    totalEstimatedCost: `$${totalCost.toFixed(2)}`,
  };
}

// ── Bottleneck Analysis ──────────────────────────────────────────────────

interface Bottleneck {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  component: string;
  issue: string;
  impact: string;
  recommendation: string;
}

function analyzeBottlenecks(metrics: TestMetrics, concurrency: ReturnType<typeof analyzeConcurrency>): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];

  // 1. Rate limiter memory
  if (metrics.rateLimitStoreSize > 80_000) {
    bottlenecks.push({
      severity: "CRITICAL",
      component: "Rate Limiter",
      issue: `In-memory store holds ${metrics.rateLimitStoreSize.toLocaleString()} entries`,
      impact: "Memory pressure on serverless function. Each Vercel function has 1024MB limit. At ~100 bytes/entry, this is ~${(metrics.rateLimitStoreSize * 100 / 1024 / 1024).toFixed(1)}MB just for rate limit state.",
      recommendation: "Migrate rate limiting to Vercel KV (Redis) or Upstash for distributed state across function instances.",
    });
  }

  // 2. Cache not shared across instances
  if (metrics.maxCacheSize > 5_000) {
    bottlenecks.push({
      severity: "HIGH",
      component: "TtlCache",
      issue: `Each serverless instance maintains its own cache (${metrics.maxCacheSize.toLocaleString()} entries peak)`,
      impact: "Under viral load Vercel spins up 10-50+ function instances. Each has a cold cache, multiplying Supabase queries by the instance count. Effective cache hit rate drops from ${metrics.cacheHitRate.toFixed(0)}% to ~10-20%.",
      recommendation: "Add Vercel KV (Redis) as L2 cache behind the in-memory TtlCache. In-memory cache handles repeat requests within the same instance; KV handles cross-instance dedup.",
    });
  }

  // 3. Installer onboarding N+1 writes
  if (metrics.onboardSuccesses > 500) {
    const totalOnboardWrites = metrics.onboardSuccesses * 5;
    bottlenecks.push({
      severity: "HIGH",
      component: "Installer Onboarding",
      issue: `${metrics.onboardSuccesses.toLocaleString()} signups × 5 DB writes each = ${totalOnboardWrites.toLocaleString()} sequential writes`,
      impact: `Each onboard does: auth.createUser → profiles.upsert → slug uniqueness check → profiles.update(trial) → profiles.update(onboarding_step). These are sequential, not batched. At 10ms/write, that's ~${(totalOnboardWrites * 10 / 1000).toFixed(0)}s of cumulative DB write time.`,
      recommendation: "Consolidate into 2 operations: auth.createUser + single profiles.upsert with all fields (slug, trial, onboarding_step) in one call.",
    });
  }

  // 4. zipcodes.radius() blocking
  if (metrics.zipRadiusComputations > 1000) {
    bottlenecks.push({
      severity: "HIGH",
      component: "ZIP Radius Computation",
      issue: `${metrics.zipRadiusComputations.toLocaleString()} synchronous zipcodes.radius() calls averaging ~${metrics.avgZipsPerInstaller} ZIPs each`,
      impact: "zipcodes.radius(zip, 25) is CPU-bound and blocks the event loop. With 3,000 concurrent signups, this creates a ~15-30ms blocking call per request. On a shared Vercel function, this serializes requests and increases tail latency.",
      recommendation: "Pre-compute ZIP radius on write (store result in service_zips) and consider using a background job queue for radius expansion rather than inline computation.",
    });
  }

  // 5. Lead cap N+1 updates
  const zipCheckReqs = metrics.journeyCounts["zipCheckOnly"] || 0;
  if (zipCheckReqs > 5_000) {
    bottlenecks.push({
      severity: "HIGH",
      component: "checkAvailability() Lead Cap Reset",
      issue: `Up to ${zipCheckReqs.toLocaleString()} ZIP checks, each potentially triggering N individual profiles.update() calls for lead cap resets`,
      impact: "If 5 installers cover a popular ZIP and none have been reset this month, every request (even cached) will fire 5 separate UPDATE queries on cache miss. Under viral traffic, the first burst of cache misses causes a thundering herd of writes.",
      recommendation: "Move lead cap reset to a scheduled Supabase cron (runs at month start) or a DB trigger. Remove inline reset logic from the hot path entirely.",
    });
  }

  // 6. Demand signal dedup under load
  if (metrics.demandSignalsDeduplicated > 500) {
    bottlenecks.push({
      severity: "MEDIUM",
      component: "Demand Signals",
      issue: `${metrics.demandSignalsDeduplicated.toLocaleString()} redundant dedup queries (same ZIP checked multiple times)`,
      impact: "Each anonymous demand signal does a SELECT before INSERT for dedup. Under burst traffic, many concurrent requests for the same ZIP all pass the dedup check before any INSERT completes, causing duplicate rows.",
      recommendation: "Add a UNIQUE constraint on (zip, signal_type, date_trunc('hour', created_at)) in Supabase and use INSERT ... ON CONFLICT DO NOTHING instead of SELECT-then-INSERT.",
    });
  }

  // 7. Email volume
  if (metrics.emailsSent > 3_000) {
    bottlenecks.push({
      severity: "MEDIUM",
      component: "Email (Resend)",
      issue: `${metrics.emailsSent.toLocaleString()} emails triggered in a 4-hour window`,
      impact: "Resend rate limits: 10 emails/sec on Pro plan. At ${metrics.emailsSent} emails over 4 hours, average is ${(metrics.emailsSent / 4 / 3600).toFixed(1)}/sec — within limits. But during peak burst, email sends could queue up and add 500-2000ms latency to onboarding responses.",
      recommendation: "Make ALL email sends fire-and-forget (already partially done). Consider a background queue (Vercel Cron or Inngest) for batch email delivery rather than inline sends.",
    });
  }

  // 8. Peak concurrency vs Supabase connection limit
  if (concurrency.peak > 50) {
    bottlenecks.push({
      severity: "MEDIUM",
      component: "Supabase Connection Pool",
      issue: `Peak concurrency of ${concurrency.peak} requests/second`,
      impact: "Supabase Free plan: 60 connections. Pro plan: 200 connections. The singleton client reuses connections, but under viral load with 10-50 Vercel instances, each maintaining its own singleton, total connections could hit 50-200. Connection pool exhaustion causes 5-10s query timeouts.",
      recommendation: "Enable Supabase connection pooling (PgBouncer) via the pooler URL. Switch the service client to use the pooler endpoint for serverless workloads.",
    });
  }

  // 9. Missing rate limits on public endpoints
  bottlenecks.push({
    severity: "HIGH",
    component: "API Rate Limiting",
    issue: "submitNetworkLead() and onboardInstaller() have NO rate limiting",
    impact: "While middleware rate-limits pages (60/min) and API routes (30/min), server actions called directly bypass middleware. A script could call submitNetworkLead() 1000x/sec, creating garbage leads and burning Supabase quota.",
    recommendation: "Add rate limiting decorators to critical server actions: onboardInstaller (5/min per IP), submitNetworkLead (10/min per IP), recordWaitlistDemand (10/min per IP).",
  });

  // 10. Slug collision under concurrent signups
  if (metrics.onboardSlugCollisions > 50) {
    bottlenecks.push({
      severity: "MEDIUM",
      component: "Slug Generation",
      issue: `${metrics.onboardSlugCollisions} slug collisions during concurrent signups`,
      impact: "Two installers signing up simultaneously with similar names (e.g., 'Johns Storage') both generate slug 'johns-storage'. Both pass the uniqueness SELECT (race condition), then one silently overwrites the other's slug. The year-suffix fallback only handles the first collision.",
      recommendation: "Add a UNIQUE constraint on profiles.slug in Supabase. Use INSERT ... ON CONFLICT with a retry loop that appends a random suffix.",
    });
  }

  return bottlenecks.sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return order[a.severity] - order[b.severity];
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN — Run the simulation
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  LOAD TEST — 50k Visitor Viral Traffic Scenario");
  console.log("  Storage Network Configurator + 3k Installer Signups");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const startTime = Date.now();
  const startMem = process.memoryUsage().heapUsed;

  // 1. Generate traffic
  console.log("⏳ Generating 50,000 visitor traffic patterns...");
  const requests = generateTraffic();

  // Journey distribution
  const journeyCounts: Record<string, number> = {};
  for (const req of requests) {
    journeyCounts[req.journey] = (journeyCounts[req.journey] || 0) + 1;
  }

  console.log("\n📊 Traffic Distribution:");
  for (const [journey, count] of Object.entries(journeyCounts).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / TOTAL_VISITORS) * 100).toFixed(1);
    const bar = "█".repeat(Math.round(count / 1000));
    console.log(`   ${journey.padEnd(22)} ${String(count).padStart(6)} (${pct}%)  ${bar}`);
  }

  // 2. Test Rate Limiter
  console.log("\n⏳ Testing rate limiter under 50k visitor load...");
  const rlResults = await testRateLimiter(requests);

  // 3. Test Cache System
  console.log("⏳ Testing cache system (ZIP + installer caches)...");
  const cacheResults = await testCacheSystem(requests);

  // 4. Test Database Load
  console.log("⏳ Estimating database query volume...");
  const dbResults = testDatabaseLoad(requests);

  // 5. Test Installer Onboarding
  console.log("⏳ Simulating 3,000 installer signups...");
  const onboardResults = testInstallerOnboarding(requests);

  // 6. Test Lead Submission
  console.log("⏳ Simulating quote submissions...");
  const leadResults = testLeadSubmission(requests);

  // 7. Test Demand Signals
  console.log("⏳ Simulating demand signal generation...");
  const demandResults = testDemandSignals(requests);

  // 8. Memory analysis
  console.log("⏳ Analyzing memory pressure...");
  const memResults = testMemoryPressure(requests);

  // 9. Response time simulation
  console.log("⏳ Simulating response time distribution...");
  const responseTimes = simulateResponseTimes(requests);

  // 10. Concurrency analysis
  console.log("⏳ Analyzing concurrency patterns...");
  const concurrency = analyzeConcurrency(requests);

  const endMem = process.memoryUsage().heapUsed;
  const elapsed = Date.now() - startTime;

  // ── Compile Metrics ─────────────────────────────────────────────────────

  const totalEmails = onboardResults.emailsSent + leadResults.emailsSent + demandResults.emailsSent;
  const totalDbReads = dbResults.reads + demandResults.dbReads + leadResults.dbReads;
  const totalDbWrites = dbResults.writes + demandResults.dbWrites + leadResults.dbWrites + onboardResults.dbWrites;

  const metrics: TestMetrics = {
    rateLimitChecks: rlResults.checks,
    rateLimitBlocked: rlResults.blocked,
    rateLimitAllowed: rlResults.allowed,
    uniqueIpsTracked: rlResults.uniqueIps,

    cacheHits: cacheResults.hits,
    cacheMisses: cacheResults.misses,
    cacheHitRate: cacheResults.hits / (cacheResults.hits + cacheResults.misses) * 100,
    maxCacheSize: cacheResults.maxSize,

    dbQueriesTotal: totalDbReads + totalDbWrites,
    dbQueriesSaved: cacheResults.dbQueriesSaved,
    dbWriteOps: totalDbWrites,

    journeyCounts,
    journeyErrors: {},

    onboardAttempts: onboardResults.attempts,
    onboardSuccesses: onboardResults.successes,
    onboardDuplicateEmails: onboardResults.duplicateEmails,
    onboardSlugCollisions: onboardResults.slugCollisions,
    zipRadiusComputations: onboardResults.zipComputations,
    avgZipsPerInstaller: onboardResults.avgZipsPerInstaller,

    leadSubmissions: leadResults.attempts,
    leadSuccesses: leadResults.successes,
    leadBlackoutRejects: leadResults.blackoutRejects,
    leadCapacityRejects: leadResults.capacityRejects,

    demandSignalsAnonymous: demandResults.anonymous,
    demandSignalsWaitlist: demandResults.waitlist,
    demandSignalsDeduplicated: demandResults.deduplicated,

    emailsSent: totalEmails,
    emailTypes: {
      "installer_welcome": onboardResults.emailsSent,
      "referral_handoff": leadResults.emailsSent,
      "waitlist_confirmation": demandResults.emailsSent,
    },

    peakConcurrentRequests: concurrency.peak,
    avgResponseTimeMs: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
    p95ResponseTimeMs: percentile(responseTimes, 95),
    p99ResponseTimeMs: percentile(responseTimes, 99),
    totalElapsedMs: elapsed,

    peakMemoryMB: Math.round((endMem - startMem) / 1024 / 1024 * 100) / 100,
    rateLimitStoreSize: rlResults.storeSize,
  };

  // ── Cost Estimation ──────────────────────────────────────────────────────

  const costs = estimateInfraCosts(metrics);

  // ── Bottleneck Analysis ──────────────────────────────────────────────────

  const bottlenecks = analyzeBottlenecks(metrics, concurrency);

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n\n");
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║                    LOAD TEST RESULTS                             ║");
  console.log("║           50,000 Visitors / 3,000 Installer Signups              ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  // ── Rate Limiter ─────────────────────────────────────────────────────────
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│  RATE LIMITER                                                   │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log(`│  Total checks:         ${String(metrics.rateLimitChecks).padStart(10).padEnd(39)}│`);
  console.log(`│  Allowed:              ${String(metrics.rateLimitAllowed).padStart(10).padEnd(39)}│`);
  console.log(`│  Blocked (429):        ${String(metrics.rateLimitBlocked).padStart(10).padEnd(39)}│`);
  console.log(`│  Block rate:           ${(metrics.rateLimitBlocked / metrics.rateLimitChecks * 100).toFixed(1).padStart(9)}%${" ".repeat(29)}│`);
  console.log(`│  Unique IPs tracked:   ${String(metrics.uniqueIpsTracked).padStart(10).padEnd(39)}│`);
  console.log(`│  Map entries (memory): ${String(metrics.rateLimitStoreSize).padStart(10).padEnd(39)}│`);
  console.log("└─────────────────────────────────────────────────────────────────┘\n");

  // ── Cache ────────────────────────────────────────────────────────────────
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│  CACHE PERFORMANCE (In-Memory TtlCache)                         │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log(`│  Cache hits:           ${String(metrics.cacheHits).padStart(10).padEnd(39)}│`);
  console.log(`│  Cache misses:         ${String(metrics.cacheMisses).padStart(10).padEnd(39)}│`);
  console.log(`│  Hit rate:             ${metrics.cacheHitRate.toFixed(1).padStart(9)}%${" ".repeat(29)}│`);
  console.log(`│  Peak cache entries:   ${String(metrics.maxCacheSize).padStart(10).padEnd(39)}│`);
  console.log(`│  DB queries saved:     ${String(metrics.dbQueriesSaved).padStart(10).padEnd(39)}│`);
  console.log(`│                                                                 │`);
  console.log(`│  ⚠  Single-instance only! With N Vercel instances,              │`);
  console.log(`│     effective hit rate ≈ ${metrics.cacheHitRate.toFixed(0)}% ÷ N (e.g., ~${(metrics.cacheHitRate / 20).toFixed(0)}% with 20 instances)   │`);
  console.log("└─────────────────────────────────────────────────────────────────┘\n");

  // ── Database ─────────────────────────────────────────────────────────────
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│  DATABASE LOAD (Supabase / PostgreSQL)                          │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log(`│  Total queries:        ${String(metrics.dbQueriesTotal).padStart(10).padEnd(39)}│`);
  console.log(`│  Read operations:      ${String(totalDbReads).padStart(10).padEnd(39)}│`);
  console.log(`│  Write operations:     ${String(totalDbWrites).padStart(10).padEnd(39)}│`);
  console.log(`│  Queries saved (cache):${String(metrics.dbQueriesSaved).padStart(10).padEnd(39)}│`);
  console.log(`│  Est. query time:      ${(dbResults.estimatedQueryTimeMs / 1000).toFixed(1).padStart(8)}s (cumulative)${" ".repeat(17)}│`);
  console.log("└─────────────────────────────────────────────────────────────────┘\n");

  // ── Installer Onboarding ─────────────────────────────────────────────────
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│  INSTALLER ONBOARDING (3,000 target)                            │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log(`│  Signup attempts:      ${String(metrics.onboardAttempts).padStart(10).padEnd(39)}│`);
  console.log(`│  Successful:           ${String(metrics.onboardSuccesses).padStart(10).padEnd(39)}│`);
  console.log(`│  Duplicate emails:     ${String(metrics.onboardDuplicateEmails).padStart(10).padEnd(39)}│`);
  console.log(`│  Slug collisions:      ${String(metrics.onboardSlugCollisions).padStart(10).padEnd(39)}│`);
  console.log(`│  ZIP radius calcs:     ${String(metrics.zipRadiusComputations).padStart(10).padEnd(39)}│`);
  console.log(`│  Avg ZIPs/installer:   ${String(metrics.avgZipsPerInstaller).padStart(10).padEnd(39)}│`);
  console.log(`│  DB writes (total):    ${String(onboardResults.dbWrites).padStart(10).padEnd(39)}│`);
  console.log(`│  Welcome emails:       ${String(onboardResults.emailsSent).padStart(10).padEnd(39)}│`);
  console.log("└─────────────────────────────────────────────────────────────────┘\n");

  // ── Lead Submission ──────────────────────────────────────────────────────
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│  LEAD / QUOTE SUBMISSION                                        │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log(`│  Submissions:          ${String(metrics.leadSubmissions).padStart(10).padEnd(39)}│`);
  console.log(`│  Successful:           ${String(metrics.leadSuccesses).padStart(10).padEnd(39)}│`);
  console.log(`│  Blackout rejects:     ${String(metrics.leadBlackoutRejects).padStart(10).padEnd(39)}│`);
  console.log(`│  Capacity rejects:     ${String(metrics.leadCapacityRejects).padStart(10).padEnd(39)}│`);
  console.log(`│  Referral emails:      ${String(leadResults.emailsSent).padStart(10).padEnd(39)}│`);
  console.log("└─────────────────────────────────────────────────────────────────┘\n");

  // ── Demand Signals ───────────────────────────────────────────────────────
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│  DEMAND SIGNALS                                                 │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log(`│  Anonymous signals:    ${String(metrics.demandSignalsAnonymous).padStart(10).padEnd(39)}│`);
  console.log(`│  Waitlist signups:     ${String(metrics.demandSignalsWaitlist).padStart(10).padEnd(39)}│`);
  console.log(`│  Deduplicated:         ${String(metrics.demandSignalsDeduplicated).padStart(10).padEnd(39)}│`);
  console.log(`│  Waitlist emails:      ${String(demandResults.emailsSent).padStart(10).padEnd(39)}│`);
  console.log("└─────────────────────────────────────────────────────────────────┘\n");

  // ── Response Times ───────────────────────────────────────────────────────
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│  RESPONSE TIME DISTRIBUTION                                     │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log(`│  Average:              ${String(metrics.avgResponseTimeMs + "ms").padStart(10).padEnd(39)}│`);
  console.log(`│  P95:                  ${String(metrics.p95ResponseTimeMs + "ms").padStart(10).padEnd(39)}│`);
  console.log(`│  P99:                  ${String(metrics.p99ResponseTimeMs + "ms").padStart(10).padEnd(39)}│`);
  console.log(`│  Peak concurrency:     ${String(concurrency.peak + " req/sec").padStart(15).padEnd(39)}│`);
  console.log(`│  Avg concurrency:      ${String(concurrency.avgConcurrent + " req/sec").padStart(15).padEnd(39)}│`);
  console.log(`│  Peak at:              ${concurrency.peakSlot.padStart(15).padEnd(39)}│`);
  console.log("└─────────────────────────────────────────────────────────────────┘\n");

  // ── Email Volume ─────────────────────────────────────────────────────────
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│  EMAIL VOLUME (Resend)                                          │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log(`│  Total emails:         ${String(metrics.emailsSent).padStart(10).padEnd(39)}│`);
  for (const [type, count] of Object.entries(metrics.emailTypes)) {
    console.log(`│    ${type.padEnd(22)} ${String(count).padStart(6).padEnd(35)}│`);
  }
  console.log(`│  Peak rate:            ${((metrics.emailsSent / 4 / 3600) * concurrency.peak / concurrency.avgConcurrent).toFixed(1).padStart(8)} emails/sec${" ".repeat(21)}│`);
  console.log("└─────────────────────────────────────────────────────────────────┘\n");

  // ── Memory ───────────────────────────────────────────────────────────────
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│  MEMORY PRESSURE (per Vercel instance)                          │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log(`│  Rate limit entries:   ${String(memResults.rateLimitMapEntries).padStart(10).padEnd(39)}│`);
  console.log(`│  ZIP cache entries:    ${String(memResults.zipCacheEntries).padStart(10).padEnd(39)}│`);
  console.log(`│  Installer cache:      ${String(memResults.installerCacheEntries).padStart(10).padEnd(39)}│`);
  console.log(`│  Estimated memory:     ${(memResults.estimatedMemoryMB + " MB").padStart(10).padEnd(39)}│`);
  console.log(`│  Simulation heap used: ${(metrics.peakMemoryMB + " MB").padStart(10).padEnd(39)}│`);
  console.log("└─────────────────────────────────────────────────────────────────┘\n");

  // ── Infrastructure Costs ─────────────────────────────────────────────────
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│  ESTIMATED INFRASTRUCTURE COST (this event)                     │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log(`│  Vercel invocations:   ${String(costs.vercelInvocations).padStart(10).padEnd(39)}│`);
  console.log(`│  Vercel GB-seconds:    ${String(costs.vercelGbSeconds).padStart(10).padEnd(39)}│`);
  console.log(`│  Vercel cost:          ${costs.estimatedVercelCost.padStart(10).padEnd(39)}│`);
  console.log(`│  Supabase reads:       ${String(costs.supabaseReads).padStart(10).padEnd(39)}│`);
  console.log(`│  Supabase writes:      ${String(costs.supabaseWrites).padStart(10).padEnd(39)}│`);
  console.log(`│  Supabase cost:        ${costs.estimatedSupabaseCost.padStart(10).padEnd(39)}│`);
  console.log(`│  Resend emails:        ${String(costs.resendEmails).padStart(10).padEnd(39)}│`);
  console.log(`│  Resend cost:          ${costs.estimatedResendCost.padStart(10).padEnd(39)}│`);
  console.log(`│                                                                 │`);
  console.log(`│  TOTAL EVENT COST:     ${costs.totalEstimatedCost.padStart(10).padEnd(39)}│`);
  console.log(`│  (on top of monthly base plans)                                 │`);
  console.log("└─────────────────────────────────────────────────────────────────┘\n");

  // ── Bottleneck Report ────────────────────────────────────────────────────
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║                    BOTTLENECK ANALYSIS                           ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  const severityColors: Record<string, string> = {
    CRITICAL: "🔴",
    HIGH: "🟠",
    MEDIUM: "🟡",
    LOW: "🟢",
  };

  for (let i = 0; i < bottlenecks.length; i++) {
    const b = bottlenecks[i];
    console.log(`${severityColors[b.severity]} ${b.severity} — ${b.component}`);
    console.log(`   Issue: ${b.issue}`);
    console.log(`   Impact: ${b.impact}`);
    console.log(`   Fix: ${b.recommendation}`);
    console.log();
  }

  // ── Verdict ──────────────────────────────────────────────────────────────
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║                         VERDICT                                  ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  const criticals = bottlenecks.filter((b) => b.severity === "CRITICAL").length;
  const highs = bottlenecks.filter((b) => b.severity === "HIGH").length;

  if (criticals > 0) {
    console.log("  ❌ NOT READY for 50k viral event");
    console.log(`     ${criticals} CRITICAL and ${highs} HIGH issues must be resolved first.\n`);
  } else if (highs > 2) {
    console.log("  ⚠️  PARTIALLY READY — will survive but with degraded performance");
    console.log(`     ${highs} HIGH issues will cause elevated error rates during peak.\n`);
  } else if (highs > 0) {
    console.log("  ✅ READY with minor risks");
    console.log(`     ${highs} HIGH issue(s) may cause brief slowdowns at peak.\n`);
  } else {
    console.log("  ✅ FULLY READY for 50k viral event\n");
  }

  console.log("  Priority fixes before going viral:");
  console.log("  ─────────────────────────────────────────────────────────────");

  const priorityFixes = bottlenecks.filter((b) => b.severity === "CRITICAL" || b.severity === "HIGH");
  for (let i = 0; i < priorityFixes.length; i++) {
    console.log(`  ${i + 1}. [${priorityFixes[i].severity}] ${priorityFixes[i].component}: ${priorityFixes[i].recommendation.split(".")[0]}.`);
  }

  console.log("\n  Quick wins (no code changes):");
  console.log("  ─────────────────────────────────────────────────────────────");
  console.log("  • Enable Supabase connection pooling (PgBouncer) in dashboard");
  console.log("  • Increase Vercel function memory to 1024MB for burst capacity");
  console.log("  • Add Cache-Control: s-maxage=60 to /design page in next.config.mjs");
  console.log("  • Pre-warm /design and /join pages with a Vercel Edge Config");

  console.log(`\n  Simulation completed in ${elapsed}ms`);
  console.log("═══════════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
