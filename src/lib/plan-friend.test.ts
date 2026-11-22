import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cleanFriendCode, friendPath, friendPrice } from "./plan-friend";
import { hasUsedPlans, planUsage } from "./plan-reviews";
import { planSplitShares } from "./plan-splits";
import { decodeTotePlanDesign } from "./tote-plans";

describe("friend links", () => {
  it("cleans codes and prices $3 off", () => {
    expect(cleanFriendCode(" AbC23xyz ")).toBe("abc23xyz");
    expect(cleanFriendCode("ab")).toBeNull();
    expect(cleanFriendCode("abc-123!")).toBeNull();
    expect(friendPath("abc23xyz")).toBe("/plans/friend/abc23xyz");
    expect(friendPrice(1900)).toBe(1600);
    expect(friendPrice(1200)).toBe(900);
  });
});

describe("hasUsedPlans", () => {
  const t = (min: number) => new Date(Date.parse("2026-11-14T12:00:00Z") + min * 60000).toISOString();
  it("doesn't count only seeing the page right after paying", () => {
    expect(hasUsedPlans([{ event: "open", detail: "checkout" }], [{ verified_by: "checkout", created_at: t(0), last_seen_at: t(1) }])).toBe(false);
    expect(hasUsedPlans([], [])).toBe(false);
  });
  it("counts coming back later, another device, or using the guide/PDF", () => {
    expect(hasUsedPlans([], [{ verified_by: "checkout", created_at: t(0), last_seen_at: t(60 * 24) }])).toBe(true);
    expect(hasUsedPlans([], [{ verified_by: "code", created_at: t(0), last_seen_at: t(0) }])).toBe(true);
    expect(hasUsedPlans([], [{ verified_by: "first", created_at: t(0), last_seen_at: null }])).toBe(true);
    expect(hasUsedPlans([{ event: "guide_open", detail: null }], [])).toBe(true);
    expect(hasUsedPlans([{ event: "pdf_download", detail: "imperial" }], [])).toBe(true);
    expect(hasUsedPlans([{ event: "open", detail: "link" }], [])).toBe(true);
  });
});

describe("planUsage (all three records)", () => {
  const bought = "2026-11-14T12:55:32Z";
  const checkout = [{ verified_by: "checkout", created_at: bought, last_seen_at: bought }];
  it("is 'not opened' only when nothing shows past the checkout visit", () => {
    const u = planUsage({
      purchasedAt: bought,
      activity: [],
      devices: checkout,
      // The checkout visit itself, then the home page and designer the next day
      pageViews: [
        { page_path: "/plans/build", created_at: "2026-11-14T12:55:32Z" },
        { page_path: "/", created_at: "2026-11-15T17:57:15Z" },
        { page_path: "/design", created_at: "2026-11-15T17:57:44Z" },
      ],
    });
    expect(u.opened).toBe(false);
    expect(u.reason).toMatch(/Only saw their plans while paying/);
  });
  it("counts a later visit to the plans page from their connection", () => {
    const u = planUsage({
      purchasedAt: bought,
      activity: [],
      devices: checkout,
      pageViews: [{ page_path: "/plans/library", created_at: "2026-11-16T10:00:00Z" }],
    });
    expect(u).toMatchObject({ opened: true });
    expect(u.reason).toMatch(/Viewed their plans page/);
  });
  it("explains why someone counts as opened", () => {
    expect(planUsage({ purchasedAt: bought, activity: [{ event: "pdf_download", detail: null }], devices: [] }).reason).toBe("Downloaded the PDF");
    expect(
      planUsage({ purchasedAt: bought, activity: [], devices: [{ verified_by: "code", created_at: "2026-11-15T10:00:00Z", last_seen_at: null }] }).reason,
    ).toMatch(/Opened on another device/);
  });
});

describe("plan splits through a buyer's share link", () => {
  // A design with a named bestseller (Indiana Joe)
  const design = decodeTotePlanDesign("H2x4t_ij.H2x2t_ij.H2x4t_ij")!;
  it("pays bestseller owners normally", () => {
    expect(planSplitShares({ design }).some((s) => s.reason === "bestseller")).toBe(true);
  });
  it("pays no bestseller shares when bought through a buyer's link", () => {
    expect(planSplitShares({ design, viaBuyerReferral: true })).toEqual([]);
  });
  it("still pays an installer referral, without the bestseller bonus", () => {
    const ref = "071e4146-4a6e-4df8-b753-ce5204225b39";
    expect(planSplitShares({ design, referralInstallerId: ref, viaBuyerReferral: true })).toEqual([
      { recipientId: ref, cents: 500, reason: "referral", bestsellers: [] },
    ]);
  });
});
