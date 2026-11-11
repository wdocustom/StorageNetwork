import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const generateObject = vi.fn();
vi.mock("ai", () => ({ generateObject: (...args: unknown[]) => generateObject(...args) }));
vi.mock("@/lib/ai-provider", () => ({
  hasChatProvider: () => true,
  getChatModel: () => "gemini",
  getFallbackModel: () => "groq",
}));

import { planDay } from "./planner.server";
import { canFill, schedule, type Place } from "./schedule";

const ORIGIN = { lat: 30.2672, lon: -97.7431, label: "Austin, TX" };

function place(offerId: string, east: number, north: number): Place {
  return {
    id: `node/${offerId}`,
    offerId,
    address: null,
    city: "Austin",
    phone: null,
    lat: ORIGIN.lat + north / 69,
    lon: ORIGIN.lon + east / 59.6,
    distanceMi: Math.hypot(east, north),
    sig: "x",
  };
}

// Order matters: the planner labels food places p1, p2, … in this order.
const PLACES = [
  place("dennys", 1, 0), // p1
  place("ihop", 2, 1), // p2
  place("starbucks", 1.2, 0.2), // p3
  place("applebees", 2, 0), // p4
  place("red-lobster", 2.5, 0.5), // p5
  place("golden-corral", 1, 1), // p6
  place("great-clips", 1.5, 0.5), // not food — never offered to the model
];

const answer = (over: Record<string, unknown>) => ({
  object: {
    breakfast: null,
    treat_am: null,
    lunch: null,
    treat_pm: null,
    dinner: null,
    reasons: { breakfast: null, treat_am: null, lunch: null, treat_pm: null, dinner: null },
    summary: "A relaxed day close to home.",
    tips: ["Bring your VA card."],
    ...over,
  },
});

const START = 7 * 60 + 30;

describe("planDay", () => {
  beforeEach(() => {
    generateObject.mockReset();
  });

  it("uses Gemini's picks when they follow the rules", async () => {
    generateObject.mockResolvedValue(
      answer({ breakfast: "p2", lunch: "p4", dinner: "p6", reasons: { breakfast: "Close to home.", treat_am: null, lunch: null, treat_pm: null, dinner: null } })
    );
    const plan = await planDay({ places: PLACES, origin: ORIGIN, startMin: START });
    expect(plan.ai).toBe(true);
    expect(plan.summary).toBe("A relaxed day close to home.");
    const by = Object.fromEntries(plan.stops.map((s) => [s.slot, s]));
    expect(by.breakfast.place.offerId).toBe("ihop");
    expect(by.breakfast.why).toBe("Close to home.");
    expect(by.lunch.place.offerId).toBe("applebees");
    expect(by.dinner.place.offerId).toBe("golden-corral");
    // Slots the model left empty are filled from the baseline when nobody asked for changes.
    expect(by.treat_am.place.offerId).toBe("starbucks");
  });

  it("only shows the model food places, with the veteran's request", async () => {
    generateObject.mockResolvedValue(answer({}));
    await planDay({ places: PLACES, origin: ORIGIN, startMin: START, request: "no seafood" });
    const prompt = generateObject.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("no seafood");
    expect(prompt).toContain("p6 | Golden Corral");
    expect(prompt).not.toContain("Great Clips");
  });

  it("repairs picks that break the rules or don't exist", async () => {
    // Golden Corral can't be lunch, p99 doesn't exist, Denny's can't be dinner.
    generateObject.mockResolvedValue(answer({ breakfast: "p99", lunch: "p6", dinner: "p1" }));
    const plan = await planDay({ places: PLACES, origin: ORIGIN, startMin: START });
    for (const stop of plan.stops) expect(canFill(stop.place.offerId, stop.slot)).toBe(true);
    expect(schedule(plan.stops, ORIGIN, START).every((t) => !t.late)).toBe(true);
    expect(new Set(plan.stops.map((s) => s.place.offerId)).size).toBe(plan.stops.length);
  });

  it("honors a skipped slot when the veteran asked for a change", async () => {
    generateObject.mockResolvedValue(answer({ lunch: "p4", dinner: "p6" }));
    const plan = await planDay({
      places: PLACES,
      origin: ORIGIN,
      startMin: START,
      request: "skip breakfast and the treats",
      current: { breakfast: "node/dennys", lunch: "node/applebees", dinner: "node/golden-corral" },
    });
    expect(plan.stops.map((s) => s.slot)).toEqual(["lunch", "dinner"]);
    expect(generateObject.mock.calls[0][0].prompt).toContain("CURRENT PLAN");
  });

  it("falls back to the second model when the first fails", async () => {
    generateObject.mockRejectedValueOnce(new Error("429 quota")).mockResolvedValueOnce(answer({ lunch: "p5" }));
    const plan = await planDay({ places: PLACES, origin: ORIGIN, startMin: START });
    expect(plan.ai).toBe(true);
    expect(generateObject.mock.calls[1][0].model).toBe("groq");
    expect(plan.stops.find((s) => s.slot === "lunch")?.place.offerId).toBe("red-lobster");
  });

  it("falls back to the baseline when no model answers", async () => {
    generateObject.mockRejectedValue(new Error("down"));
    const plan = await planDay({ places: PLACES, origin: ORIGIN, startMin: START });
    expect(plan.ai).toBe(false);
    expect(plan.summary).toBeNull();
    expect(plan.stops.length).toBeGreaterThanOrEqual(3);
  });
});
