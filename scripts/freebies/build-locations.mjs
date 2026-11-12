#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Build the Veterans Day planner's location files
//
//   node scripts/freebies/build-locations.mjs
//
// Downloads every US store of each catalog chain from All The Places
// (https://www.alltheplaces.xyz — open data scraped from each chain's own
// store locator, rebuilt weekly) and writes them to
// public/freebies/locations/<lat>_<lon>.json, one file per 1°×1° map square.
// The planner reads those files from our own site instead of searching a
// live map service, which refused or dropped requests too often to rely on.
//
// Run it again before each Veterans Day (and after adding an offer to
// src/lib/freebies/offers.ts) and commit the result.
//
// Row format, kept short because the files are fetched per plan:
//   [offerId, lat, lon, street, city, state, postcode, phone, sourceId]
// ═══════════════════════════════════════════════════════════════════════════

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://alltheplaces-data.openaddresses.io/runs";
const OUT = path.join(process.cwd(), "public/freebies/locations");

/** Catalog offer id → All The Places spider. Offers missing here have no data. */
const SPIDERS = {
  dennys: "dennys_us",
  ihop: "ihop",
  "cracker-barrel": "cracker_barrel_us",
  "bob-evans": "bob_evans_us",
  applebees: "applebees",
  chilis: "chilis",
  "olive-garden": "olive_garden",
  "red-robin": "red_robin",
  "red-lobster": "red_lobster_us",
  "buffalo-wild-wings": "buffalo_wild_wings_us",
  wendys: "wendys",
  hooters: "hooters",
  "shake-shack": "shake_shack",
  torchys: "torchys_tacos_us",
  freddys: "freddys_us",
  "golden-corral": "golden_corral",
  "bonefish-grill": "bonefish_grill",
  outback: "outback_steakhouse",
  starbucks: "starbucks_us",
  "krispy-kreme": "krispy_kreme_us",
  dunkin: "dunkin_us",
  "bjs-brewhouse": "bj_restaurant_us",
  scooters: "scooters_coffee_us",
  "pjs-coffee": "pjs_coffee_us",
  wawa: "wawa",
  "circle-k": "circle_k",
  "great-clips": "great_clips",
  "sport-clips": "sport_clips_us",
  zips: "zips_car_wash_us",
  "texas-roadhouse": "texas_roadhouse",
  target: "target_us",
  kohls: "kohls_us",
  walgreens: "walgreens",
  "home-depot": "home_depot",
  "tractor-supply": "tractor_supply",
};

/** How many past weekly runs to look back through when a chain's latest run came up empty. */
const LOOKBACK_RUNS = 12;

async function json(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function text(v, max) {
  if (typeof v !== "string") return "";
  const t = v.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : "";
}

function phone(raw) {
  if (typeof raw !== "string") return "";
  const digits = raw.split(/[;,]/)[0].replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return digits.length === 10 ? digits : "";
}

function street(p) {
  if (p["addr:street_address"]) return text(p["addr:street_address"], 90);
  const s = [p["addr:housenumber"], p["addr:street"]].filter(Boolean).join(" ");
  return text(s, 90);
}

async function main() {
  const history = await json("https://data.alltheplaces.xyz/runs/history.json");
  const runs = history.map((r) => r.run_id).reverse().slice(0, LOOKBACK_RUNS);
  const stats = new Map();
  const statsFor = async (run) => {
    if (!stats.has(run)) {
      const d = await json(`${BASE}/${run}/stats/_results.json`);
      const rows = Array.isArray(d) ? d : d.results;
      stats.set(run, new Map(rows.map((r) => [r.spider, r.features])));
    }
    return stats.get(run);
  };

  const tiles = new Map();
  const report = [];
  for (const [offerId, spider] of Object.entries(SPIDERS)) {
    let run = null;
    for (const r of runs) {
      if ((await statsFor(r)).get(spider) > 0) {
        run = r;
        break;
      }
    }
    if (!run) {
      report.push(`${offerId}: no data in the last ${LOOKBACK_RUNS} runs`);
      continue;
    }
    const geo = await json(`${BASE}/${run}/output/${spider}.geojson`);
    let kept = 0;
    const seen = new Set();
    for (const f of geo.features ?? []) {
      const p = f.properties ?? {};
      const c = f.geometry?.type === "Point" ? f.geometry.coordinates : null;
      if (!c || typeof c[0] !== "number" || typeof c[1] !== "number") continue;
      const [lon, lat] = c;
      const country = p["addr:country"];
      if (country ? country !== "US" : !(lat > 17 && lat < 72 && lon > -180 && lon < -64)) continue;
      if (p.end_date || p["disused:amenity"] || p["disused:shop"]) continue;
      const id = text(String(f.id ?? p.ref ?? ""), 40);
      const key = id || `${lat.toFixed(5)},${lon.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const row = [
        offerId,
        Number(lat.toFixed(5)),
        Number(lon.toFixed(5)),
        street(p),
        text(p["addr:city"], 50),
        text(p["addr:state"], 20),
        text(p["addr:postcode"], 10),
        phone(p.phone),
        id,
      ];
      const tile = `${Math.floor(lat)}_${Math.floor(lon)}`;
      if (!tiles.has(tile)) tiles.set(tile, []);
      tiles.get(tile).push(row);
      kept++;
    }
    report.push(`${offerId}: ${kept} US locations (${spider}, run ${run})`);
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  let bytes = 0;
  for (const [tile, rows] of tiles) {
    const body = JSON.stringify(rows);
    bytes += body.length;
    await writeFile(path.join(OUT, `${tile}.json`), body);
  }
  console.log(report.join("\n"));
  console.log(`\n${tiles.size} files, ${(bytes / 1e6).toFixed(1)} MB, ${(await readdir(OUT)).length} written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
