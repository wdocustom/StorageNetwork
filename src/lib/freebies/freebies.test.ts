import { describe, expect, it } from "vitest";

import { OFFERS, getOffer } from "./offers";
import {
  buildOverpassQuery,
  formatUsPhone,
  nearestPerOffer,
  parseOverpassElements,
  type OsmElement,
} from "./places";
import {
  FOOD_SLOTS,
  MIN_MEAL_GAP_MIN,
  SLOT_RULES,
  alternativesFor,
  arrivalWindow,
  buildBaselinePlan,
  canFill,
  completePlan,
  directionsUrl,
  formatTime,
  insertExtra,
  routeUrl,
  schedule,
  type Place,
} from "./schedule";

const ORIGIN = { lat: 30.2672, lon: -97.7431 };

/** A place `east`/`north` miles from the origin. */
function place(offerId: string, east = 0, north = 0, n = 1): Place {
  const lat = ORIGIN.lat + north / 69;
  const lon = ORIGIN.lon + east / (69 * Math.cos((ORIGIN.lat * Math.PI) / 180));
  return {
    id: `node/${offerId}-${n}`,
    offerId,
    address: `${n}00 Main St, Austin, TX 78701`,
    city: "Austin",
    phone: null,
    lat,
    lon,
    distanceMi: Math.hypot(east, north),
    sig: "x",
  };
}

const TOWN: Place[] = [
  place("dennys", 1, 0),
  place("ihop", 2, 1),
  place("starbucks", 1.2, 0.2),
  place("krispy-kreme", 2.5, 0.5),
  place("applebees", 2, 0),
  place("chilis", 3, 1),
  place("golden-corral", 1, 1),
  place("great-clips", 1.5, 0.5),
  place("texas-roadhouse", 2.2, 0.3),
  place("target", 2, 2),
];

describe("offer catalog", () => {
  it("has unique ids and windows that make sense", () => {
    expect(new Set(OFFERS.map((o) => o.id)).size).toBe(OFFERS.length);
    for (const o of OFFERS) {
      expect(o.window[0]).toBeLessThan(o.window[1]);
      expect(o.match.test(o.brand)).toBe(true);
      if (o.kind === "meal") expect(o.mealSlots?.length).toBeGreaterThan(0);
      if (o.kind === "extra") expect(o.extraType).toBeTruthy();
    }
  });

  it("every food offer can fill at least one slot", () => {
    for (const o of OFFERS.filter((o) => o.kind !== "extra")) {
      expect(FOOD_SLOTS.some((slot) => arrivalWindow(o, slot))).toBe(true);
    }
  });

  it("keeps offer hours out of the wrong meal", () => {
    expect(canFill("dennys", "breakfast")).toBe(true);
    expect(canFill("dennys", "lunch")).toBe(false); // ends at noon
    expect(canFill("golden-corral", "lunch")).toBe(false); // starts at 4 p.m.
    expect(canFill("golden-corral", "dinner")).toBe(true);
    expect(canFill("starbucks", "lunch")).toBe(false); // a coffee isn't a meal
    expect(canFill("applebees", "treat_pm")).toBe(false);
    expect(canFill("texas-roadhouse", "lunch")).toBe(false); // voucher, no meal today
    expect(canFill("texas-roadhouse", "extra")).toBe(true);
    expect(canFill("bjs-brewhouse", "treat_am")).toBe(false); // opens at 11
    expect(canFill("bjs-brewhouse", "treat_pm")).toBe(true);
  });
});

describe("baseline plan", () => {
  it("builds a full, on-time day from a morning start", () => {
    const stops = buildBaselinePlan(TOWN, ORIGIN, 7 * 60 + 30);
    const timed = schedule(stops, ORIGIN, 7 * 60 + 30);
    expect(stops.map((s) => s.slot)).toEqual(["breakfast", "treat_am", "lunch", "treat_pm", "dinner"]);
    expect(timed.every((t) => !t.late)).toBe(true);
    // No business twice, never more than three meals.
    expect(new Set(stops.map((s) => s.place.offerId)).size).toBe(stops.length);
    expect(stops.filter((s) => ["breakfast", "lunch", "dinner"].includes(s.slot))).toHaveLength(3);
    // Every arrival is inside both the mealtime and the offer's hours.
    for (const t of timed) {
      const [open, close] = arrivalWindow(getOffer(t.place.offerId)!, t.slot)!;
      expect(t.arrive).toBeGreaterThanOrEqual(open);
      expect(t.arrive).toBeLessThanOrEqual(close);
    }
  });

  it("spaces meals at least three hours apart", () => {
    const start = 9 * 60 + 45;
    const timed = schedule(buildBaselinePlan(TOWN, ORIGIN, start), ORIGIN, start);
    const meals = timed.filter((t) => ["breakfast", "lunch", "dinner"].includes(t.slot));
    for (let i = 1; i < meals.length; i++) {
      expect(meals[i].arrive - meals[i - 1].arrive).toBeGreaterThanOrEqual(MIN_MEAL_GAP_MIN);
    }
  });

  it("drops what's already over when starting in the afternoon", () => {
    const stops = buildBaselinePlan(TOWN, ORIGIN, 14 * 60);
    expect(stops.map((s) => s.slot)).toEqual(["treat_pm", "dinner"]);
  });

  it("returns nothing rather than an impossible plan late at night", () => {
    expect(buildBaselinePlan(TOWN, ORIGIN, 21 * 60)).toEqual([]);
  });

  it("skips a treat that needs a long detour", () => {
    const far = TOWN.filter((p) => getOffer(p.offerId)!.kind !== "treat").concat(place("starbucks", 14, 0));
    const stops = buildBaselinePlan(far, ORIGIN, 7 * 60 + 30);
    expect(stops.some((s) => s.slot === "treat_am" || s.slot === "treat_pm")).toBe(false);
  });
});

