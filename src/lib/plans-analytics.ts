// ═══════════════════════════════════════════════════════════════════════════
// DIY Plans analytics — pure aggregation for the admin "Plans" tab.
//
// Inputs are raw rows (human page views under /plans, retail plan purchases,
// installer split payouts); the server action in
// src/app/actions/plans-analytics.ts fetches them behind the admin check.
//
// Funnel: storefront visitors (/plans, /plans/jig, /plans/<slug>) → designer
// visitors (/plans/checkout) → tote plan buyers. Visitors, not views: the
// designer rewrites its URL on every edit, so views overstate interest.
// Revenue is at list price — purchases don't store the amount charged. The
// ladder jig is priced from whether the buyer owned a tote plan (owner price).
// ═══════════════════════════════════════════════════════════════════════════

import {
  TOTE_PLAN_ALL_ACCESS,
  TOTE_PLAN_ALL_ACCESS_SINCE,
  TOTE_PLAN_TIERS,
  TOTE_PLAN_UPGRADE_PRICE,
  totePlanPricePaid,
} from "@/lib/tote-plans";
import { getPlanById } from "@/lib/plans-config";
import { LADDER_JIG_OWNER_PRICE, LADDER_JIG_PLAN_ID, LADDER_JIG_PRICE } from "@/lib/ladder-jig";
import { PLAN_EVENTS, type PlanEvent } from "@/lib/plan-events";

export interface PlansViewRow {
  page_path: string;
  visitor_id: string | null;
  session_id: string | null;
  referrer: string | null;
  created_at: string;
}

export interface PlansPurchaseRow {
  plan_id: string;
  tier: string | null;
  email: string;
  purchased_at: string;
  upgraded_at: string | null;
  /** Stripe Checkout Session that paid for it — matches plan_checkout_starts. */
  stripe_session_id?: string | null;
}

/** One click on "Buy" that sent the buyer to Stripe (plan_checkout_starts). */
export interface PlansCheckoutStartRow {
  stripe_session_id: string;
  plan_id: string;
  tier: string | null;
  amount_cents: number;
  visitor_id: string | null;
  created_at: string;
}

/** Stripe keeps an unpaid Checkout Session open this long before it expires. */
const CHECKOUT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface PlansSplitRow {
  amount_cents: number;
  status: string;
  reason: string;
  recipient_name: string;
  created_at: string;
}

export type PlansPageKind = "storefront" | "designer" | "owner";

export interface PlansAnalytics {
  kpis: {
    visitors: number;
    storefrontVisitors: number;
    designerVisitors: number;
    purchases: number;
    /** Cents, list price, incl. upgrades in the period */
    revenue: number;
    /** Tote plan buyers ÷ designer visitors, % */
    designerConversion: number;
    splitsPaid: number;
    /** Unique visitors who clicked Buy and were sent to Stripe */
    checkoutVisitors: number;
    /** Stripe payment pages opened (a visitor can open several) */
    checkoutSessions: number;
    /** Sessions that reached Stripe and expired unpaid (older than 24h, no purchase) */
    abandonedCheckouts: number;
    /** Cents those abandoned sessions would have brought in */
    abandonedValue: number;
    /** Sessions under 24h old with no purchase yet — can still be paid */
    openCheckouts: number;
  };
  funnel: { step: string; count: number }[];
  byDay: { date: string; visitors: number; purchases: number }[];
  pages: { page: string; kind: PlansPageKind; views: number; visitors: number }[];
  sources: { source: string; visitors: number }[];
  byPlan: { plan: string; purchases: number; revenue: number }[];
  recentPurchases: { plan: string; email: string; purchasedAt: string; upgradedAt: string | null }[];
  splits: { recipient: string; reason: string; amount: number; status: string; createdAt: string }[];
  /** Buyers whose plan links look shared (see summarizeDeviceSharing) */
  sharing?: SharingFlag[];
  /** Visitors left out as staff / testing (see excludeStaffTraffic) */
  excludedVisitors?: number;
  /** What designer visitors did (plan_events), unique visitors per event */
  designer?: { event: PlanEvent; label: string; visitors: number }[];
  /** Designer visitors inside Facebook / Instagram's in-app browser */
  designerInApp?: number;
  /** "Email me my design" requests (the $5-off offer), newest first */
  designLeads?: { email: string; design: string; createdAt: string; bought: boolean }[];
}

