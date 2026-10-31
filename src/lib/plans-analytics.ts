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

import { TOTE_PLAN_TIERS, TOTE_PLAN_UPGRADE_PRICE } from "@/lib/tote-plans";
import { getPlanById } from "@/lib/plans-config";
import { LADDER_JIG_OWNER_PRICE, LADDER_JIG_PLAN_ID, LADDER_JIG_PRICE } from "@/lib/ladder-jig";

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
}

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
export function planLabel(row: Pick<PlansPurchaseRow, "plan_id" | "tier" | "upgraded_at">): string {
  if (row.plan_id === "tote-organizer") {
    const tier = row.tier === "interactive" ? TOTE_PLAN_TIERS.interactive.name : TOTE_PLAN_TIERS.pdf.name;
    return `Tote plan — ${tier}${row.upgraded_at ? " (upgraded)" : ""}`;
  }
  if (row.plan_id === LADDER_JIG_PLAN_ID) return "Ladder jig plan";
  return getPlanById(row.plan_id)?.name ?? row.plan_id;
}

/** List price in cents of the original purchase (upgrades counted separately). */
function purchasePrice(row: PlansPurchaseRow, toteOwners: ReadonlySet<string>): number {
  if (row.plan_id === "tote-organizer") {
    // An upgraded row now reads 'interactive' but was bought as the PDF
    return row.upgraded_at || row.tier !== "interactive" ? TOTE_PLAN_TIERS.pdf.price : TOTE_PLAN_TIERS.interactive.price;
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
  for (const p of purchases) {
    const day = p.purchased_at.slice(0, 10);
    dayPurchases.set(day, (dayPurchases.get(day) ?? 0) + 1);
    const label = planLabel({ ...p, upgraded_at: null, tier: p.upgraded_at ? "pdf" : p.tier });
    const price = purchasePrice(p, toteOwners);
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
    },
    funnel: [
      { step: "Visited the plans storefront", count: storefront.size },
      { step: "Opened the designer", count: designer.size },
      { step: "Bought a tote plan", count: toteBuyers },
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
