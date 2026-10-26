import { afterEach, describe, expect, it, vi } from "vitest";
import { recentlyUpdatedPaths } from "./indexnow";
import { PAGE_UPDATED } from "./sitemap-dates";
import { GET } from "@/app/api/cron/indexnow/route";
import { NextRequest } from "next/server";

const day = (d: string) => new Date(`${d}T13:00:00Z`);

describe("recentlyUpdatedPaths", () => {
  it("picks pages whose content date is inside the window and expands plan pages", () => {
    const paths = recentlyUpdatedPaths(day(PAGE_UPDATED["/plans"]), 3);
    expect(paths).toContain("/plans");
    expect(paths).toContain("/plans/adirondack-chair");
    expect(paths).not.toContain("/plans/[slug]");
    expect(paths).not.toContain("/become-installer");
    expect(paths).not.toContain("/legal/terms"); // dated months earlier
  });

  it("returns nothing once every date is older than the window", () => {
    expect(recentlyUpdatedPaths(day("2099-01-01"), 3)).toEqual([]);
  });
});

describe("GET /api/cron/indexnow", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const call = (auth?: string) =>
    GET(new NextRequest("https://storage-network.app/api/cron/indexnow", { headers: auth ? { authorization: auth } : {} }));

  it("rejects calls without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await call()).status).toBe(401);
  });

  it("submits recently changed pages to IndexNow with the site key", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(day(PAGE_UPDATED["/plans"]));
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ host: "storage-network.app", key: "376a5f40d65401f57410d6ba4dde902f" });
    expect(body.urlList).toContain("https://storage-network.app/plans");
  });

  it("does nothing outside production", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await (await call()).json()).toMatchObject({ skipped: "not production" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