export interface PlansEventRow {
  event: string;
  visitor_id: string | null;
  session_id: string | null;
}

/**
 * Leave staff and testing out of the funnel: every visitor who has used the
 * dashboard, and every visitor seen on an IP address one of them used (the
 * owner's other browsers and phones on the same network).
 */
export function excludeStaffTraffic<T extends { visitor_id: string | null; ip?: string | null }>(
  views: T[],
  staffVisitors: ReadonlySet<string>,
  staffIps: ReadonlySet<string>,
): { views: T[]; excluded: Set<string> } {
  const excluded = new Set<string>();
  for (const v of views) {
    if (!v.visitor_id) continue;
    if (staffVisitors.has(v.visitor_id) || (v.ip && staffIps.has(v.ip))) excluded.add(v.visitor_id);
  }
  return { views: views.filter((v) => !v.visitor_id || !excluded.has(v.visitor_id)), excluded };
}

/** Unique visitors per designer event, in the order a buyer meets them. */
export function summarizeDesignerEvents(events: PlansEventRow[]): { event: PlanEvent; label: string; visitors: number }[] {
  const by = new Map<string, Set<string>>();
  for (const e of events) {
    const who = e.visitor_id ?? e.session_id;
    if (!who || !(e.event in PLAN_EVENTS)) continue;
    if (!by.has(e.event)) by.set(e.event, new Set());
    by.get(e.event)!.add(who);
  }
  return (Object.keys(PLAN_EVENTS) as PlanEvent[]).map((event) => ({
    event,
    label: PLAN_EVENTS[event],
    visitors: by.get(event)?.size ?? 0,
  }));
}

export interface PlanDeviceRow {
  email: string;
  verified_by: string;
  revoked_at: string | null;
  last_seen_at: string;
}

export interface SharingFlag {
  email: string;
  /** Devices that ever opened the buyer's plans */
  devices: number;
  /** Still allowed in */
  active: number;
  /** "Confirm it's you" codes requested in the period */
  codes: number;
  lastSeen: string;
}

/**
 * Buyers worth a look: more devices than the limit ever opened their plans
 * (each new one needed a code from their inbox), or codes requested again
 * and again (someone with the link keeps trying). Most-devices first.
 */
export function summarizeDeviceSharing(
  devices: PlanDeviceRow[],
  codeEmails: string[],
  maxDevices: number,
): SharingFlag[] {
  const byEmail = new Map<string, SharingFlag>();
  const get = (email: string) => {
    const key = email.toLowerCase();
    let f = byEmail.get(key);
    if (!f) byEmail.set(key, (f = { email: key, devices: 0, active: 0, codes: 0, lastSeen: "" }));
    return f;
  };
  for (const d of devices) {
    const f = get(d.email);
    f.devices++;
    if (!d.revoked_at) f.active++;
    if (d.last_seen_at > f.lastSeen) f.lastSeen = d.last_seen_at;
  }
  for (const e of codeEmails) get(e).codes++;
  return [...byEmail.values()]
    .filter((f) => f.devices > maxDevices || f.codes >= 3)
    .sort((a, b) => b.devices - a.devices || b.codes - a.codes);
}

/** Which part of the plans area a path belongs to. */
export function plansPageKind(path: string): PlansPageKind {
  const p = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (p === "/plans/checkout") return "designer";
  if (/^\/plans\/(build|library|access)(\/|$)/.test(p)) return "owner";
  return "storefront";
}

/** Human-readable plan name for a purchase row. */
export function planLabel(
  row: Pick<PlansPurchaseRow, "plan_id" | "tier" | "upgraded_at"> & { purchased_at?: string }
): string {
  if (row.plan_id === "tote-organizer") {
    if (row.purchased_at && row.purchased_at >= TOTE_PLAN_ALL_ACCESS_SINCE) return `Tote plan — ${TOTE_PLAN_ALL_ACCESS.name}`;
    const tier = row.tier === "interactive" ? TOTE_PLAN_TIERS.interactive.name : TOTE_PLAN_TIERS.pdf.name;
    return `Tote plan — ${tier}${row.upgraded_at ? " (upgraded)" : ""}`;
  }
  if (row.plan_id === LADDER_JIG_PLAN_ID) return "Ladder jig plan";
  return getPlanById(row.plan_id)?.name ?? row.plan_id;
}