describe("completePlan (checking the AI's picks)", () => {
  const start = 7 * 60 + 30;
  const find = (id: string) => TOWN.find((p) => p.offerId === id)!;

  it("keeps valid picks", () => {
    const stops = completePlan({ breakfast: find("ihop"), lunch: find("chilis") }, TOWN, ORIGIN, start);
    expect(stops.find((s) => s.slot === "breakfast")?.place.offerId).toBe("ihop");
    expect(stops.find((s) => s.slot === "lunch")?.place.offerId).toBe("chilis");
  });

  it("replaces a pick that can't fill its slot", () => {
    const stops = completePlan({ lunch: find("golden-corral") }, TOWN, ORIGIN, start);
    const lunch = stops.find((s) => s.slot === "lunch");
    expect(lunch && canFill(lunch.place.offerId, "lunch")).toBe(true);
    expect(lunch?.place.offerId).not.toBe("golden-corral");
  });

  it("never schedules one business twice", () => {
    const stops = completePlan({ breakfast: find("ihop"), lunch: find("ihop") }, TOWN, ORIGIN, start);
    expect(stops.filter((s) => s.place.offerId === "ihop")).toHaveLength(1);
  });

  it("leaves a slot empty when told to", () => {
    const stops = completePlan({ breakfast: null, treat_pm: null }, TOWN, ORIGIN, start);
    expect(stops.map((s) => s.slot)).toEqual(["treat_am", "lunch", "dinner"]);
  });

  it("doesn't let a fallback take a brand a later slot picked", () => {
    // Breakfast pick is invalid; IHOP is reserved for lunch, so breakfast falls back to Denny's.
    const stops = completePlan({ breakfast: find("applebees"), lunch: find("ihop") }, TOWN, ORIGIN, start);
    expect(stops.find((s) => s.slot === "breakfast")?.place.offerId).toBe("dennys");
    expect(stops.find((s) => s.slot === "lunch")?.place.offerId).toBe("ihop");
  });
});

describe("editing a plan", () => {
  const start = 7 * 60 + 30;

  it("fits an extra stop where every stop stays on time", () => {
    const stops = buildBaselinePlan(TOWN, ORIGIN, start);
    const next = insertExtra(stops, TOWN.find((p) => p.offerId === "great-clips")!, ORIGIN, start)!;
    expect(next).toHaveLength(stops.length + 1);
    expect(schedule(next, ORIGIN, start).every((t) => !t.late)).toBe(true);
  });

  it("refuses an extra that can't be reached in its hours", () => {
    // Voucher pickup ends at 2 p.m.; the day starts at 3.
    const stops = buildBaselinePlan(TOWN, ORIGIN, 15 * 60);
    expect(insertExtra(stops, TOWN.find((p) => p.offerId === "texas-roadhouse")!, ORIGIN, 15 * 60)).toBeNull();
  });

  it("flags a swap that makes a stop late instead of hiding it", () => {
    const far = place("ihop", 60, 0, 9); // an hour-plus away
    const timed = schedule(
      [
        { slot: "breakfast", place: TOWN[0] },
        { slot: "lunch", place: far },
      ],
      ORIGIN,
      10 * 60
    );
    expect(timed[1].late).toBe(true);
  });

  it("offers only same-slot alternatives that aren't already in the day", () => {
    const stops = buildBaselinePlan(TOWN, ORIGIN, start);
    const lunch = stops.find((s) => s.slot === "lunch")!;
    const alts = alternativesFor(lunch, stops, TOWN);
    expect(alts.length).toBeGreaterThan(0);
    const used = new Set(stops.map((s) => s.place.offerId));
    for (const a of alts) {
      expect(canFill(a.offerId, "lunch")).toBe(true);
      expect(used.has(a.offerId)).toBe(false);
    }
  });
});

