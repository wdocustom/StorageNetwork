// ═══════════════════════════════════════════════════════════════════════════
// IndexNow — tell Bing (whose index grounds Copilot and ChatGPT search),
// Yandex, Seznam and Naver which pages changed instead of waiting for a crawl.
// The key is public by design: engines verify it at /<key>.txt (public/).
// scripts/indexnow.mjs uses the same key for manual pings.
// ═══════════════════════════════════════════════════════════════════════════

import { planPageSlugs } from "@/lib/plan-pages";
import { PAGE_UPDATED } from "@/lib/sitemap-dates";

export const INDEXNOW_HOST = "storage-network.app";
export const INDEXNOW_KEY = "376a5f40d65401f57410d6ba4dde902f";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pages whose content date (sitemap-dates.ts) falls within the last `days`
 * days, as site paths. "/plans/[slug]" expands to every plan page; the
 * become-installer template is left out (58 near-identical pages).
 */
export function recentlyUpdatedPaths(now: Date, days: number): string[] {
  const since = now.getTime() - days * DAY_MS;
  const paths: string[] = [];
  for (const [page, date] of Object.entries(PAGE_UPDATED)) {
    if (Date.parse(`${date}T00:00:00Z`) < since) continue;
    if (page === "/plans/[slug]") paths.push(...planPageSlugs().map((s) => `/plans/${s}`));
    else if (page !== "/become-installer") paths.push(page);
  }
  return paths;
}

/** POST the paths to the shared IndexNow endpoint. 200/202 = accepted. */
export async function submitIndexNow(paths: string[]): Promise<{ status: number; ok: boolean }> {
  const urlList = paths.map((p) => `https://${INDEXNOW_HOST}${p}`);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: INDEXNOW_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  });
  return { status: res.status, ok: res.status === 200 || res.status === 202 };
}
