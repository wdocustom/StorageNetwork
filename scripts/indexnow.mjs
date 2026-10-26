// ═══════════════════════════════════════════════════════════════════════════
// IndexNow ping — tell Bing (whose index grounds Microsoft Copilot), Yandex,
// Seznam and Naver that pages changed, instead of waiting for the next crawl.
//
//   npm run indexnow                          # the public plans pages
//   node scripts/indexnow.mjs /plans /about   # specific paths
//
// Run after a deploy that changes public content. The key is public by
// design: search engines verify it at https://storage-network.app/<key>.txt
// ═══════════════════════════════════════════════════════════════════════════

const HOST = "storage-network.app";
const KEY = "376a5f40d65401f57410d6ba4dde902f";

const DEFAULT_PATHS = ["/", "/plans", "/plans/checkout", "/plans/jig", "/plans/adirondack-chair", "/llms.txt"];

const paths = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_PATHS;
const urlList = paths.map((p) => `https://${HOST}${p.startsWith("/") ? p : `/${p}`}`);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
});

console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`);
if (!res.ok && res.status !== 202) {
  console.log(await res.text());
  process.exit(1);
}
