import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/region-pages", () => ({
  getInstallerDerivedRegions: async () => [],
  getInstallersForRegionSlug: async (slug: string) => (slug === "omaha-ne" ? [{ id: "i1" }] : []),
  regionSlug: (city: string, state: string) => `${city}-${state}`.toLowerCase(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        not: () => ({
          neq: async () => ({
            data: [
              { slug: "elite", updated_at: "2026-09-01T12:00:00Z", business_name: "Elite", trade_name: null, is_realtor: false },
              { slug: "nodate", updated_at: null, business_name: "No Date Co", trade_name: null, is_realtor: false },
            ],
          }),
        }),
      }),
    }),
  }),
}));

import sitemap from "./sitemap";
import { PAGE_UPDATED } from "@/lib/sitemap-dates";

describe("sitemap lastmod", () => {
  it("uses real content dates — never the generation time, never the future", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const entries = await sitemap();
    vi.useRealTimers();
    const byUrl = Object.fromEntries(entries.map((e) => [e.url.replace("https://storage-network.app", "") || "/", e.lastModified]));
    expect(byUrl["/"]).toBe(PAGE_UPDATED["/"]);
    expect(byUrl["/plans"]).toBe(PAGE_UPDATED["/plans"]);
    expect(byUrl["/plans/adirondack-chair"]).toBe(PAGE_UPDATED["/plans/[slug]"]);
    expect(byUrl["/installers/omaha-ne"]).toBeUndefined();
    expect(byUrl["/p/elite"]).toBe("2026-09-01T12:00:00Z");
    expect(byUrl["/p/nodate"]).toBeUndefined();
    for (const e of entries) expect(String(e.lastModified ?? "")).not.toMatch(/^2030/);
  });

  it("keeps every page date a valid day that isn't in the future", () => {
    for (const [page, date] of Object.entries(PAGE_UPDATED)) {
      expect(date, page).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(date)), page).toBe(false);
      expect(Date.parse(date), page).toBeLessThanOrEqual(Date.now());
    }
  });
});
