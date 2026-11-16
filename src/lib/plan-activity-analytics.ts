// ═══════════════════════════════════════════════════════════════════════════
// Buyer activity → the admin "Buyer activity" card (Platform Analytics →
// Plans). Pure functions over plan_buyer_activity + purchase rows, so the
// numbers are tested without a database.
// ═══════════════════════════════════════════════════════════════════════════

import { planActivityLabel } from "@/lib/plan-activity";

/** First day plan_buyer_activity was recorded (migration 161). */
export const PLAN_ACTIVITY_SINCE = "2026-11-16";

export interface ActivityRow {
  access_token: string;
  email: string;
  plan_id: string;
  event: string;
  detail: string | null;
  value: number | null;
  total: number | null;
  device_hash: string | null;
  created_at: string;
}

export interface BuyerPurchaseRow {
  email: string;
  plan_id: string;
  purchased_at: string;
  /** Gifted purchases carry "<cs>__gift_<n>" */
  stripe_session_id: string | null;
}

export interface BuyerActivitySummary {
  email: string;
  plans: number;
  gifted: boolean;
  firstPurchasedAt: string | null;
  firstOpenedAt: string | null;
  lastActiveAt: string | null;
  opens: number;
  devices: number;
  guideOpens: number;
  /** Seconds spent in the guide (sum of closes) */
  guideSeconds: number;
  /** Furthest step reached in any section, e.g. "Module A · 9 of 12" */
  furthestStep: string | null;
  sectionsFinished: number;
  pdfDownloads: number;
  plansBuilt: number;
  shopProgress: string | null;
  lastEvent: string | null;
}

export interface EngagementStep {
  label: string;
  count: number;
  pct: number;
}

export interface BuyerActivityReport {
  /** Buyers who purchased in the period */
  buyers: number;
  engagement: EngagementStep[];
  /** Median minutes from purchase to first open (buyers who opened) */
  medianMinutesToOpen: number | null;
  /** Buyers who purchased in the period and haven't opened anything */
  neverOpened: { email: string; purchasedAt: string; gifted: boolean }[];
  rows: BuyerActivitySummary[];
}

const OPEN_EVENTS = new Set(["open", "jig_open", "library_open", "gift_open"]);

export function summarizeBuyerActivity(
  activity: ActivityRow[],
  purchases: BuyerPurchaseRow[],
  opts: { maxRows?: number } = {}
): BuyerActivityReport {
  const norm = (e: string) => e.trim().toLowerCase();
  const byEmail = new Map<string, ActivityRow[]>();
  for (const a of [...activity].sort((x, y) => x.created_at.localeCompare(y.created_at))) {
    const k = norm(a.email);
    const list = byEmail.get(k) ?? [];
    list.push(a);
    byEmail.set(k, list);
  }
  const bought = new Map<string, BuyerPurchaseRow[]>();
  for (const p of purchases) {
    const k = norm(p.email);
    const list = bought.get(k) ?? [];
    list.push(p);
    bought.set(k, list);
  }

  const summarize = (email: string): BuyerActivitySummary => {
    const events = byEmail.get(email) ?? [];
    const mine = (bought.get(email) ?? []).sort((a, b) => a.purchased_at.localeCompare(b.purchased_at));
    const opens = events.filter((e) => OPEN_EVENTS.has(e.event));
    let furthest: { pct: number; label: string } | null = null;
    for (const e of events) {
      if (e.event !== "guide_step" || !e.value || !e.total) continue;
      const pct = e.value / e.total;
      if (!furthest || pct > furthest.pct) furthest = { pct, label: `${e.detail ?? "Guide"} · ${e.value} of ${e.total}` };
    }
    const shop = [...events].reverse().find((e) => e.event === "shop_progress" && e.total);
    const last = events[events.length - 1];
    return {
      email,
      plans: mine.length,
      gifted: mine.some((p) => p.stripe_session_id?.includes("__gift_")),
      firstPurchasedAt: mine[0]?.purchased_at ?? null,
      firstOpenedAt: opens[0]?.created_at ?? null,
      lastActiveAt: last?.created_at ?? null,
      opens: opens.length,
      devices: new Set(events.map((e) => e.device_hash).filter(Boolean)).size,
      guideOpens: events.filter((e) => e.event === "guide_open").length,
      guideSeconds: events.filter((e) => e.event === "guide_close").reduce((s, e) => s + Math.max(0, e.value ?? 0), 0),
      furthestStep: furthest?.label ?? null,
      sectionsFinished: new Set(events.filter((e) => e.event === "guide_section_done").map((e) => `${e.access_token}:${e.detail}`)).size,
      pdfDownloads: events.filter((e) => e.event === "pdf_download").length,
      plansBuilt: events.filter((e) => e.event === "included_plan").length,
      shopProgress: shop ? `${shop.value ?? 0} of ${shop.total}` : null,
      lastEvent: last ? planActivityLabel(last.event) : null,
    };
  };

  // Engagement: of the buyers who purchased in the period, who did what.
  const buyerEmails = [...bought.keys()];
  const did = (email: string, test: (e: ActivityRow) => boolean) => (byEmail.get(email) ?? []).some(test);
  const steps: [string, (e: ActivityRow) => boolean][] = [
    ["Opened their plan", (e) => OPEN_EVENTS.has(e.event)],
    ["Opened the 3D guide", (e) => e.event === "guide_open"],
    ["Finished a guide section", (e) => e.event === "guide_section_done"],
    ["Downloaded the PDF", (e) => e.event === "pdf_download"],
    ["Used the shopping list", (e) => e.event === "shop_progress" && (e.value ?? 0) > 0],
    ["Built another plan", (e) => e.event === "included_plan"],
  ];
  const n = buyerEmails.length;
  const engagement = steps.map(([label, test]) => {
    const count = buyerEmails.filter((em) => did(em, test)).length;
    return { label, count, pct: n ? Math.round((count / n) * 100) : 0 };
  });

  const minutes: number[] = [];
  const neverOpened: BuyerActivityReport["neverOpened"] = [];
  for (const email of buyerEmails) {
    const first = (bought.get(email) ?? []).map((p) => p.purchased_at).sort()[0];
    const open = (byEmail.get(email) ?? []).find((e) => OPEN_EVENTS.has(e.event) && e.created_at >= first);
    if (open) minutes.push((Date.parse(open.created_at) - Date.parse(first)) / 60000);
    else if (!(byEmail.get(email) ?? []).some((e) => OPEN_EVENTS.has(e.event))) {
      neverOpened.push({ email, purchasedAt: first, gifted: (bought.get(email) ?? []).some((p) => p.stripe_session_id?.includes("__gift_")) });
    }
  }
  minutes.sort((a, b) => a - b);
  const median =
    minutes.length === 0
      ? null
      : Math.round(minutes.length % 2 ? minutes[(minutes.length - 1) / 2] : (minutes[minutes.length / 2 - 1] + minutes[minutes.length / 2]) / 2);

  const everyone = new Set([...byEmail.keys(), ...buyerEmails]);
  const rows = [...everyone]
    .map(summarize)
    .sort((a, b) => (b.lastActiveAt ?? b.firstPurchasedAt ?? "").localeCompare(a.lastActiveAt ?? a.firstPurchasedAt ?? ""))
    .slice(0, opts.maxRows ?? 150);

  return {
    buyers: n,
    engagement,
    medianMinutesToOpen: median,
    neverOpened: neverOpened.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)),
    rows,
  };
}