describe("links and formatting", () => {
  it("formats times", () => {
    expect(formatTime(0)).toBe("12:00 AM");
    expect(formatTime(7 * 60 + 5)).toBe("7:05 AM");
    expect(formatTime(12 * 60)).toBe("12:00 PM");
    expect(formatTime(16 * 60 + 45)).toBe("4:45 PM");
  });

  it("links to the business by name and address, or the pin when there's no address", () => {
    const p = place("applebees", 1, 1);
    expect(directionsUrl(p)).toContain(encodeURIComponent("Applebee's, 100 Main St"));
    expect(directionsUrl({ ...p, address: null })).toContain(encodeURIComponent(`${p.lat},${p.lon}`));
  });

  it("builds one route through every stop in order", () => {
    const stops = buildBaselinePlan(TOWN, ORIGIN, 7 * 60 + 30);
    const url = new URL(routeUrl(stops)!);
    expect(url.searchParams.get("waypoints")!.split("|")).toHaveLength(stops.length - 1);
    expect(url.searchParams.get("destination")).toContain(getOffer(stops.at(-1)!.place.offerId)!.brand);
    expect(routeUrl([])).toBeNull();
  });

  it("keeps the slot windows in order through the day", () => {
    for (let i = 1; i < FOOD_SLOTS.length; i++) {
      expect(SLOT_RULES[FOOD_SLOTS[i]].earliest).toBeGreaterThan(SLOT_RULES[FOOD_SLOTS[i - 1]].earliest);
    }
  });
});

describe("OpenStreetMap parsing", () => {
  const el = (id: number, tags: Record<string, string>, lat = 30.3, lon = -97.7): OsmElement => ({
    type: "node",
    id,
    lat,
    lon,
    tags,
  });

  it("queries every catalog brand around the point", () => {
    const q = buildOverpassQuery(ORIGIN, 16000);
    expect(q).toContain("around:16000,30.26720,-97.74310");
    for (const o of OFFERS) expect(q).toContain(o.osm);
    expect(q).not.toContain("'"); // apostrophes are matched with "."
  });

  it("accepts a brand only on the right kind of business", () => {
    const places = parseOverpassElements([
      el(1, { brand: "Applebee's Neighborhood Grill & Bar", amenity: "restaurant", "addr:housenumber": "12", "addr:street": "Elm St", "addr:city": "Austin", "addr:state": "TX", "addr:postcode": "78701", phone: "+1 512-555-0100" }),
      el(2, { name: "Target Road", highway: "residential" }),
      el(3, { brand: "Target", shop: "department_store" }, 30.31),
      el(4, { name: "Lowes Foods", shop: "supermarket" }, 30.32),
      el(5, { brand: "ZIPS Car Wash", amenity: "car_wash" }, 30.33),
      el(6, { brand: "Starbucks", "disused:amenity": "cafe" }, 30.34),
      el(7, { name: "Wendy's Flowers", shop: "florist" }, 30.35),
      el(8, { name: "Great Clips", shop: "hairdresser" }, 30.36),
    ]);
    expect(places.map((p) => p.offerId)).toEqual(["applebees", "target", "zips", "great-clips"]);
    expect(places[0]).toMatchObject({
      id: "node/1",
      address: "12 Elm St, Austin, TX 78701",
      city: "Austin",
      phone: "(512) 555-0100",
    });
    expect(places[1].address).toBeNull();
  });

  it("treats a building and its entrance as one store, keeping the address", () => {
    const places = parseOverpassElements([
      el(1, { brand: "IHOP", amenity: "restaurant" }),
      { type: "way", id: 9, center: { lat: 30.3001, lon: -97.7001 }, tags: { brand: "IHOP", amenity: "restaurant", "addr:housenumber": "5", "addr:street": "Oak Ave" } },
    ]);
    expect(places).toHaveLength(1);
    expect(places[0].address).toBe("5 Oak Ave");
  });

  it("keeps the nearest few of each chain inside the radius", () => {
    const raw = parseOverpassElements(
      [0.01, 0.02, 0.03, 0.04, 0.5].map((d, i) => el(i + 1, { brand: "Starbucks", amenity: "cafe" }, 30.2672 + d, -97.7431))
    );
    const near = nearestPerOffer(raw, ORIGIN, 10);
    expect(near).toHaveLength(3);
    expect(near.map((p) => p.distanceMi)).toEqual([...near.map((p) => p.distanceMi)].sort((a, b) => a - b));
    expect(near.every((p) => p.distanceMi <= 10)).toBe(true);
  });

  it("formats US phone numbers and rejects the rest", () => {
    expect(formatUsPhone("+1-512-555-0100")).toBe("(512) 555-0100");
    expect(formatUsPhone("512.555.0100; 512.555.0199")).toBe("(512) 555-0100");
    expect(formatUsPhone("555-0100")).toBeNull();
    expect(formatUsPhone(undefined)).toBeNull();
  });
});
