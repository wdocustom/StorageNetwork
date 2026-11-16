import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PLAN_ACTIVITY,
  _resetPlanActivityDedupe,
  cleanActivityPayload,
  isClientPlanActivity,
  trackPlanActivity,
} from "./plan-activity";

const TOKEN = "11111111-1111-4111-8111-111111111111";

describe("event rules", () => {
  it("only browser events can come from the browser", () => {
    expect(isClientPlanActivity("guide_step")).toBe(true);
    expect(isClientPlanActivity("open")).toBe(false);
    expect(isClientPlanActivity("code_verified")).toBe(false);
    expect(isClientPlanActivity("toString")).toBe(false);
    expect(isClientPlanActivity("nope")).toBe(false);
    for (const [k, v] of Object.entries(PLAN_ACTIVITY)) expect(v.label.length, k).toBeGreaterThan(3);
  });

  it("clamps payloads", () => {
    expect(cleanActivityPayload({ detail: "  x\ny ", value: 3.6, total: "9" })).toEqual({ detail: "x y", value: 4, total: null });
    expect(cleanActivityPayload({ detail: "a".repeat(500), value: Infinity }).detail).toHaveLength(120);
    expect(cleanActivityPayload({ value: 1e12 }).value).toBe(1_000_000);
    expect(cleanActivityPayload({ detail: "   " }).detail).toBeNull();
  });
});

describe("trackPlanActivity", () => {
  const beacon = vi.fn((_url: string, _body: Blob) => true);
  beforeEach(() => {
    _resetPlanActivityDedupe();
    beacon.mockClear();
    // Just enough browser for the tracker (tests run in node).
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { sendBeacon: beacon, webdriver: false });
    vi.stubGlobal("sessionStorage", { getItem: () => "sid-1" });
  });
  afterEach(() => vi.unstubAllGlobals());

  const sentBodies = async () =>
    Promise.all(beacon.mock.calls.map(async ([, body]) => JSON.parse(await body.text())));

  it("sends a browser event once per page load", async () => {
    trackPlanActivity(TOKEN, "guide_step", { detail: "Module A", value: 3, total: 12 });
    trackPlanActivity(TOKEN, "guide_step", { detail: "Module A", value: 3, total: 12 });
    trackPlanActivity(TOKEN, "guide_step", { detail: "Module A", value: 4, total: 12 });
    expect(beacon).toHaveBeenCalledTimes(2);
    const [first] = await sentBodies();
    expect(first).toMatchObject({ token: TOKEN, event: "guide_step", detail: "Module A", value: 3, total: 12, sessionId: "sid-1" });
    expect(beacon.mock.calls[0][0]).toBe("/api/analytics/plan-activity");
  });

  it("ignores server-only events and missing tokens (Pro / installer access)", () => {
    trackPlanActivity(TOKEN, "open");
    trackPlanActivity(undefined, "guide_open");
    trackPlanActivity("not-a-token", "guide_open");
    expect(beacon).not.toHaveBeenCalled();
  });
});