/** Price in cents of the original purchase (upgrades counted separately). */
function purchasePrice(row: PlansPurchaseRow, toteOwners: ReadonlySet<string>, paid?: ReadonlyMap<string, number>): number {
  // What the checkout actually charged, when we logged it (e.g. the $14 exit offer)
  const charged = row.stripe_session_id ? paid?.get(row.stripe_session_id) : undefined;
  if (charged !== undefined) return charged;
  if (row.plan_id === "tote-organizer") {
    // An upgraded row now reads 'interactive' but was bought as the PDF
    // Sale-aware: bought before TOTE_PLAN_SALE_SINCE → list price.
    return totePlanPricePaid(row.upgraded_at || row.tier !== "interactive" ? "pdf" : "interactive", row.purchased_at);
  }
  if (row.plan_id === LADDER_JIG_PLAN_ID) {
    return toteOwners.has(row.email.toLowerCase()) ? LADDER_JIG_OWNER_PRICE : LADDER_JIG_PRICE;
  }
  return getPlanById(row.plan_id)?.price ?? 0;
}

export function classifyPlansReferrer(referrer: string | null): string {
  if (!referrer) return "Direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "storage-network.app" || host.endsWith(".storage-network.app")) return "Storage Network (internal)";
    if (/(^|\.)google\./.test(host)) return "Google";
    if (host.endsWith("bing.com")) return "Bing";
    if (host === "chatgpt.com" || host.endsWith("openai.com")) return "ChatGPT";
    if (host.endsWith("perplexity.ai")) return "Perplexity";
    if (host.endsWith("claude.ai")) return "Claude";
    if (host.endsWith("gemini.google.com")) return "Gemini";
    if (host.endsWith("copilot.microsoft.com")) return "Copilot";
    if (/facebook\.com$|fb\.me$|fb\.com$/.test(host)) return "Facebook";
    if (host.endsWith("instagram.com")) return "Instagram";
    if (host.endsWith("youtube.com") || host === "youtu.be") return "YouTube";
    if (host.endsWith("pinterest.com")) return "Pinterest";
    if (host.endsWith("reddit.com")) return "Reddit";
    if (host.endsWith("tiktok.com")) return "TikTok";
    if (host === "t.co" || host === "x.com" || host.endsWith("twitter.com")) return "X / Twitter";
    if (host.endsWith("duckduckgo.com")) return "DuckDuckGo";
    return host;
  } catch {
    return "Other";
  }
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

