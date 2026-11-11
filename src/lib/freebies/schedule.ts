// ═══════════════════════════════════════════════════════════════════════════
// Freebie planner — timing and selection rules
//
// One place decides what a realistic day looks like, and everything else
// (the baseline planner, the check on Gemini's picks, swaps in the browser,
// the email) runs through it:
//
//   • at most three meals, each inside its normal mealtime and at least
//     three hours after the previous one started
//   • at most one small treat between meals
//   • every arrival inside the offer's own hours (Denny's ends at noon,
//     Golden Corral starts at 4 p.m.)
//   • drive time between stops is counted, never assumed away
//
// A stop that can't meet those rules is flagged `late`, never quietly kept.
//
// Pure module — runs in the browser, in route handlers and in tests.
// ═══════════════════════════════════════════════════════════════════════════

import { getOffer, type MealSlot, type Offer } from "./offers";

export type Slot = "breakfast" | "treat_am" | "lunch" | "treat_pm" | "dinner" | "extra";

export const FOOD_SLOTS = ["breakfast", "treat_am", "lunch", "treat_pm", "dinner"] as const;
export type FoodSlot = (typeof FOOD_SLOTS)[number];

interface SlotRule {
  label: string;
  /** Earliest and latest ARRIVAL, minutes after local midnight. */
  earliest: number;
  latest: number;
}

export const SLOT_RULES: Record<FoodSlot, SlotRule> = {
  breakfast: { label: "Breakfast", earliest: 6 * 60, latest: 10 * 60 + 15 },
  treat_am: { label: "Morning treat", earliest: 9 * 60 + 45, latest: 11 * 60 + 15 },
  lunch: { label: "Lunch", earliest: 11 * 60 + 30, latest: 13 * 60 + 45 },
  treat_pm: { label: "Afternoon treat", earliest: 14 * 60 + 30, latest: 16 * 60 + 15 },
  dinner: { label: "Dinner", earliest: 16 * 60 + 45, latest: 19 * 60 + 45 },
};

export function slotLabel(slot: Slot): string {
  return slot === "extra" ? "Stop" : SLOT_RULES[slot].label;
}

export interface LatLon {
  lat: number;
  lon: number;
}

/** A real location of a catalog offer, found near the veteran. */
export interface Place extends LatLon {
  /** OpenStreetMap element, e.g. "node/123". */
  id: string;
  offerId: string;
  /** Street address when the map data has one. */
  address: string | null;
  city: string | null;
  phone: string | null;
  /** Straight-line miles from the starting point. */
  distanceMi: number;
  /** Server signature over the fields above — lets the email route trust it. */
  sig: string;
}

export interface PlanStop {
  slot: Slot;
  place: Place;
  /** One line on why this stop was picked (from the planner). */
  why?: string;
}

export interface TimedStop extends PlanStop {
  arrive: number;
  depart: number;
  /** Estimated drive from the previous stop (or the start). */
  driveMin: number;
  driveMi: number;
  /** True when the arrival falls after the offer or mealtime window. */
  late: boolean;
}

// ── Distance and drive time ─────────────────────────────────────────────────