export interface TimelineEntry {
  at: string;
  event: string;
  label: string;
  /** Human detail, e.g. "Module A · step 4 of 12", "from the email link" */
  detail: string | null;
  plan: string;
  device: string | null;
}

const VIA: Record<string, string> = {
  checkout: "straight from checkout",
  checkout_reload: "checkout link, reopened",
  link: "from their link",
  library: "from My Builds",
  jig: "jig plans",
  button: "from the plan page",
};

/** One buyer's events, newest first, readable. Devices are numbered in order of first use. */
export function buyerTimeline(rows: ActivityRow[], planName: (row: ActivityRow) => string): TimelineEntry[] {
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const deviceNo = new Map<string, number>();
  for (const r of ordered) if (r.device_hash && !deviceNo.has(r.device_hash)) deviceNo.set(r.device_hash, deviceNo.size + 1);
  return ordered
    .map((r) => {
      let detail: string | null = null;
      switch (r.event) {
        case "open":
        case "jig_open":
        case "guide_open":
        case "open_needs_code":
          detail = r.detail ? VIA[r.detail] ?? r.detail : null;
          break;
        case "guide_step":
          detail = `${r.detail ?? "Guide"} · step ${r.value} of ${r.total}`;
          break;
        case "guide_section":
          detail = `${r.detail ?? "Section"} (${r.value} of ${r.total})`;
          break;
        case "guide_section_done":
          detail = r.detail;
          break;
        case "guide_close":
          detail = r.value != null ? `after ${formatDuration(r.value)}` : null;
          break;
        case "pdf_download":
          detail = r.value != null ? `took ${formatDuration(r.value)}${r.detail ? ` · ${r.detail}` : ""}` : r.detail;
          break;
        case "shop_progress":
        case "tools_progress":
          detail = `${r.value ?? 0} of ${r.total ?? "?"} ticked`;
          break;
        default:
          detail = r.detail;
      }
      return {
        at: r.created_at,
        event: r.event,
        label: planActivityLabel(r.event),
        detail,
        plan: planName(r),
        device: r.device_hash ? `Device ${deviceNo.get(r.device_hash)}` : null,
      };
    })
    .reverse();
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60 ? `${s % 60}s` : ""}`.trim();
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