export function summarizePlansAnalytics(
  views: PlansViewRow[],
  purchases: PlansPurchaseRow[],
  upgrades: PlansPurchaseRow[],
  splits: PlansSplitRow[],
  /** Lower-cased emails that own a tote plan (any time) — for jig owner pricing */
  toteOwners: ReadonlySet<string> = new Set(),
  /** Buy clicks that reached Stripe (plan_checkout_starts) */
  checkoutStarts: PlansCheckoutStartRow[] = [],
  now: number = Date.now(),
): PlansAnalytics {
  // A visitor without a stored id still counts, once per session
  const who = (v: PlansViewRow) => v.visitor_id ?? v.session_id ?? `${v.created_at}|${v.page_path}`;

  const all = new Set<string>();
  const storefront = new Set<string>();
  const designer = new Set<string>();
  const pageMap = new Map<string, { views: number; visitors: Set<string> }>();
  const dayVisitors = new Map<string, Set<string>>();
  const firstSeen = new Map<string, PlansViewRow>();

  for (const v of [...views].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const id = who(v);
    const path = v.page_path.split("?")[0];
    const kind = plansPageKind(path);
    all.add(id);
    if (kind === "storefront") storefront.add(id);
    if (kind === "designer") designer.add(id);
    const page = pageMap.get(path) ?? { views: 0, visitors: new Set<string>() };
    page.views++;
    page.visitors.add(id);
    pageMap.set(path, page);
    const day = v.created_at.slice(0, 10);
    if (!dayVisitors.has(day)) dayVisitors.set(day, new Set());
    dayVisitors.get(day)!.add(id);
    if (!firstSeen.has(id)) firstSeen.set(id, v);
  }

  // Source = where each visitor came from on their first plans page
  const sourceMap = new Map<string, number>();
  for (const v of firstSeen.values()) {
    const s = classifyPlansReferrer(v.referrer);
    sourceMap.set(s, (sourceMap.get(s) ?? 0) + 1);
  }

  const dayPurchases = new Map<string, number>();
  const planMap = new Map<string, { purchases: number; revenue: number }>();
  let revenue = 0;
  const paid = new Map(checkoutStarts.map((c) => [c.stripe_session_id, c.amount_cents]));
  for (const p of purchases) {
    const day = p.purchased_at.slice(0, 10);
    dayPurchases.set(day, (dayPurchases.get(day) ?? 0) + 1);
    const label = planLabel({ ...p, upgraded_at: null, tier: p.upgraded_at ? "pdf" : p.tier });
    const price = purchasePrice(p, toteOwners, paid);
    const entry = planMap.get(label) ?? { purchases: 0, revenue: 0 };
    entry.purchases++;
    entry.revenue += price;
    planMap.set(label, entry);
    revenue += price;
  }
  if (upgrades.length > 0) {
    planMap.set("PDF → 3D guide upgrade", { purchases: upgrades.length, revenue: upgrades.length * TOTE_PLAN_UPGRADE_PRICE });
    revenue += upgrades.length * TOTE_PLAN_UPGRADE_PRICE;
  }

  const toteBuyers = purchases.filter((p) => p.plan_id === "tote-organizer").length;

  // ── Stripe step: clicked Buy → payment page → paid or walked away ──
  const toteStarts = checkoutStarts.filter((c) => c.plan_id === "tote-organizer");
  const paidSessions = new Set(purchases.map((p) => p.stripe_session_id).filter(Boolean) as string[]);
  const checkoutWho = new Set(toteStarts.map((c) => c.visitor_id ?? c.stripe_session_id));
  let abandonedCheckouts = 0;
  let abandonedValue = 0;
  let openCheckouts = 0;
  for (const c of toteStarts) {
    if (paidSessions.has(c.stripe_session_id)) continue;
    if (now - Date.parse(c.created_at) < CHECKOUT_SESSION_TTL_MS) {
      openCheckouts++;
    } else {
      abandonedCheckouts++;
      abandonedValue += c.amount_cents;
    }
  }
  const days = [...new Set([...dayVisitors.keys(), ...dayPurchases.keys()])].sort();

  return {
    kpis: {
      visitors: all.size,
      storefrontVisitors: storefront.size,
      designerVisitors: designer.size,
      purchases: purchases.length,
      revenue,
      designerConversion: pct(toteBuyers, designer.size),
      splitsPaid: splits.filter((s) => s.status === "paid").reduce((n, s) => n + s.amount_cents, 0),
      checkoutVisitors: checkoutWho.size,
      checkoutSessions: toteStarts.length,
      abandonedCheckouts,
      abandonedValue,
      openCheckouts,
    },
    funnel: [
      { step: "Visited the plans storefront", count: storefront.size },
      { step: "Opened the designer", count: designer.size },
      { step: "Clicked buy → sent to Stripe payment", count: checkoutWho.size },
      { step: "Paid for a tote plan", count: toteBuyers },
    ],
    byDay: days.map((date) => ({
      date,
      visitors: dayVisitors.get(date)?.size ?? 0,
      purchases: dayPurchases.get(date) ?? 0,
    })),
    pages: [...pageMap.entries()]
      .map(([page, d]) => ({ page, kind: plansPageKind(page), views: d.views, visitors: d.visitors.size }))
      .sort((a, b) => b.visitors - a.visitors || b.views - a.views),
    sources: [...sourceMap.entries()]
      .map(([source, visitors]) => ({ source, visitors }))
      .sort((a, b) => b.visitors - a.visitors),
    byPlan: [...planMap.entries()]
      .map(([plan, d]) => ({ plan, ...d }))
      .sort((a, b) => b.revenue - a.revenue),
    recentPurchases: [...purchases]
      .sort((a, b) => b.purchased_at.localeCompare(a.purchased_at))
      .slice(0, 20)
      .map((p) => ({ plan: planLabel(p), email: p.email, purchasedAt: p.purchased_at, upgradedAt: p.upgraded_at })),
    splits: [...splits]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 20)
      .map((s) => ({ recipient: s.recipient_name, reason: s.reason, amount: s.amount_cents, status: s.status, createdAt: s.created_at })),
  };
}
