import { describe, expect, it } from "vitest";
import { classifyPlansReferrer, plansPageKind, summarizePlansAnalytics, type PlansViewRow } from "./plans-analytics";

const view = (page_path: string, visitor_id: string, created_at: string, referrer: string | null = null): PlansViewRow => ({
  page_path,
  visitor_id,
  session_id: `s-${visitor_id}`,
  referrer,
  created_at,
});

describe("plansPageKind", () => {
  it("splits the plans area into storefront, designer and buyer pages", () => {
    expect(plansPageKind("/plans")).toBe("storefront");
    expect(plansPageKind("/plans/adirondack-chair")).toBe("storefront");
    expect(plansPageKind("/plans/jig")).toBe("storefront");
    expect(plansPageKind("/plans/checkout?design=H4x4")).toBe("designer");
    expect(plansPageKind("/plans/build")).toBe("owner");
    expect(plansPageKind("/plans/library/")).toBe("owner");
  });
});

describe("classifyPlansReferrer", () => {
  it("names search engines and AI assistants", () => {
    expect(classifyPlansReferrer(null)).toBe("Direct");
    expect(classifyPlansReferrer("https://www.google.com/")).toBe("Google");
    expect(classifyPlansReferrer("https://chatgpt.com/")).toBe("ChatGPT");
    expect(classifyPlansReferrer("https://www.perplexity.ai/search")).toBe("Perplexity");
    expect(classifyPlansReferrer("https://storage-network.app/")).toBe("Storage Network (internal)");
  });
});

describe("summarizePlansAnalytics", () => {
  it("counts visitors (not views) through the funnel and prices sales at list", () => {
    const views = [
      view("/plans", "a", "2026-10-20T10:00:00Z", "https://www.google.com/"),
      view("/plans/checkout", "a", "2026-10-20T10:01:00Z"),
      ...Array.from({ length: 30 }, (_, i) => view("/plans/checkout", "a", `2026-10-20T10:${String(i + 2).padStart(2, "0")}:00Z`)),
      view("/plans", "b", "2026-10-21T09:00:00Z", "https://chatgpt.com/"),
      view("/plans/adirondack-chair", "c", "2026-10-21T11:00:00Z"),
    ];
    const purchases = [
      { plan_id: "tote-organizer", tier: "pdf", email: "a@x.com", purchased_at: "2026-10-20T10:40:00Z", upgraded_at: null },
      { plan_id: "tote-organizer", tier: "interactive", email: "d@x.com", purchased_at: "2026-10-21T12:00:00Z", upgraded_at: "2026-10-22T08:00:00Z" },
      { plan_id: "adirondack-chair", tier: null, email: "c@x.com", purchased_at: "2026-10-21T11:30:00Z", upgraded_at: null },
      { plan_id: "ladder-jig", tier: null, email: "A@x.com", purchased_at: "2026-10-21T13:00:00Z", upgraded_at: null },
    ];
    const upgrades = [purchases[1]];
    const splits = [
      { amount_cents: 500, status: "paid", reason: "referral", recipient_name: "Elite", created_at: "2026-10-20T10:41:00Z" },
      { amount_cents: 250, status: "failed", reason: "bestseller", recipient_name: "Gass", created_at: "2026-10-21T12:01:00Z" },
    ];
    const r = summarizePlansAnalytics(views, purchases, upgrades, splits, new Set(["a@x.com"]));

    expect(r.kpis).toMatchObject({ visitors: 3, storefrontVisitors: 3, designerVisitors: 1, purchases: 4, splitsPaid: 500 });
    // $19 PDF + $19 (bought as PDF, then upgraded) + $18 chair + $5 jig (tote owner) + $10 upgrade
    expect(r.kpis.revenue).toBe(1900 + 1900 + 1800 + 500 + 1000);
    expect(r.funnel.map((f) => f.count)).toEqual([3, 1, 2]);
    expect(r.kpis.designerConversion).toBe(200);
    expect(r.pages.find((p) => p.page === "/plans/checkout")).toMatchObject({ visitors: 1, views: 31, kind: "designer" });
    expect(r.sources).toEqual(
      expect.arrayContaining([
        { source: "Google", visitors: 1 },
        { source: "ChatGPT", visitors: 1 },
        { source: "Direct", visitors: 1 },
      ]),
    );
    expect(r.byDay.find((d) => d.date === "2026-10-21")).toEqual({ date: "2026-10-21", visitors: 2, purchases: 3 });
    expect(r.byPlan.find((p) => p.plan === "PDF → 3D guide upgrade")).toEqual({ plan: "PDF → 3D guide upgrade", purchases: 1, revenue: 1000 });
    expect(r.recentPurchases[0].plan).toBe("Ladder jig plan");
    expect(r.recentPurchases.find((p) => p.email === "d@x.com")?.plan).toBe("Tote plan — Interactive Build Guide (upgraded)");
  });

  it("returns an empty, zeroed summary with no activity", () => {
    const r = summarizePlansAnalytics([], [], [], []);
    expect(r.kpis).toEqual({ visitors: 0, storefrontVisitors: 0, designerVisitors: 0, purchases: 0, revenue: 0, designerConversion: 0, splitsPaid: 0 });
    expect(r.byDay).toEqual([]);
  });
});