export function milesBetween(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Roads aren't straight: typical driving distance over straight-line distance. */
const ROAD_FACTOR = 1.35;
/** Door-to-door average on surface streets with lights, in mph. */
const AVG_MPH = 26;
/** Parking and walking in. */
const STOP_OVERHEAD_MIN = 4;

export function driveMiles(a: LatLon, b: LatLon): number {
  return milesBetween(a, b) * ROAD_FACTOR;
}

/** Estimated drive in minutes, rounded up to the next 5 so plans err on the slow side. */
export function driveMinutes(a: LatLon, b: LatLon): number {
  const raw = (driveMiles(a, b) / AVG_MPH) * 60 + STOP_OVERHEAD_MIN;
  return Math.max(5, Math.ceil(raw / 5) * 5);
}

// ── Windows ─────────────────────────────────────────────────────────────────

const MIN_SLOT_OVERLAP_MIN = 30;

/** The arrival window for an offer in a slot, or null when it can't fill that slot. */
export function arrivalWindow(offer: Offer, slot: Slot): [number, number] | null {
  if (slot === "extra") return offer.kind === "extra" ? offer.window : null;
  if (slot === "treat_am" || slot === "treat_pm") {
    if (offer.kind !== "treat") return null;
  } else {
    if (offer.kind !== "meal" || !offer.mealSlots?.includes(slot as MealSlot)) return null;
  }
  const rule = SLOT_RULES[slot];
  const start = Math.max(rule.earliest, offer.window[0]);
  const end = Math.min(rule.latest, offer.window[1]);
  // A sliver of overlap isn't a real fit: a dessert spot that opens at 11
  // is not a mid-morning treat.
  return end - start >= MIN_SLOT_OVERLAP_MIN ? [start, end] : null;
}

export function canFill(offerId: string, slot: Slot): boolean {
  const offer = getOffer(offerId);
  return !!offer && arrivalWindow(offer, slot) !== null;
}

// ── Scheduling ──────────────────────────────────────────────────────────────

/** Nobody sits down to a second full meal sooner than this after the last one began. */
export const MIN_MEAL_GAP_MIN = 180;

/**
 * Put clock times on an ordered list of stops. Each stop starts as soon as
 * the veteran can get there and its window has opened; `late` marks a stop
 * reached after its window closed.
 */
export function schedule(stops: PlanStop[], origin: LatLon, startMin: number): TimedStop[] {
  let cursor = startMin;
  let from: LatLon = origin;
  let lastMealArrive = -Infinity;
  const out: TimedStop[] = [];
  for (const stop of stops) {
    const offer = getOffer(stop.place.offerId);
    if (!offer) continue;
    const window = arrivalWindow(offer, stop.slot) ?? offer.window;
    const driveMin = driveMinutes(from, stop.place);
    const isMeal = stop.slot === "breakfast" || stop.slot === "lunch" || stop.slot === "dinner";
    const arrive = roundUp5(
      Math.max(cursor + driveMin, window[0], isMeal ? lastMealArrive + MIN_MEAL_GAP_MIN : 0)
    );
    if (isMeal) lastMealArrive = arrive;
    const depart = arrive + offer.dwell;
    out.push({
      ...stop,
      arrive,
      depart,
      driveMin,
      driveMi: driveMiles(from, stop.place),
      late: arrive > window[1],
    });
    cursor = depart;
    from = stop.place;
  }
  return out;
}

function roundUp5(min: number): number {
  return Math.ceil(min / 5) * 5;
}

/** Stops in timeline order: food slots by time of day, extras where they were placed. */
export function slotOrder(slot: Slot): number {
  return slot === "extra" ? -1 : FOOD_SLOTS.indexOf(slot);
}

/**
 * Where in the day an extra stop (haircut, car wash, voucher pickup) fits
 * with the least added driving while keeping every stop on time. Returns the
 * new stop list, or null when it doesn't fit anywhere.
 */
export function insertExtra(
  stops: PlanStop[],
  extra: Place,
  origin: LatLon,
  startMin: number
): PlanStop[] | null {
  let best: { list: PlanStop[]; cost: number } | null = null;
  for (let i = 0; i <= stops.length; i++) {
    const list = [...stops.slice(0, i), { slot: "extra" as const, place: extra }, ...stops.slice(i)];
    const timed = schedule(list, origin, startMin);
    if (timed.some((t) => t.late)) continue;
    const cost = timed.reduce((sum, t) => sum + t.driveMi, 0);
    if (!best || cost < best.cost) best = { list, cost };
  }
  return best?.list ?? null;
}

// ── Selection ───────────────────────────────────────────────────────────────

/** Treats are a small detour, not a destination: cap the extra driving. */
const TREAT_MAX_DETOUR_MI = 6;

/** Options for a slot, best first: nearer to where the veteran already is, bigger freebie. */
export function rankForSlot(
  slot: Slot,
  places: Place[],
  from: LatLon,
  origin: LatLon,
  usedOfferIds: Set<string>
): Place[] {
  const scored: { place: Place; score: number }[] = [];
  for (const place of places) {
    const offer = getOffer(place.offerId);
    if (!offer || usedOfferIds.has(offer.id)) continue;
    if (!arrivalWindow(offer, slot)) continue;
    const hop = milesBetween(from, place);
    if (offer.kind === "treat" && hop > TREAT_MAX_DETOUR_MI) continue;
    // A priority step is worth about 3 miles of driving; ending far from home costs a little.
    const score = offer.priority * 3 - hop - milesBetween(place, origin) * 0.3;
    scored.push({ place, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.place);
}

/**
 * The plan with no AI involved: walk the day slot by slot and take the best
 * option that can be reached on time. Also the fallback whenever Gemini is
 * unavailable or returns something the rules reject.
 */
export function buildBaselinePlan(places: Place[], origin: LatLon, startMin: number): PlanStop[] {
  return completePlan({}, places, origin, startMin);
}

export type SlotPicks = Partial<Record<FoodSlot, Place | null>>;

/**
 * Turn per-slot picks into a valid plan. A pick is kept only if it passes
 * every rule; a slot with no pick (undefined) is filled from the baseline; a
 * slot explicitly set to null stays empty.
 */
export function completePlan(
  picks: SlotPicks,
  places: Place[],
  origin: LatLon,
  startMin: number,
  why: Partial<Record<FoodSlot, string>> = {}
): PlanStop[] {
  const stops: PlanStop[] = [];
  const used = new Set<string>();
  // Brands a later slot has asked for stay reserved, so an earlier slot's
  // fallback doesn't take them.
  const reserved = new Set<string>();
  for (const slot of FOOD_SLOTS) {
    const p = picks[slot];
    if (p) reserved.add(p.offerId);
  }

  const fits = (slot: FoodSlot, place: Place): boolean => {
    const timed = schedule([...stops, { slot, place }], origin, startMin);
    return !timed[timed.length - 1]?.late;
  };

  for (const slot of FOOD_SLOTS) {
    const pick = picks[slot];
    if (pick === null) continue;
    const from = stops.length ? stops[stops.length - 1].place : origin;

    if (pick && !used.has(pick.offerId) && canFill(pick.offerId, slot) && fits(slot, pick)) {
      stops.push({ slot, place: pick, why: why[slot] });
      used.add(pick.offerId);
      continue;
    }

    const blocked = new Set([...used, ...reserved]);
    if (pick) blocked.delete(pick.offerId);
    const fallback = rankForSlot(slot, places, from, origin, blocked).find((place) => fits(slot, place));
    if (fallback) {
      stops.push({ slot, place: fallback });
      used.add(fallback.offerId);
    }
  }
  return stops;
}

/** Other places that could take over a stop's slot, nearest first. */
export function alternativesFor(stop: PlanStop, stops: PlanStop[], places: Place[]): Place[] {
  const usedElsewhere = new Set(
    stops.filter((s) => s !== stop && s.slot !== "extra").map((s) => s.place.offerId)
  );
  return places
    .filter((p) => p.id !== stop.place.id && canFill(p.offerId, stop.slot))
    .filter((p) => stop.slot === "extra" || !usedElsewhere.has(p.offerId))
    .filter((p) =>
      stop.slot === "extra" ? getOffer(p.offerId)?.extraType === getOffer(stop.place.offerId)?.extraType : true
    )
    .sort((a, b) => a.distanceMi - b.distanceMi);
}

// ── Formatting and links ────────────────────────────────────────────────────

export function formatTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = hh < 12 ? "AM" : "PM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

export function placeLine(place: Place): string {
  if (place.address) return place.address;
  const miles = `${place.distanceMi.toFixed(1)} mi away`;
  return place.city ? `${place.city} · ${miles}` : miles;
}

function mapsTarget(place: Place): string {
  const offer = getOffer(place.offerId);
  // A named address opens the business itself in Maps; without one, the pin
  // is the only thing known to be right.
  return place.address && offer ? `${offer.brand}, ${place.address}` : `${place.lat},${place.lon}`;
}

/** Google Maps directions from wherever the veteran is to this stop. */
export function directionsUrl(place: Place): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsTarget(place))}&travelmode=driving`;
}

/** One Google Maps route through every stop, in order. */
export function routeUrl(stops: PlanStop[]): string | null {
  if (!stops.length) return null;
  const targets = stops.map((s) => mapsTarget(s.place));
  const destination = targets[targets.length - 1];
  const waypoints = targets.slice(0, -1);
  let url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  if (waypoints.length) url += `&waypoints=${encodeURIComponent(waypoints.join("|"))}`;
  return url;
}
