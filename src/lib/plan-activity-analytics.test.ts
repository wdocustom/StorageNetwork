import { describe, expect, it } from "vitest";
import { buyerTimeline, formatDuration, summarizeBuyerActivity, type ActivityRow, type BuyerPurchaseRow } from "./plan-activity-analytics";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";

const ev = (over: Partial<ActivityRow> & Pick<ActivityRow, "event" | "created_at">): ActivityRow => ({
  access_token: T1,
  email: "jo@example.com",
  plan_id: "tote-organizer",
  detail: null,
  value: null,
  total: null,
  device_hash: "dev-a",
  ...over,
});

const purchases: BuyerPurchaseRow[] = [
  { email: "jo@example.com", plan_id: "tote-organizer", purchased_at: "2026-11-16T10:00:00Z", stripe_session_id: "cs_1" },
  { email: "sam@example.com", plan_id: "tote-organizer", purchased_at: "2026-11-16T11:00:00Z", stripe_session_id: "cs_2__gift_1" },
  { email: "lee@example.com", plan_id: "tote-organizer", purchased_at: "2026-11-16T12:00:00Z", stripe_session_id: "cs_3" },
];

const activity: ActivityRow[] = [
  ev({ event: "open", detail: "checkout", created_at: "2026-11-16T10:02:00Z" }),
  ev({ event: "guide_open", detail: "button", created_at: "2026-11-16T10:05:00Z" }),
  ev({ event: "guide_step", detail: "Module A", value: 4, total: 12, created_at: "2026-11-16T10:06:00Z" }),
  ev({ event: "guide_step", detail: "Module A", value: 12, total: 12, created_at: "2026-11-16T10:20:00Z" }),
  ev({ event: "guide_section_done", detail: "Module A", total: 12, created_at: "2026-11-16T10:20:00Z" }),
  ev({ event: "guide_close", value: 900, created_at: "2026-11-16T10:21:00Z" }),
  ev({ event: "pdf_download", value: 14, detail: "in", created_at: "2026-11-16T10:30:00Z" }),
  ev({ event: "shop_progress", value: 3, total: 9, created_at: "2026-11-16T10:31:00Z" }),
  ev({ event: "open", detail: "link", device_hash: "dev-b", created_at: "2026-11-17T09:00:00Z" }),
  ev({ event: "included_plan", access_token: T2, detail: "Garage wall", created_at: "2026-11-17T09:05:00Z" }),
  ev({ event: "gift_open", email: "Sam@Example.com", access_token: T2, created_at: "2026-11-16T13:00:00Z" }),
];

describe("summarizeBuyerActivity", () => {
  const report = summarizeBuyerActivity(activity, purchases);

  it("measures engagement among buyers in the period", () => {
    expect(report.buyers).toBe(3);
    const by = Object.fromEntries(report.engagement.map((s) => [s.label, s.count]));
    expect(by).toMatchObject({
      "Opened their plan": 2,
      "Opened the 3D guide": 1,
      "Finished a guide section": 1,
      "Downloaded the PDF": 1,
      "Used the shopping list": 1,
      "Built another plan": 1,
    });
    expect(report.engagement[0].pct).toBe(67);
  });

  it("finds the median time to first open and who never opened", () => {
    // Jo: 2 min. Sam (gift page): 120 min. Median of [2, 120] = 61.
    expect(report.medianMinutesToOpen).toBe(61);
    expect(report.neverOpened).toEqual([{ email: "lee@example.com", purchasedAt: "2026-11-16T12:00:00Z", gifted: false }]);
  });

  it("summarizes each buyer", () => {
    const jo = report.rows.find((r) => r.email === "jo@example.com")!;
    expect(jo).toMatchObject({
      opens: 2,
      devices: 2,
      guideOpens: 1,
      guideSeconds: 900,
      furthestStep: "Module A · 12 of 12",
      sectionsFinished: 1,
      pdfDownloads: 1,
      plansBuilt: 1,
      shopProgress: "3 of 9",
      lastEvent: "Built another plan (included)",
      lastActiveAt: "2026-11-17T09:05:00Z",
    });
    expect(report.rows[0].email).toBe("jo@example.com");
    expect(report.rows.find((r) => r.email === "sam@example.com")?.gifted).toBe(true);
  });

  it("handles no data", () => {
    const empty = summarizeBuyerActivity([], []);
    expect(empty).toMatchObject({ buyers: 0, medianMinutesToOpen: null, neverOpened: [], rows: [] });
    expect(empty.engagement.every((s) => s.pct === 0)).toBe(true);
  });
});

describe("buyerTimeline", () => {
  it("reads newest first, with devices numbered in order of first use", () => {
    const tl = buyerTimeline(activity.filter((a) => a.email === "jo@example.com"), (r) => (r.access_token === T1 ? "4×4 Tote Organizer" : "Garage wall"));
    expect(tl[0]).toMatchObject({ label: "Built another plan (included)", detail: "Garage wall", plan: "Garage wall", device: "Device 1" });
    const opens = tl.filter((t) => t.event === "open");
    expect(opens.map((o) => [o.detail, o.device])).toEqual([
      ["from their link", "Device 2"],
      ["straight from checkout", "Device 1"],
    ]);
    expect(tl.find((t) => t.event === "guide_step")?.detail).toBe("Module A · step 12 of 12");
    expect(tl.find((t) => t.event === "guide_close")?.detail).toBe("after 15m");
    expect(tl.find((t) => t.event === "pdf_download")?.detail).toBe("took 14s · in");
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(3720)).toBe("1h 2m");
  });
});
