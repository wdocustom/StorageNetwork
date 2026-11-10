import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({}) }));

import { rankInstallersForRegion, regionSlugsWithInstallers, type InstallerRow } from "./region-pages";

const row = (id: string, zips: string[], extra: Partial<InstallerRow> = {}): InstallerRow =>
  ({
    id,
    service_zips: zips,
    service_zip: zips[0] ?? null,
    completed_jobs: 0,
    job_score: 0,
    last_login_at: null,
    is_pro: false,
    stripe_account_id: null,
    ...extra,
  }) as InstallerRow;

describe("rankInstallersForRegion", () => {
  const rows = [
    row("omaha-new", ["68105"]),
    row("omaha-busy", ["68105"], { completed_jobs: 9 }),
    row("omaha-pro", ["68105"], { is_pro: true, stripe_account_id: "acct_1" }),
    row("miami", ["33101"]),
  ];

  it("keeps only installers whose service zips are in the region", () => {
    expect(rankInstallersForRegion("omaha-ne", rows).map((r) => r.id).sort()).toEqual(
      ["omaha-busy", "omaha-new", "omaha-pro"],
    );
    expect(rankInstallersForRegion("denver-co", rows)).toEqual([]);
  });

  it("ranks Stripe-connected Pros first, then by completed jobs, and applies the limit", () => {
    expect(rankInstallersForRegion("omaha-ne", rows, 2).map((r) => r.id)).toEqual(["omaha-pro", "omaha-busy"]);
  });

  it("returns nothing for an unparseable slug", () => {
    expect(rankInstallersForRegion("not a slug", rows)).toEqual([]);
  });
});

describe("regionSlugsWithInstallers", () => {
  it("matches per-region ranking for every slug it returns and misses", () => {
    const rows = [row("a", ["68105", "68102"]), row("b", ["33101", "bogus"]), row("c", [])];
    const slugs = regionSlugsWithInstallers(rows);
    expect(slugs).toEqual(new Set(["omaha-ne", "miami-fl"]));
    for (const slug of ["omaha-ne", "miami-fl", "denver-co"]) {
      expect(slugs.has(slug)).toBe(rankInstallersForRegion(slug, rows, 1).length > 0);
    }
  });
});
