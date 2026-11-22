import { vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({}) }));
import { describe, expect, it } from "vitest";
import {
  PLAN_REVIEW_TAGS,
  aggregateRatingJsonLd,
  cleanTags,
  cleanText,
  publicName,
  summarizeRatings,
  timeAgo,
} from "./reviews";
import { cleanBuildHours, planBuildSummary, planReviewMeta } from "./plan-reviews";
import { isJpeg } from "./server/review-photos";

describe("summarizeRatings", () => {
  it("averages every rating, not a page of them", () => {
    const rows = [...Array(60).fill({ rating: 5 }), ...Array(40).fill({ rating: 1 })];
    const s = summarizeRatings(rows);
    expect(s.total).toBe(100);
    expect(s.average).toBe(3.4);
    expect(s.distribution[0]).toEqual({ stars: 5, count: 60, pct: 60 });
    expect(s.distribution[4]).toEqual({ stars: 1, count: 40, pct: 40 });
  });

  it("counts tags and ignores bad ratings", () => {
    const s = summarizeRatings([
      { rating: 5, tags: ["a", "b"] },
      { rating: 4, tags: ["a"] },
      { rating: 9, tags: ["z"] },
    ]);
    expect(s.total).toBe(2);
    expect(s.average).toBe(4.5);
    expect(s.topTags).toEqual([
      { tag: "a", count: 2 },
      { tag: "b", count: 1 },
    ]);
  });

  it("is empty with no reviews", () => {
    const s = summarizeRatings([]);
    expect(s).toMatchObject({ average: 0, total: 0, topTags: [] });
    expect(aggregateRatingJsonLd(s)).toBeUndefined();
  });
});

describe("text and names", () => {
  it("shows first name and last initial only", () => {
    expect(publicName("judy smith")).toBe("Judy S.");
    expect(publicName("Doug")).toBe("Doug");
    expect(publicName("  ")).toBe("Verified buyer");
    expect(publicName(null, "Customer")).toBe("Customer");
  });

  it("cleans and caps text", () => {
    expect(cleanText("  hi   there \r\n\n\n\nok ", 100)).toBe("hi there\n\nok");
    expect(cleanText("abcdef", 3)).toBe("abc");
    expect(cleanText("   ", 10)).toBeNull();
    expect(cleanText(42, 10)).toBeNull();
  });

  it("keeps only known tags, once", () => {
    expect(cleanTags(["easy_to_follow", "easy_to_follow", "hacked", 3], PLAN_REVIEW_TAGS)).toEqual(["easy_to_follow"]);
    expect(cleanTags("nope", PLAN_REVIEW_TAGS)).toEqual([]);
  });

  it("says how long ago", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    expect(timeAgo("2026-11-22T08:00:00Z", now)).toBe("Today");
    expect(timeAgo("2026-11-12T08:00:00Z", now)).toBe("1 week ago");
    expect(timeAgo("2026-09-01T08:00:00Z", now)).toBe("2 months ago");
  });
});

describe("plan review details", () => {
  it("describes what they built", () => {
    expect(planBuildSummary({ units: [{ cols: 4, rows: 4, toteType: "HDX", hasWheels: true, hasTop: true }] })).toBe(
      "4×4 rolling rack with a top",
    );
    expect(planBuildSummary({ units: [{ cols: 9, rows: 13, toteType: "MINI", hasTop: true }] })).toBe("9×13 mini rack with a top");
    expect(planBuildSummary({ units: [{ cols: 2, rows: 4 }, { cols: 2, rows: 4 }] })).toBe("2-unit system");
    expect(planBuildSummary(null)).toBeNull();
  });

  it("builds the meta line", () => {
    expect(planReviewMeta({ build_summary: "4×4 rack", skill_level: "first", build_hours: 4 })).toBe("Built a 4×4 rack · First build · 4 hrs");
    expect(planReviewMeta({ build_summary: "8×4 rolling rack", skill_level: null, build_hours: null })).toBe("Built an 8×4 rolling rack");
    expect(planReviewMeta({ build_summary: "1×2 rack", skill_level: null, build_hours: null })).toBe("Built a 1×2 rack");
    expect(planReviewMeta({ build_summary: null, skill_level: null, build_hours: 1 })).toBe("1 hr");
    expect(planReviewMeta({ build_summary: null, skill_level: null, build_hours: null })).toBeNull();
  });

  it("keeps sane build hours", () => {
    expect(cleanBuildHours("4.3")).toBe(4.5);
    expect(cleanBuildHours("0")).toBeNull();
    expect(cleanBuildHours("500")).toBeNull();
    expect(cleanBuildHours("abc")).toBeNull();
  });
});

describe("isJpeg", () => {
  it("checks the JPEG signature", () => {
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
});
